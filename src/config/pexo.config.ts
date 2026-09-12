import { PEXO_TOKEN_ADDRESS } from "./token-address";

/**
 * PEXO — single source of truth for every on chain value.
 *
 * RULE: no address, RPC URL, chain id, or protocol parameter may be inlined
 * anywhere else in this codebase. Everything reads from here.
 *
 * The protocol contract is deployed and verified. The only remaining TODO is
 * the PEXO token, which does not exist and is unrelated to the guard system.
 * Every address here was read back from the chain after deployment; see
 * docs/deployment.md, which is also what the site renders at /docs/deployment.
 */

export type SupportedAsset = {
  /** Stable internal id, used for routing and React keys. */
  id: string;
  /** Ticker shown in the UI. */
  symbol: string;
  /** Full instrument name. */
  name: string;
  /** ERC-20 address on Robinhood Chain. */
  address: `0x${string}`;
  decimals: number;
  /** Path under /public. */
  logo: string;
  /** Per-asset accent, used sparingly for the token mark only. */
  accent: string;
};

/**
 * Accepts the launch address only if it is exactly `0x` plus 40 hex digits.
 *
 * A malformed value becomes null, so the site keeps saying "Coming soon"
 * rather than publishing something broken: a truncated address on a launch
 * page is worse than no address, because people act on it. In development the
 * same mistake throws, so a bad paste is caught while editing instead of being
 * discovered by whoever copies it.
 */
function resolveTokenAddress(value: string | null): `0x${string}` | null {
  if (value === null) return null;

  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    const message = `PEXO_TOKEN_ADDRESS is not a valid address: ${JSON.stringify(value)}`;
    if (import.meta.env.DEV) throw new Error(message);
    console.error(message);
    return null;
  }

  return trimmed as `0x${string}`;
}

