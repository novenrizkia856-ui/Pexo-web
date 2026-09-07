---
title: Fees
description: What comes out of a settlement, who receives it, and what is free.
---

# Fees

## What is free

**Creating a guard.** No protocol fee. You pay gas.

**Withdrawing.** No protocol fee, ever, whether you are cancelling early or
reclaiming after expiry. You pay gas.

Pexo only charges when it actually does something for you.

## What a settlement costs

| | Rate | Goes to |
|---|---|---|
| Protocol fee | 0.15% | The fee recipient fixed at deployment |
| Keeper bounty | 0.10% | Whoever called `trigger` |
| **Total** | **0.25%** | |

Both are `constant` in the contract. Not owner-adjustable, not upgradeable, not
governed. They are fixed at compile time and no address can change them.

## Worked example

A guard on 10 AAPL settling at 3,200 USDG:

```
gross from the swap        3,200.000000
  protocol fee   0.15%        -4.800000
  keeper bounty  0.10%        -3.200000
                            ------------
you receive                3,192.000000
```

## Rounding

Both cuts are computed with integer division and truncate downward, exactly as
the contract does:

```solidity
uint256 protocolFee = (received * 15) / 10_000;
uint256 bounty      = (received * 10) / 10_000;
uint256 ownerAmount = received - protocolFee - bounty;
```

The owner's share is what remains after both, so **every wei of truncation dust
accrues to you**, never to the protocol or the keeper. The three parts sum
exactly to the amount received; the contract retains nothing.

This is asserted at the wei level in the test suite, and over the full `uint128`
range as a property test.

## USDG has six decimals

Worth stating plainly because it has bitten this project already. USDG on
Robinhood Chain reports `decimals() == 6`, not 18.

```
$1.00        = 1000000
$2,000.00    = 2000000000
```

Every USDG-denominated figure — your trigger, your floor, the minimum deposit —
is in those units. An 18-decimal assumption inflates an amount by a factor of a
trillion.

## The minimum deposit

There is a minimum floor price, fixed at deployment. It exists for a reason
worth understanding rather than treating as a formality.

Settlement is done by keepers who pay gas out of their own pocket and are repaid
only by the bounty. The bounty scales with your position; gas does not. Below a
certain size, settling a guard costs a keeper more than it pays, and **nobody
will ever settle it**.

The current deployment sets the minimum at **$2,000**, derived from measured
numbers:

| | |
|---|---|
| Measured cost of a `trigger` | ~370,000–433,000 gas |
| Budget allowing for tick crossing | 500,000 gas |
| Gas price observed | 0.363 gwei |
| ETH price from the WETH/USDG pool | $2,513.85 |
| Cost of one settlement | ~$0.46 |
| Bounty at a $2,000 floor | $2.00, covering it 4.4x |

An earlier revision of this figure assumed 0.1 gwei and set the minimum at $500,
which is barely break-even at real gas prices. The number is a function of
network conditions, not a constant.
