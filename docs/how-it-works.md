---
title: How it works
description: The lifecycle of a guard, from deposit to settlement or withdrawal.
---

# How it works

A guard has exactly three moments: it is created, and then it is either settled
or withdrawn. Nothing else ever happens to it.

## 1. Create

You choose five things:

| | |
|---|---|
| **Asset** | Which tokenized stock. Must be on the allowlist fixed at deployment. |
| **Amount** | How much to escrow. |
| **Trigger price** | The quote at which the guard becomes settleable. |
| **Floor price** | The least you will accept. Never above the trigger. |
| **Expiry** | After this the guard can no longer settle. |

You also pick a **pool fee tier**. It is fixed for the life of the guard and
never reconsidered, deliberately: a contract free to choose a pool at settlement
time would hand an attacker the ability to steer the trade into whichever tier
they had made cheapest to manipulate.

The contract pulls exactly the amount you approved. It never asks for more, and
Pexo's interface has no unlimited approval option anywhere in it.

Both prices are denominated in **USDG for the whole position**, not per share. A
guard on 10 shares with a floor of 3,000 means "3,000 USDG for the lot".

## 2. The contract waits

Nothing happens on its own. There is no bot inside the contract, no scheduler, no
upkeep. The guard simply sits there holding your tokens.

Anyone can ask the contract what a guard is worth right now through
`guardStatus`, which prices the position against the live pool including its own
price impact.

## 3a. Settle

Once the quote falls to or below your trigger, **any address** can call
`trigger`. The contract:

1. Prices the position against the pool.
2. Refuses if the quote is still above your trigger.
3. Closes the guard in storage.
4. Swaps the tokens for USDG, with your floor as the swap's minimum output.
5. Splits the proceeds and pays out.

If the swap cannot deliver your floor, the whole transaction reverts. Your
tokens stay exactly where they were.

## 3b. Withdraw

You can withdraw at any time while the guard is active, for any reason, at no
cost beyond gas. This is the same function whether you are cancelling early or
reclaiming after expiry.

Only the guard's owner can withdraw it. Not the deployer, not the fee recipient,
not anyone else. There is no address anywhere with power over your position.

## What settlement pays out

Suppose a guard settles for 3,000 USDG:

| | |
|---|---|
| Gross from the swap | 3,000.00 |
| Protocol fee, 0.15% | 4.50 |
| Keeper bounty, 0.10% | 3.00 |
| **You receive** | **2,992.50** |

Both cuts round down, so any truncation dust stays with you rather than with the
protocol or the keeper. See [Fees](fees.md).

## Guards are completely isolated

Each guard is its own escrow. There is no shared pool of funds, and no path by
which one guard's failure can touch another's. A guard that can never settle
sits there harmlessly; its owner withdraws and nothing else is affected.
