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
import { ensureCorrectChain, getInjectedProvider, hasWallet } from "@/lib/chain";
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
  walletAvailable: boolean;
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

  connect: () => Promise<void>;
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

export const useProtocol = create<ProtocolState>((set, get) => ({
  connected: false,
  account: null,
  walletAvailable: typeof window !== "undefined" ? hasWallet() : false,
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

  connect: async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      set({
        error: "No wallet found. Install a browser wallet to use Pexo.",
        walletAvailable: false,
      });
      return;
    }

    set({ status: "pending", error: null });
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];
      if (!accounts?.length) throw new Error("No account was returned by the wallet.");

      await ensureCorrectChain();
      set({ connected: true, account: accounts[0], status: "idle" });
      await get().refresh();
    } catch (err) {
      set({ status: "error", error: explainError(err) });
    }
  },

  disconnect: () => set({ connected: false, account: null, guards: [], quotes: {} }),

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
