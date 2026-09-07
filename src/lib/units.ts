import { formatUnits, parseUnits } from "viem";
import { PEXO_CONFIG } from "@/config/pexo.config";

/**
 * The boundary between what people type and what the chain stores.
 *
 * Two scales are in play and they are not the same: USDG has SIX decimals while
 * the tokenized stocks have eighteen. Mixing them up inflates or deflates an
 * amount by a factor of a trillion, and this project already shipped that bug
 * once in config. Every conversion goes through here so there is one place to
 * get it right.
 */

export const USDG_DECIMALS = PEXO_CONFIG.tokens.usdg.decimals;

/** A user-typed USDG figure, e.g. "2000.50", into base units. */
export function toUsdgUnits(value: string | number): bigint {
  return parseUnits(String(value), USDG_DECIMALS);
}

/** USDG base units back into a JS number, for display and arithmetic. */
export function fromUsdgUnits(value: bigint): number {
  return Number(formatUnits(value, USDG_DECIMALS));
}

/** A user-typed token amount into that token's base units. */
export function toTokenUnits(value: string | number, decimals: number): bigint {
  return parseUnits(String(value), decimals);
}

export function fromTokenUnits(value: bigint, decimals: number): number {
  return Number(formatUnits(value, decimals));
}

/**
 * Parses user input without throwing.
 *
 * `parseUnits` rejects anything malformed, which is right at the chain boundary
 * but wrong while somebody is still typing. Returns null instead so a field can
 * show a hint rather than crash a render.
 */
export function tryParseUnits(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  try {
    const parsed = parseUnits(trimmed, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Basis points of a bigint, rounding down.
 *
 * Mirrors the contract exactly, which also truncates. Computing this in
 * floating point would drift from what actually gets paid out.
 */
export function applyBps(value: bigint, bps: number): bigint {
  return (value * BigInt(bps)) / 10_000n;
}