export const PEXO_CONFIG = {
  chain: {
    id: 4663,
    name: "Robinhood Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: "https://robinhoodchain.blockscout.com",
  },

  contracts: {
    /**
     * The Pexo guard contract.
     *
     * Deployed at block 56,477,524 and verified on Blockscout as an exact
     * match. Setting this to a real address is what turns MOCK_MODE off, so
     * every action below must have a live implementation before it changes.
     */
    gapGuard: "0x765ec7b94587E5573c5E467Ef07458953Cd09911",

    /** Block the contract was deployed in. Guard discovery scans from here. */
    deploymentBlock: 56477524n,

    /**
     * Uniswap V3 on Robinhood Chain. Read from the chain and cross checked
     * against Uniswap's published deployment list.
     *
     * V3, not V2. The V2 pairs for these tokens exist but hold dust: one AAPL
     * sells for about $0.0086 there against $321 on V3.
     */
    swapRouter: "0xCaf681a66D020601342297493863E78C959E5cb2",
    quoter: "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7",
    uniswapV3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  },

  /**
   * Pool fee tiers a guard may settle through, in hundredths of a bip.
   *
   * The tier is pinned per guard at creation and never reconsidered. The
   * contract must not be free to pick a pool at settlement time, or an attacker
   * could steer the trade into whichever tier they had made cheapest to move.
   */
  feeTiers: [
    { value: 500, label: "0.05%" },
    { value: 3000, label: "0.30%" },
    { value: 10000, label: "1.00%" },
  ],

  /** Deepest tier for the tokenized stocks today. Verify before launch. */
  defaultFeeTier: 500,

  tokens: {
    /**
     * Settlement stablecoin.
     *
     * Address and decimals were read from Robinhood Chain over RPC and match
     * the Global Dollar token: `name() == "Global Dollar"`, `symbol() == "USDG"`.
     *
     * SIX decimals, not eighteen. $5.00 is 5_000_000 base units. Every USDG
     * denominated figure the app sends on chain must use this scale; an
     * 18 decimal assumption inflates amounts by a factor of a trillion.
     */
    usdg: {
      address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      symbol: "USDG",
      decimals: 6,
    },
    /**
     * The tokens the deployed contract accepts. This list must match the
     * allowlist that was fixed in the constructor: the contract rejects
     * anything else, and the allowlist cannot be changed without a new
     * deployment.
     *
     * All three verified on chain as 18 decimal ERC20s with a live 0.05% V3
     * pool against USDG.
     */
    supportedAssets: [
      {
        id: "aapl",
        symbol: "AAPL",
        name: "Apple",
        address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
        decimals: 18,
        logo: "/tokens/aapl.svg",
        accent: "#111111",
      },
      {
        id: "tsla",
        symbol: "TSLA",
        name: "Tesla",
        address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
        decimals: 18,
        logo: "/tokens/tsla.svg",
        accent: "#e82127",
      },
      {
        id: "nvda",
        symbol: "NVDA",
        name: "NVIDIA",
        address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
        decimals: 18,
        logo: "/tokens/nvda.svg",
        accent: "#76b900",
      },
    ] as readonly SupportedAsset[],
  },

  /**
   * The Pexo token contract.
   *
   * NOT part of the protocol. The guard system does not read, hold, or settle
   * this token, and no part of the app depends on it. It sits here only so the
   * landing page can publish the address once the token exists.
   */
  token: {
    symbol: "PEXO",
    /**
     * Set at launch by editing `src/config/token-address.ts`, nothing here.
     * Validated on the way in, so this is either a well formed address or null.
     */
    address: resolveTokenAddress(PEXO_TOKEN_ADDRESS),
  },

  protocol: {
    /** Protocol fee on a triggered settlement, in basis points. */
    feeBps: 15, // 0.15%
    /** Paid to whoever triggers a guard, in basis points. */
    keeperBountyBps: 10, // 0.10%
    /**
     * Minimum deposit, denominated in USD.
     *
     * TODO: confirm before launch. This must be set from keeper economics, not
     * picked for looks. `trigger` costs ~369k gas against the real V3 pool and
     * the bounty is 0.10% of the settlement, so at $5 the bounty is half a cent
     * and no keeper will ever settle the guard. See finding 5c in the contracts
     * repo self audit; the argument is for a minimum in the low hundreds.
     *
     * Must match `minDepositUsdEquivalent` on the deployed contract, which is
     * expressed in USDG base units (6 decimals): $2,000 is 2000000000.
     *
     * Derived from live conditions: a trigger costs ~500k gas, gas is 0.363
     * gwei and ETH is $2,513.85, so a trigger costs about $0.46. A $2,000 floor
     * pays a $2.00 bounty, which covers it 4.4 times over. At $500 the bounty
     * is $0.50 against a $0.46 cost and no keeper takes it. Re-derive before
     * launch; this moves with gas.
     */
    minDepositUsd: 2000,

    /**
     * Slippage on the position's own exit, above which the UI warns.
     *
     * A large position moves the pool on its way out. Past a point the impact
     * swamps any floor worth setting and the guard can never fill. Measured on
     * the live AAPL pool: 250 shares costs 58 bps, 500 shares costs 1,504 bps.
     */
    slippageWarnBps: 100,
    slippageBlockBps: 500,
  },

  /**
   * Outbound links.
   *
   * Documentation is served by this app from the /docs markdown, so it is a
   * route rather than a URL. Source and social links are deliberately absent
   * until there is something real to point at; a dead link reads worse than
   * no link.
   */
  links: {
    docs: "/docs",
  },
} as const;

/**
 * MOCK_MODE returns fabricated guard data so the entire flow
 * (create → dashboard → trigger → withdraw) is demoable before any contract
 * exists. It is forced on while gapGuard is still the zero address, so the
 * app can never silently attempt a real call against a placeholder.
 */
export const MOCK_MODE =
  (PEXO_CONFIG.contracts.gapGuard as string) ===
  "0x0000000000000000000000000000000000000000";

/** True once the chain endpoints are real. Gates explorer links. */
export const CHAIN_CONFIGURED =
  !(PEXO_CONFIG.chain.rpcUrl as string).startsWith("TODO") &&
  !(PEXO_CONFIG.chain.explorerUrl as string).startsWith("TODO");

/** True once the Pexo token has an address to publish. */
export const TOKEN_PUBLISHED = PEXO_CONFIG.token.address !== null;

/** Middle truncated address, for display where the full string will not fit. */
export function shortAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const bpsToPercent = (bps: number) => `${(bps / 100).toFixed(2)}%`;

export function explorerAddressUrl(address: string): string | null {
  if (!CHAIN_CONFIGURED) return null;
  return `${PEXO_CONFIG.chain.explorerUrl}/address/${address}`;
}

export function isPlaceholderAddress(address: string): boolean {
  return /^0x0{40}$/i.test(address);
}
