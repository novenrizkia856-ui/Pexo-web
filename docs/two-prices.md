---
title: Two prices
description: Why the trigger and the floor cannot be the same number.
---

# Two prices, not one

A guard takes two prices. This looks like unnecessary complexity until you work
out what happens with one, so this page does that.

## The single-number design does not execute

Suppose the rule were "settle when the quote falls to your floor, and use the
floor as the swap's minimum output". That is the obvious design, and it is what
the first draft of this protocol specified.

Both numbers are read from the same pool state, in the same call. So the swap
returns exactly the amount that was just quoted. Which means:

- the trigger admits `quote <= floor`
- the swap demands `quote >= floor`

The only place both hold is `quote == floor`, exactly. One point wide.

In a real gap-down the quote lands strictly *below* the floor. The trigger
condition passes, and the swap then reverts. **The guard can never settle.** It
sits armed until expiry while its owner watches the position fall, having
received no protection at all.

This is measured, not argued: `test/MechanismProof.t.sol` in the contract repo
sweeps the range and finds exactly one executable floor out of twenty-one.

## Splitting them restores a working region

```
fire when    quote <= triggerPrice
settle with  amountOutMinimum = floorPrice
required     floorPrice <= triggerPrice
```

The guard now fires while the pool can still fill at the floor. The guarantee is
untouched: it is still the swap itself that enforces the floor.

## The gap is your slippage budget

The distance between your two prices is a real decision, and it is yours.

**Wide gap** — say trigger at 3,000 and floor at 2,700. Fills reliably, because
the pool has 10% of room to move before settlement becomes impossible. The cost
is that you might settle nearer 2,700 than 3,000.

**Narrow gap** — trigger at 3,000, floor at 2,970. Settles close to your trigger
when it works. But a fast move can jump clean over that 1% window, and then
nothing settles.

There is no correct answer. A thinly traded asset, or a volatile one, argues for
a wider gap. A deep pool in calm conditions can take a narrower one.

## Sizing matters too

Your position's own exit moves the pool, and past a point that impact swamps any
floor worth setting. Measured against the live AAPL/USDG 0.05% pool:

| Position | Slippage on exit |
|---|---|
| 25 shares | 0.04% |
| 100 shares | 0.18% |
| 250 shares | 0.58% |
| 500 shares | **15.04%** |

A 5% floor on a 500-share position is a guard that can never fill. The interface
quotes your real exit before you create anything and refuses positions the pool
cannot serve, but the underlying constraint is worth understanding: **the ceiling
is set by pool depth, and it moves as liquidity does.**
