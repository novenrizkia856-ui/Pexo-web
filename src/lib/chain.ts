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
 * connected. Writes need the injected provider.
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
type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

export function getInjectedProvider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const p = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  return p ?? null;
}

export function hasWallet(): boolean {
  return getInjectedProvider() !== null;
}

export function getWalletClient(account: Address): WalletClient {
  const provider = getInjectedProvider();
  if (!provider) throw new NoWalletError();
  return createWalletClient({
    account,
    chain: robinhoodChain,
    transport: custom(provider),
  });
}

export class NoWalletError extends Error {
  constructor() {
    super("No wallet found. Install a browser wallet to use Pexo.");
    this.name = "NoWalletError";
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
  const provider = getInjectedProvider();
  if (!provider) throw new NoWalletError();

  const hexId = `0x${PEXO_CONFIG.chain.id.toString(16)}`;
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === hexId) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
  } catch (err) {
    // 4902 means the wallet has never heard of this chain.
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err;
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

export function txUrl(hash: string): string {
  return `${PEXO_CONFIG.chain.explorerUrl}/tx/${hash}`;
}
