import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { PEXO_CONFIG } from "@/config/pexo.config";

/**
 * Chain and client plumbing.
 *
 * Reads go through a plain HTTP client so the app works before a wallet is
 * connected. Writes need a connected wallet, which may be an extension in this
 * browser or a wallet on another device reached over WalletConnect.
 */

export const robinhoodChain = defineChain({
  id: PEXO_CONFIG.chain.id,
  name: PEXO_CONFIG.chain.name,
  nativeCurrency: PEXO_CONFIG.chain.nativeCurrency,
  rpcUrls: { default: { http: [PEXO_CONFIG.chain.rpcUrl] } },
  blockExplorers: {
    default: { name: "Blockscout", url: PEXO_CONFIG.chain.explorerUrl },
  },
  contracts: {
    /**
     * Canonical Multicall3, verified present on this chain (3,808 bytes).
     *
     * Without this viem refuses to batch reads at all, with
     * `ChainDoesNotSupportContract`, and every guard would need its own round
     * trip. Declaring it turns guard loading into a single call.
     */
    multicall3: { address: "0xca11bde05977b3631167028862be2a173976ca11" },
  },
});

export const publicClient: PublicClient = createPublicClient({
  chain: robinhoodChain,
  transport: http(PEXO_CONFIG.chain.rpcUrl),
});

export const PEXO_ADDRESS = PEXO_CONFIG.contracts.gapGuard as Address;

/** EIP-1193 provider, if the browser has one. */
export type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

/** A WalletConnect provider is an EIP-1193 one that also owns a session. */
type SessionProvider = Eip1193 & {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

/**
 * How the connected wallet is reached.
 *
 * `injected` is an extension in this browser. `walletconnect` is a wallet on
 * another device, paired over a relay. They differ only in how the provider is
 * obtained; every call after that is the same EIP-1193 surface, which is why
 * nothing downstream of `getActiveProvider` needs to know which one is in use.
 */
export type ConnectorKind = "injected" | "walletconnect";

export function getInjectedProvider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const p = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  return p ?? null;
}

export function hasWallet(): boolean {
  return getInjectedProvider() !== null;
}

/**
 * WalletConnect project id, from Reown's dashboard.
 *
 * Public by design: it identifies the app to the relay and ships in the bundle.
 * It is not a secret. The relay only accepts it from the origins listed on that
 * project, so the domain allowlist, not this string, is what protects it.
 *
 * When it is absent the WalletConnect path is hidden rather than offered and
 * then failing at the first tap.
 */
export const WALLETCONNECT_PROJECT_ID = (
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? ""
).trim();

export function hasWalletConnect(): boolean {
  return WALLETCONNECT_PROJECT_ID.length > 0;
}

/**
 * The provider every write goes through, set by `connectWallet`.
 *
 * Reads never touch this; they use `publicClient`, so the app stays useful
 * before anything is connected.
 */
let active: { kind: ConnectorKind; provider: Eip1193 } | null = null;

export function getActiveProvider(): Eip1193 | null {
  return active?.provider ?? null;
}

export function getActiveConnector(): ConnectorKind | null {
  return active?.kind ?? null;
}

/** Kept across connects so an open session is reused rather than re-paired. */
let walletConnectProvider: SessionProvider | null = null;

/**
 * Builds the WalletConnect provider, importing the SDK on first use.
 *
 * The import is dynamic because the SDK and its QR modal are large and most
 * visitors never open the app, let alone this path. Loading it eagerly would
 * put that weight on the landing page.
 */
async function initWalletConnect(): Promise<SessionProvider> {
  if (walletConnectProvider) return walletConnectProvider;

  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const { id, name, rpcUrl, explorerUrl } = PEXO_CONFIG.chain;

  const provider = (await EthereumProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    /**
     * Robinhood Chain is offered as optional, not required.
     *
     * A required chain the wallet does not know makes it refuse the pairing
     * outright, and almost no wallet ships this chain today. Optional lets the
     * session open, after which `ensureCorrectChain` asks the wallet to add it
     * exactly as it does for an extension.
     */
    chains: [],
    optionalChains: [id],
    rpcMap: { [id]: rpcUrl },
    showQrModal: true,
    metadata: {
      name: `Pexo, ${name}`,
      description: "Noncustodial downside floors for tokenized stocks.",
      url: typeof window === "undefined" ? explorerUrl : window.location.origin,
      icons:
        typeof window === "undefined"
          ? []
          : [`${window.location.origin}/pexo-mark.svg`],
    },
  })) as unknown as SessionProvider;

  walletConnectProvider = provider;
  return provider;
}

