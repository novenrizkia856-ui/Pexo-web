---
title: The floor guarantee
description: Why the floor holds, derived from the mechanism rather than asserted.
---

# The floor guarantee

Most protocols that promise a price are promising to try. Pexo is not promising
to try. The floor holds because of where it sits in the transaction, and this
page derives that rather than asking you to take it on faith.

## Where the floor actually lives

Settlement happens in exactly one place: a call to Uniswap V3's
`SwapRouter02.exactInputSingle`. One of its parameters is `amountOutMinimum`, and
the router reverts if the swap would return less than it.

Pexo passes **your floor price** as that parameter.

```
exactInputSingle({
  tokenIn:           your token,
  tokenOut:          USDG,
  fee:               the tier fixed at creation,
  amountIn:          your escrowed amount,
  amountOutMinimum:  YOUR FLOOR PRICE,   <-- this line
  ...
})
```

So a settlement below your floor is not something the protocol has to detect,
bound, or refuse. It is a transaction the EVM will not include.

## What an attacker can actually do

Work through what someone with capital could attempt.

**Push the pool down to force an early trigger.** The trigger condition passes,
and then the swap runs. It either fills at or above your floor, which is an
outcome you explicitly authorised by choosing that floor, or it reverts. The
attacker pays the price impact and the gas either way, and gains nothing.

**Push the pool below your floor.** Now the trigger condition passes and the swap
reverts. The attacker has spent real capital moving a market to accomplish
precisely nothing. Your tokens are untouched.

**Win the race against another keeper.** The bounty is the only prize. Your
payout is byte for byte identical regardless of who calls `trigger`, so there is
nothing to gain by front running beyond the bounty itself.

**Sandwich the settlement.** The same argument as the first two. The floor is
enforced inside the same transaction, so there is no window between the price
being observed and the trade executing.

## Why there is no oracle

Because there is nothing for an oracle to do.

An oracle exists to tell a contract what a price is, so the contract can decide
whether an action is safe. Pexo does not need to be told: it reads the pool in
the same transaction that trades against it, and the trade's own minimum output
enforces the outcome.

That removes the entire class of oracle failures — stale feeds, manipulated
feeds, feeds that halt during exactly the volatility you needed them for.

## The honest limit

The guarantee is about **price**, not **execution**.

Pexo guarantees you will never be settled below your floor. It does not
guarantee you will be settled at all. If the market gaps straight through your
floor with no block in between where the pool could still fill it, no keeper can
settle, and you keep the depreciated tokens.

No on chain stop can promise otherwise without a counterparty willing to take the
other side, and Pexo has no such counterparty by design. The gap between your
trigger and your floor is the control you have over this. See
[Two prices](two-prices.md) and [Risks](risks.md).

## And the 0.25%

One more piece of precision. The floor is the minimum the *swap* returns. The
protocol fee and keeper bounty come out of that amount, so what reaches your
wallet is your floor less 0.25%.

Saying "you cannot receive less than your floor" would be wrong by 25 basis
points, so the interface says "you receive at least X" with the net figure.
