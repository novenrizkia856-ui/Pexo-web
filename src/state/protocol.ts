import { create } from "zustand";
import type { Address } from "viem";
import { MOCK_MODE, PEXO_CONFIG, type SupportedAsset } from "@/config/pexo.config";
import type { Guard } from "@/lib/guards";
import {
  DEMO_ASSETS,
  initialDemoGuards,
  simulatedMark,
  simulatedQuote,
  simulatedSlippageBps,
} from "@/lib/mock";
import {
  approveExact,
  createGuard as createGuardOnChain,
  explainError,
  fetchAllowance,
  fetchGuards,
  fetchQuotes,
  fetchTokenBalance,
  findConfigDrift,
  triggerGuard as triggerOnChain,
  withdrawGuard as withdrawOnChain,
} from "@/lib/pexo-client";
import {
  connectWallet,
  disconnectWallet,
  ensureCorrectChain,
  hasWallet,
  hasWalletConnect,
  type ConnectorKind,
  type Eip1193,
} from "@/lib/chain";
import { toTokenUnits, toUsdgUnits } from "@/lib/units";

/**
 * The app's data layer.
 *
 * Every read and write goes through here. With the contract deployed this talks
 * to the chain; MOCK_MODE only survives as a fallback for a build whose
 * `gapGuard` is still the zero address, and is off in this one.
 *
 * Quotes are the awkward part. `guardStatus` cannot be a `view` function
 * because pricing a Uniswap V3 trade needs QuoterV2, which executes a swap and
 * recovers the answer from the revert. It is simulated with `eth_call`, which
 * costs nothing but is a network round trip per guard, so quotes are fetched
 * deliberately rather than on every render.
 */

type Status = "idle" | "pending" | "error";

type ProtocolState = {
  connected: boolean;
  account: Address | null;
  /** An injected wallet exists in this browser. */
  walletAvailable: boolean;
  /** This build carries a WalletConnect project id, so pairing is offered. */
  walletConnectAvailable: boolean;
  /** How the current wallet is reached, once one is connected. */
  connector: ConnectorKind | null;
  guards: Guard[];
  /** Exit quote per guard id, in USDG. Refreshed on demand. */
  quotes: Record<string, number>;
  balances: Record<string, number>;
  loadingGuards: boolean;
  status: Status;
  error: string | null;
  lastTxHash: string | null;
  /** Only advances in mock mode; the price simulator reads it. */
  tick: number;

  assets: () => readonly SupportedAsset[];
  mark: (assetId: string) => number;
  quote: (assetId: string, amount: number, fee: number) => number;
  quoteFor: (guardId: string) => number;
  slippageBps: (assetId: string, amount: number, fee: number) => number;

  connect: (kind?: ConnectorKind) => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  advance: () => void;
  clearError: () => void;
  checkConfig: () => Promise<void>;

  approve: (asset: SupportedAsset, amount: number) => Promise<void>;
  allowanceOf: (asset: SupportedAsset) => Promise<number>;
  createGuard: (input: {
    asset: SupportedAsset;
    amount: number;
    triggerPrice: number;
    floorPrice: number;
    fee: number;
    expiresAt: number;
  }) => Promise<void>;
  triggerGuard: (id: string) => Promise<void>;
  withdrawGuard: (id: string) => Promise<void>;
};

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Providers already subscribed to, so reconnecting does not stack listeners. */
const watched = new WeakSet<Eip1193>();

/**
 * Follows the wallet's own view of the connection.
 *
 * This matters far more over WalletConnect than with an extension: the session
 * can be ended from the phone, and without these events the app would keep
 * showing an address it can no longer sign with.
 */
function watchProvider(
  provider: Eip1193,
  set: (partial: Partial<ProtocolState>) => void,
  get: () => ProtocolState,
) {
  if (!provider.on || watched.has(provider)) return;
  watched.add(provider);

  const onAccountsChanged = (accounts: string[]) => {
    if (!accounts?.length) {
      get().disconnect();
      return;
    }
    set({ account: accounts[0] as Address, guards: [], quotes: {}, balances: {} });
    void get().refresh();
  };

  provider.on("accountsChanged", onAccountsChanged as (...args: never[]) => void);
  provider.on("disconnect", (() => get().disconnect()) as (...args: never[]) => void);
}

