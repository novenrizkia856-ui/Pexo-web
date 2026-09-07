import type { SupportedAsset } from "@/config/pexo.config";

export type GuardStatus = "armed" | "triggered" | "expired";

/**
 * One escrowed position.
 *
 * Mirrors the `Guard` struct on the contract. Two prices, not one:
 * `triggerPrice` decides when the guard fires, `floorPrice` is the least it may
 * settle for. They cannot be the same number — both are read from the same pool
 * state in the same call, so a rule of "fire when quote <= floor" combined with
 * "minimum out = floor" is only satisfiable where the two are exactly equal, and
 * in a real gap down the quote lands below the floor and nothing ever settles.
 */
export type Guard = {
  id: string;
  asset: SupportedAsset;
  /** Deposited amount of the tokenized stock. */
  amount: number;
  /** Quote at or below which the guard becomes triggerable, in USDG. */
  triggerPrice: number;
  /** Least acceptable settlement, in USDG. Passed to the swap as its minimum. */
  floorPrice: number;
  /** Pool fee tier this guard settles through, fixed at creation. */
  fee: number;
  /** Unix ms. After this the guard can no longer trigger; withdraw is free. */
  expiresAt: number;
  createdAt: number;
  status: GuardStatus;
  /** Set once settled: USDG received. */
  settledAmount?: number;
  /** Set once settled: who triggered it. */
  settledBy?: string;
};

/** Armed, unexpired, and the quote has reached the trigger. */
export function isTriggerable(guard: Guard, quote: number): boolean {
  return (
    guard.status === "armed" &&
    Date.now() < guard.expiresAt &&
    quote <= guard.triggerPrice
  );
}

/**
 * True when the guard has fired but the pool can no longer deliver the floor.
 *
 * The position is safe — the swap reverts rather than settling low — but it
 * cannot settle either, and the holder should know that rather than watch a
 * guard sit there looking armed.
 */
export function isStranded(guard: Guard, quote: number): boolean {
  return (
    guard.status === "armed" &&
    Date.now() < guard.expiresAt &&
    quote < guard.floorPrice
  );
}

/** Distance from the trigger, as a signed fraction. Negative means past it. */
export function headroom(guard: Guard, quote: number): number {
  if (guard.triggerPrice <= 0) return 0;
  return (quote - guard.triggerPrice) / guard.triggerPrice;
}

/** Guaranteed minimum settlement, before the protocol fee and keeper bounty. */
export function guaranteedMinimum(guard: Guard): number {
  return guard.floorPrice;
}

/**
 * What the owner actually nets in the worst case.
 *
 * The floor is the minimum the *swap* may return. The protocol fee and keeper
 * bounty come out of that, so the owner receives the floor less 0.25%. Saying
 * "you cannot receive less than your floor" would be wrong by 25 basis points.
 */
export function floorNetOfCuts(
  guard: Guard,
  feeBps: number,
  bountyBps: number,
): number {
  return guard.floorPrice * (1 - (feeBps + bountyBps) / 10_000);
}

export function bountyOn(guard: Guard, keeperBountyBps: number): number {
  return (guard.floorPrice * keeperBountyBps) / 10_000;
}

export function effectiveStatus(guard: Guard): GuardStatus {
  if (guard.status === "triggered") return "triggered";
  if (Date.now() >= guard.expiresAt) return "expired";
  return "armed";
}
