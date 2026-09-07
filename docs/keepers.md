---
title: Keepers
description: Who settles guards, why they bother, and what they cannot do.
---

# Keepers

## Anyone

`trigger` has no access control. Any address may call it on any guard, at any
time. There is no keeper registry, no whitelist, no staking, no permission to
request, and no role to be granted.

If you want to settle your own guard the moment it becomes eligible, you can.
Nothing gives another party priority over you.

## Why they bother

A settlement pays the caller **0.10%** of the amount received. That is the only
incentive, and it is the only thing a keeper gets.

At the $2,000 minimum floor, the bounty is $2.00 against a settlement cost of
roughly $0.46 at current gas. That margin is what makes the system self running.
See [Fees](fees.md) for how the number was derived.

## What a keeper cannot do

This is the important part, and it is enforced by the contract rather than by
policy.

A keeper **cannot choose the price.** The trigger condition and the minimum
output are both read from the guard's own stored parameters. The keeper supplies
one argument, the guard id, and nothing else.

A keeper **cannot settle a guard early.** If the quote is above the trigger, the
call reverts with `TriggerConditionNotMet`.

A keeper **cannot redirect the proceeds.** The owner's share transfers to the
address stored on the guard.

A keeper **cannot take more than the bounty.** It is a `constant` in the
contract.

A keeper **cannot settle below the floor.** The floor is the swap's
`amountOutMinimum`, so a swap that would return less reverts inside Uniswap.

A keeper is best understood as somebody paid to press a button whose effects are
entirely predetermined. Racing keepers do not harm you. Whoever wins, your payout
is identical.

## Running one

There is no bot to install and no service to sign up for. The interface exposes
a **Settleable** tab listing every guard eligible right now, from any owner, with
a button to settle it.

To build your own, the loop is:

1. Read `GuardCreated` logs from the deployment block to learn the guard ids.
2. Call `guardStatus(guardId)` for each and keep those with `triggerable == true`.
3. Call `trigger(guardId)`.

One caveat that catches people: **`guardStatus` is not a `view` function.** It
cannot be, because QuoterV2 prices a V3 trade by executing it and reverting,
which is unreachable through `STATICCALL`. Off chain this makes no difference,
since `eth_call` is not a static context and the function returns normally.
Simulate it rather than treating it as a read and it behaves as you expect.

## Nothing is guaranteed to be settled

Pexo does not run keepers, does not promise that a keeper exists, and cannot
compel anyone to call `trigger`. The bounty makes settlement profitable. It does
not make it certain.

If your position is small enough that the bounty does not cover gas, or gas
spikes far beyond what the bounty pays, it is entirely possible that **nobody
settles your guard.** You keep [`withdraw`](how-it-works.md) throughout, and you
can always call `trigger` yourself.