/**
 * Opens a wallet connection and returns the accounts it granted.
 *
 * Both connectors end in the same place: a provider stored in `active` and an
 * address for the caller. Chain selection is deliberately left out, because a
 * wallet that has just paired may still be on another chain and the caller has
 * to run `ensureCorrectChain` either way.
 */
export async function connectWallet(
  kind: ConnectorKind,
): Promise<{ accounts: Address[]; provider: Eip1193 }> {
  if (kind === "injected") {
    const provider = getInjectedProvider();
    if (!provider) throw new NoWalletError();
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as Address[];
    active = { kind, provider };
    return { accounts: accounts ?? [], provider };
  }

  if (!hasWalletConnect()) throw new WalletConnectUnconfiguredError();

  const provider = await initWalletConnect();
  // Shows the QR modal, or resumes an existing session without one.
  await provider.connect();
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as Address[];

  active = { kind, provider };
  return { accounts: accounts ?? [], provider };
}

/**
 * Drops the connection.
 *
 * A WalletConnect session lives on the relay and on the user's phone, so it has
 * to be torn down explicitly; forgetting it locally would leave the wallet
 * still listing Pexo as connected. An injected provider has no session to end.
 */
export async function disconnectWallet(): Promise<void> {
  const current = active;
  active = null;
  if (current?.kind !== "walletconnect") return;
  try {
    await walletConnectProvider?.disconnect();
  } catch {
    // The session may already be gone from the other side. Nothing to undo.
  } finally {
    walletConnectProvider = null;
  }
}

export function getWalletClient(account: Address): WalletClient {
  const provider = getActiveProvider();
  if (!provider) throw new NoWalletError();
  return createWalletClient({
    account,
    chain: robinhoodChain,
    transport: custom(provider),
  });
}

export class NoWalletError extends Error {
  constructor() {
    super(
      "No wallet is connected. Install a browser wallet, or connect one with WalletConnect.",
    );
    this.name = "NoWalletError";
  }
}

export class WalletConnectUnconfiguredError extends Error {
  constructor() {
    super("WalletConnect is not configured for this build.");
    this.name = "WalletConnectUnconfiguredError";
  }
}

/**
 * Asks the wallet to move to Robinhood Chain, offering to add it if unknown.
 *
 * Doing this before any write matters: a transaction signed against the wrong
 * chain either fails confusingly or, worse, hits a different contract that
 * happens to share the address.
 */
export async function ensureCorrectChain(): Promise<void> {
  const provider = getActiveProvider();
  if (!provider) throw new NoWalletError();

  const hexId = `0x${PEXO_CONFIG.chain.id.toString(16)}`;
  const current = (await provider.request({ method: "eth_chainId" })) as
    | string
    | number
    | null;
  if (normalizeChainId(current) === hexId) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
  } catch (err) {
    // 4902 means the wallet has never heard of this chain. Bridged over
    // WalletConnect the same condition often arrives as a generic -32603, so
    // adding the chain is attempted for both; anything else is a real refusal.
    const code = (err as { code?: number })?.code;
    if (code !== 4902 && code !== -32603) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: hexId,
          chainName: PEXO_CONFIG.chain.name,
          nativeCurrency: PEXO_CONFIG.chain.nativeCurrency,
          rpcUrls: [PEXO_CONFIG.chain.rpcUrl],
          blockExplorerUrls: [PEXO_CONFIG.chain.explorerUrl],
        },
      ],
    });
  }
}

/**
 * `eth_chainId` is specified as a hex string, but wallets bridged over
 * WalletConnect sometimes answer with a decimal number instead. Comparing the
 * raw values would then loop the user through a switch they have already done.
 */
function normalizeChainId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return `0x${value.toString(16)}`;
  return value.startsWith("0x")
    ? value.toLowerCase()
    : `0x${Number(value).toString(16)}`;
}

export function txUrl(hash: string): string {
  return `${PEXO_CONFIG.chain.explorerUrl}/tx/${hash}`;
}
