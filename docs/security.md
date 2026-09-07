---
title: Security
description: What has been tested, what was found, and what has not been done.
---

# Security

## The headline, first

**Pexo has not been audited by an external firm.** Everything on this page is
self review by the people who wrote the contract, plus automated tooling. That
is worth something and it is not worth the same as an independent audit. Size
your positions accordingly.

## Structural properties

These are the properties that come from the shape of the contract rather than
from testing, so they hold regardless of how thorough the tests are.

**No privileged role exists.** No owner, no admin, no pause, no upgrade, no
setter. Not disabled, not behind a timelock, not held by a multisig. Absent from
the ABI.

**No oracle is read.** Prices come from the Uniswap pool the trade will actually
execute against, so there is no feed to manipulate, no staleness window, and no
dependency on a third party remaining online.

**Fees are `constant`.** 0.15% and 0.10% are compile time values.

**The allowlist is immutable.** Written once in the constructor with no setter.

**Approvals are exact.** The interface never requests an unlimited allowance.
The approval it asks for is for the amount you are escrowing and nothing more.

**Reentrancy is guarded.** Every state changing function carries
`nonReentrant`, and the contract follows checks-effects-interactions strictly:
in `trigger`, the guard is closed and removed from escrow accounting before the
quoter or the router is touched.

**Token handling is defensive.** OpenZeppelin `SafeERC20` throughout, and
`createGuard` measures the balance delta rather than trusting a return value, so
a fee on transfer token reverts rather than silently under escrowing.

## Testing

| | |
|---|---|
| Tests | 78, all passing |
| Suites | unit, security, fuzz, invariant, fork, deployment rehearsal, mechanism proof |
| Static analysis | Slither |
| Fork testing | Against live Robinhood Chain state |

The invariant suite runs with `fail_on_revert = true`. This matters: an earlier
revision ran with it false and was passing over an empty state space, because
every guard creation was silently reverting and the invariants held vacuously
over zero guards. A coverage assertion now fails the suite if the handler stops
producing state.

`test/MechanismProof.t.sol` exists specifically to prove the two price design is
necessary, by sweeping the parameter range and showing the single price version
has exactly one executable point. See [Two prices](two-prices.md).

## Self audit findings

Thirteen findings. Two critical, both fixed before deployment.

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Critical | The originally specified trigger rule made settlement mathematically unreachable | Fixed, two price design |
| 5a | Critical | Settling on Uniswap V2 would have made every guard unsettleable | Fixed, migrated to V3 |
| 2 | High | A reverting `feeRecipient` would brick every settlement | Accepted, deployment constraint |
| 3 | Medium | The owner receives the floor less 0.25%, not the floor exactly | Accepted, documented |
| 4 | Medium | A gap straight through the floor leaves a guard unsettleable | Accepted, inherent |
| 5 | Medium | The invariant suite was passing over an empty state space | Fixed |
| 5b | Medium | USDG has 6 decimals; the config assumed 18 | Fixed |
| 5c | Medium | The bounty may not cover trigger gas at a low minimum deposit | Accepted, drove the $2,000 minimum |
| 5d | Medium | Pool depth caps the position size that can settle near its floor | Accepted, disclosed |
| 6 | Low | Blocklisting USDG could stall a specific guard | Accepted |
| 7 | Low | The minimum bounds the floor, not position value | Accepted |
| 8 | Low | Fee on transfer tokens are refused outright | Accepted, by design |
| 9 | Info | Router return value deliberately ignored | Accepted, by design |
| 10 | Info | `block.timestamp` used for expiry comparisons | Accepted |

The full write up, with reasoning for each acceptance, lives in
`audit/self-audit.md` in the contract repository.

### The two accepted findings worth reading

**Finding 2, High.** `feeRecipient` is `immutable`. If that address were a
contract that reverts on receiving USDG, every settlement in the protocol would
revert with it. It is mitigated by the deployment constraint that the recipient
be a plain externally owned account, which it is. It is not mitigated in code,
because mitigating it would mean adding a setter, and a setter is a privileged
function.

**Finding 4, Medium.** If the price gaps from above your trigger to below your
floor in a single move with no keeper acting in between, no settlement is
possible, because the swap cannot deliver the floor. Your tokens stay yours and
withdrawable. This is not a bug that can be fixed; it is the boundary of what an
on chain floor can promise. [The floor guarantee](the-floor-guarantee.md)
explains it properly.

## What has not been done

- No external audit
- No bug bounty programme
- **No guard has been created on mainnet yet.** The contract is deployed and
  verified, but the create-and-settle path has never been exercised against live
  liquidity by a real position. Every test of it is local or forked.

That last point is the honest state of the deployment as of writing. Treat the
first real guard as the smoke test it is.
