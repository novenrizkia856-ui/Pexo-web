import { PEXO_CONFIG, type SupportedAsset } from "@/config/pexo.config";
import type { Guard } from "@/lib/guards";

/**
 * Demo fixtures for MOCK_MODE.
 *
 * These exist so the whole flow — create, watch, trigger, withdraw — is
 * demoable before the contract is deployed. They are NOT a token registry:
 * every address here is the zero address, and the UI labels this data as
 * simulated wherever it appears. Real assets come from
 * PEXO_CONFIG.tokens.supportedAssets once those addresses are known.
 */

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const DEMO_ASSETS: readonly SupportedAsset[] = [
  { id: "demo-aapl", symbol: "AAPL", name: "Apple", address: ZERO, decimals: 18, logo: "", accent: "#111111" },
  { id: "demo-tsla", symbol: "TSLA", name: "Tesla", address: ZERO, decimals: 18, logo: "", accent: "#e82127" },
  { id: "demo-nvda", symbol: "NVDA", name: "NVIDIA", address: ZERO, decimals: 18, logo: "", accent: "#76b900" },
  { id: "demo-spy", symbol: "SPY", name: "S&P 500 ETF", address: ZERO, decimals: 18, logo: "", accent: "#3f7f6f" },
];

/** Reference mark prices the simulator walks away from. Simulated, not quoted. */
const DEMO_MARK_PRICE: Record<string, number> = {
  "demo-aapl": 321.76,
  "demo-tsla": 355.38,
  "demo-nvda": 230.66,
  "demo-spy": 604.8,
};

/**
 * Virtual pool depth per asset, in shares, per fee tier.
 *
 * Calibrated so the simulated price impact matches what was measured on the
 * live AAPL/USDG 0.05% pool: 250 shares costs about 58 basis points.
 *
 * Real Uniswap V3 degrades faster than this once a trade leaves the
 * concentrated range — 500 shares cost 1,504 bps on the real pool, where a
 * constant product curve would say roughly 116. The demo therefore understates
 * the risk at large sizes. It exists to teach that size has a cost, not to
 * price a trade.
 */
const DEMO_POOL_SHARES: Record<number, number> = {
  500: 43_000,
  3000: 18_000,
  10000: 4_000,
};

const DAY = 24 * 60 * 60 * 1000;

export function demoMarkPrice(assetId: string): number {
  return DEMO_MARK_PRICE[assetId] ?? 100;
}

/**
 * A deterministic random walk on the mark price. Same asset and tick gives the
 * same price, so the demo is stable across re-renders but visibly alive.
 */
export function simulatedMark(assetId: string, tick: number): number {
  const reference = demoMarkPrice(assetId);
  let seed = 0;
  for (let i = 0; i < assetId.length; i += 1) {
    seed = (seed * 31 + assetId.charCodeAt(i)) >>> 0;
  }
  const phase = (seed % 1000) / 1000;
  const drift =
    Math.sin(tick * 0.12 + phase * Math.PI * 2) * 0.018 +
    Math.sin(tick * 0.031 + phase * 5) * 0.011;
  return Number((reference * (1 + drift)).toFixed(2));
}

/**
 * What the position would actually fetch, including its own price impact.
 *
 * This is the number that matters. Quoting a position at the mark price hides
 * exactly the cost a large holder needs to see before choosing a floor.
 */
export function simulatedQuote(
  assetId: string,
  amount: number,
  fee: number,
  tick: number,
): number {
  const mark = simulatedMark(assetId, tick);
  if (amount <= 0) return 0;

  const shares = DEMO_POOL_SHARES[fee] ?? DEMO_POOL_SHARES[500];
  const usdg = shares * mark;

  // Constant product, with the tier's fee taken off the input.
  const inAfterFee = amount * (1 - fee / 1_000_000);
  return (inAfterFee * usdg) / (shares + inAfterFee);
}

/** Price impact of exiting this position, in basis points. */
export function simulatedSlippageBps(
  assetId: string,
  amount: number,
  fee: number,
  tick: number,
): number {
  if (amount <= 0) return 0;
  const linear = simulatedMark(assetId, tick) * amount;
  const actual = simulatedQuote(assetId, amount, fee, tick);
  if (linear <= 0) return 0;
  return Math.max(0, ((linear - actual) / linear) * 10_000);
}

export function initialDemoGuards(): Guard[] {
  const now = Date.now();
  const fee = PEXO_CONFIG.defaultFeeTier;
  const [aapl, tsla, nvda] = DEMO_ASSETS;

  return [
    {
      // Armed with room to spare.
      id: "g-4821",
      asset: aapl,
      amount: 12,
      triggerPrice: 3_500,
      floorPrice: 3_360,
      fee,
      expiresAt: now + 5 * DAY,
      createdAt: now - 2 * DAY,
      status: "armed",
    },
    {
      // Sitting on its trigger, so it shows as settleable straight away.
      id: "g-4796",
      asset: nvda,
      amount: 40,
      triggerPrice: 9_400,
      floorPrice: 8_900,
      fee,
      expiresAt: now + 2 * DAY,
      createdAt: now - 4 * DAY,
      status: "armed",
    },
    {
      id: "g-4655",
      asset: tsla,
      amount: 6,
      triggerPrice: 2_150,
      floorPrice: 2_040,
      fee,
      expiresAt: now - 1 * DAY,
      createdAt: now - 9 * DAY,
      status: "triggered",
      settledAmount: 2_104.75,
      settledBy: "0x7A1c…9E04",
    },
  ];
}