export const useProtocol = create<ProtocolState>((set, get) => ({
  connected: false,
  account: null,
  walletAvailable: typeof window !== "undefined" ? hasWallet() : false,
  walletConnectAvailable: hasWalletConnect(),
  connector: null,
  guards: MOCK_MODE ? initialDemoGuards() : [],
  quotes: {},
  balances: {},
  loadingGuards: false,
  status: "idle",
  error: null,
  lastTxHash: null,
  tick: 0,

  assets: () => {
    const configured = PEXO_CONFIG.tokens.supportedAssets;
    if (configured.length > 0) return configured;
    return MOCK_MODE ? DEMO_ASSETS : [];
  },

  /** Indicative unit price. Simulated only; the chain has no mark price. */
  mark: (assetId) => simulatedMark(assetId, get().tick),

  /**
   * Pre-trade estimate used while the create form is being filled in.
   *
   * A guard does not exist yet, so there is nothing on chain to quote. This is
   * the simulator's curve, and the form labels it as an estimate. Once a guard
   * exists, `quoteFor` returns the contract's own number.
   */
  quote: (assetId, amount, fee) => simulatedQuote(assetId, amount, fee, get().tick),
  slippageBps: (assetId, amount, fee) => simulatedSlippageBps(assetId, amount, fee, get().tick),

  /** The contract's own exit quote for an existing guard. */
  quoteFor: (guardId) => get().quotes[guardId] ?? 0,

  advance: () => set((s) => ({ tick: s.tick + 1 })),
  clearError: () => set({ error: null }),

  /**
   * Verifies this build agrees with the contract it points at.
   *
   * Run once when the app mounts. A mismatch is not a transient error, so it is
   * surfaced the same way a failed transaction is rather than logged and lost.
   */
  checkConfig: async () => {
    if (MOCK_MODE) return;
    const drift = await findConfigDrift();
    if (drift.length > 0) {
      set({ error: `This build does not match the deployed contract. ${drift.join(" ")}` });
    }
  },

  /**
   * Connects a wallet, defaulting to whichever connector this browser can use.
   *
   * An extension is preferred when one is present because it needs no pairing,
   * but the choice is always the caller's: someone with an extension installed
   * may still want to sign from a phone.
   */
  connect: async (kind) => {
    const { walletAvailable, walletConnectAvailable } = get();
    const chosen: ConnectorKind = kind ?? (walletAvailable ? "injected" : "walletconnect");

    if (chosen === "injected" && !walletAvailable) {
      set({
        error: "No wallet found. Install a browser wallet to use Pexo.",
        walletAvailable: false,
      });
      return;
    }
    if (chosen === "walletconnect" && !walletConnectAvailable) {
      set({ error: "WalletConnect is not configured for this build." });
      return;
    }

    set({ status: "pending", error: null });
    try {
      const { accounts, provider } = await connectWallet(chosen);
      if (!accounts?.length) throw new Error("No account was returned by the wallet.");

      await ensureCorrectChain();
      set({ connected: true, account: accounts[0], connector: chosen, status: "idle" });
      watchProvider(provider, set, get);
      await get().refresh();
    } catch (err) {
      // The session, if one opened, is deliberately left in place. A failure
      // here is usually a declined chain switch, and tearing the pairing down
      // would make the user scan a fresh QR code just to try again.
      set({ status: "error", error: explainError(err), connected: false, account: null });
    }
  },

  disconnect: () => {
    void disconnectWallet();
    set({ connected: false, account: null, connector: null, guards: [], quotes: {}, balances: {} });
  },

  /** Reloads guards, their quotes and the connected wallet's balances. */
  refresh: async () => {
    const { account } = get();
    if (!account) return;

    set({ loadingGuards: true });
    try {
      const guards = await fetchGuards(account);
      set({ guards });

      const [quotes, balanceEntries] = await Promise.all([
        fetchQuotes(guards.filter((g) => g.status === "armed").map((g) => g.id)),
        Promise.all(
          PEXO_CONFIG.tokens.supportedAssets.map(
            async (a) =>
              [
                a.id,
                await fetchTokenBalance(a.address as Address, account, a.decimals),
              ] as const,
          ),
        ),
      ]);

      set({ quotes, balances: Object.fromEntries(balanceEntries) });
    } catch (err) {
      set({ error: explainError(err) });
    } finally {
      set({ loadingGuards: false });
    }
  },

  allowanceOf: async (asset) => {
    const { account } = get();
    if (!account) return 0;
    return fetchAllowance(asset.address as Address, account, asset.decimals);
  },

  approve: async (asset, amount) => {
    const { account } = get();
    if (!account) return;
    set({ status: "pending", error: null });
    try {
      const hash = await approveExact(
        account,
        asset,
        toTokenUnits(amount, asset.decimals),
      );
      set({ status: "idle", lastTxHash: hash });
    } catch (err) {
      set({ status: "error", error: explainError(err) });
      throw err;
    }
  },

  createGuard: async ({ asset, amount, triggerPrice, floorPrice, fee, expiresAt }) => {
    const { account } = get();
    if (!account) return;

    if (MOCK_MODE) {
      set({ status: "pending", error: null });
      await settle(700);
      set((s) => ({
        guards: [
          {
            id: `g-${Math.floor(1000 + Math.random() * 8999)}`,
            asset, amount, triggerPrice, floorPrice, fee, expiresAt,
            createdAt: Date.now(), status: "armed" as const,
          },
          ...s.guards,
        ],
        status: "idle",
      }));
      return;
    }

    set({ status: "pending", error: null });
    try {
      const hash = await createGuardOnChain(account, {
        asset,
        fee,
        amountUnits: toTokenUnits(amount, asset.decimals),
        triggerUnits: toUsdgUnits(triggerPrice),
        floorUnits: toUsdgUnits(floorPrice),
        expirySeconds: BigInt(Math.floor(expiresAt / 1000)),
      });
      set({ status: "idle", lastTxHash: hash });
      await get().refresh();
    } catch (err) {
      set({ status: "error", error: explainError(err) });
      throw err;
    }
  },

  triggerGuard: async (id) => {
    const { account } = get();
    if (!account) return;
    set({ status: "pending", error: null });
    try {
      const hash = await triggerOnChain(account, id);
      set({ status: "idle", lastTxHash: hash });
      await get().refresh();
    } catch (err) {
      set({ status: "error", error: explainError(err) });
    }
  },

  withdrawGuard: async (id) => {
    const { account } = get();
    if (!account) return;
    set({ status: "pending", error: null });
    try {
      const hash = await withdrawOnChain(account, id);
      set({ status: "idle", lastTxHash: hash });
      await get().refresh();
    } catch (err) {
      set({ status: "error", error: explainError(err) });
    }
  },
}));
