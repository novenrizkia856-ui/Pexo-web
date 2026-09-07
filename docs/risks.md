---
title: Risks
description: The specific ways using Pexo can go badly for you.
---

# Risks

Read this before you create a guard. It is not boilerplate, and none of it is
hypothetical.

## Your guard may never settle

The most important one, so it goes first.

Settlement is a swap that must return at least your floor. If the market moves
faster than a keeper can act, from above your trigger to below your floor in one
step, the swap can no longer deliver the floor and **every attempt to settle
reverts.**

Your guard then sits armed and unsettled until it expires. Your tokens are still
yours and still withdrawable at any moment, but you did not get the exit you set
it up for.

A wider gap between trigger and floor makes this less likely. It cannot make it
impossible. See [Two prices](two-prices.md).

## Nobody is obliged to settle it

`trigger` is permissionless, which means anyone can call it and nobody has to.
Pexo does not run keepers and cannot compel one to exist.

If gas spikes past what your bounty pays, the rational keeper stops calling. You
can always call `trigger` yourself, so this is survivable, but only if you are
watching. Do not assume the guard settles itself while you sleep.

## You receive the floor minus 0.25%

A guard settling exactly at its floor pays you the floor less the protocol fee
and the keeper bounty. If you need to clear a specific number, set the floor
above it. See [Fees](fees.md).

## Pool depth caps your position size

Your own exit moves the pool. Measured on the live AAPL pool, 250 shares cost
58 bps of slippage and 500 shares cost 1,504 bps. Past a certain size no
realistic floor is reachable, because the position cannot leave the pool without
crushing the price.

Liquidity changes. A position that was guardable last month may not be this
month. The interface quotes your actual exit before you create anything, and
that quote is the number to trust rather than the mark price.

## Smart contract risk

The contract is unaudited by any external firm. It has 78 tests, fork testing,
fuzzing, invariant testing, static analysis, and a written self audit, and it is
still code that has not been reviewed by independent professionals.

There is no pause and no upgrade. If a bug is found, it cannot be patched. The
mitigation available to you is `withdraw`, which is always open to you while the
guard is active.

## Dependency risk

Pexo settles through Uniswap V3 and pays out in USDG. Both are outside its
control.

If the V3 pool for your token is drained, migrated, or otherwise stops
functioning, settlement stops working. If USDG depegs, your floor is denominated
in a dollar that is no longer a dollar. If USDG gains a blocklist and your
address lands on it, the transfer at the end of a settlement reverts, which
stalls that guard.

## Fee recipient is a live address

The protocol fee flows permanently to `0x28d836E46c698Ccc530B4D981b089eC14bE39757`,
which is also the address that deployed the contract. It is `immutable` and
cannot be redirected.

That address has no power over guards, escrow, or your funds. It does receive
0.15% of every settlement forever, and if it ever became a contract that reverts
on receipt, settlements would revert with it. It is an externally owned account,
which is the mitigation. It is a dependency, and you should know about it.

## Nothing has run on mainnet yet

At the time of writing, no guard has ever been created on the deployed contract.
It is verified, its parameters have been read back and confirmed, and its
bytecode matches a local build. It has not been exercised end to end against
live liquidity by a real position.

## Expiry does not return your tokens

An expired guard stops being settleable. It does not automatically send anything
anywhere. Your tokens remain escrowed until you call `withdraw`. There is no
deadline on that and no penalty for taking your time, but nothing happens on
your behalf.

## Not advice

Pexo is software. It sets an execution rule you specified. It does not know
whether that rule is a good idea for you, and none of this documentation is
financial advice.
