---
title: Contract reference
description: Every function, event, and error on the deployed contract.
---

# Contract reference

`Pexo.sol`, Solidity 0.8.28, deployed at
[`0x765ec7b94587E5573c5E467Ef07458953Cd09911`](https://robinhoodchain.blockscout.com/address/0x765ec7b94587E5573c5E467Ef07458953Cd09911).

There is no admin function on this page because there is no admin. See
[Deployment](deployment.md).

## State changing

### createGuard

```solidity
function createGuard(
    address token,
    uint24  fee,
    uint256 amount,
    uint256 triggerPrice,
    uint256 floorPrice,
    uint64  expiry
) external returns (uint256 guardId)
```

Escrows `amount` of `token` and opens a guard over it.

| Parameter | Notes |
|---|---|
| `token` | Must be on the immutable allowlist |
| `fee` | V3 fee tier, pinned for this guard's lifetime |
| `amount` | Token base units. 18 decimals for the listed stocks |
| `triggerPrice` | USDG base units (**6 decimals**), for the whole position |
| `floorPrice` | USDG base units. Must be at or below `triggerPrice` |
| `expiry` | Unix seconds, must be in the future |

Requires an ERC-20 approval for exactly `amount` beforehand. The transfer is
verified by balance delta rather than by the return value, so a fee on transfer
token reverts with `TransferAmountMismatch` instead of silently under escrowing.

The fee tier is fixed at creation deliberately. If the contract could pick a pool
at settlement time, an attacker could steer the trade into whichever tier they
had made cheapest to move.

### trigger

```solidity
function trigger(uint256 guardId) external
```

Settles a guard into USDG. Callable by anyone. Requires `quote <= triggerPrice`
and the guard to be active and unexpired.

Passes `floorPrice` to the router as `amountOutMinimum`, splits the proceeds
0.15% / 0.10% / remainder, and pays the caller the bounty.

Costs roughly two swaps of gas, because QuoterV2 prices the trade by executing
it. Measured at 369k to 433k depending on how many ticks are crossed.

### withdraw

```solidity
function withdraw(uint256 guardId) external
```

Closes the guard and returns the original tokens. Owner only, no fee, available
whenever the guard is active, before or after expiry.

## Reads

### guardStatus

```solidity
function guardStatus(uint256 guardId) external returns (
    uint256 currentSpotOutput,
    uint256 triggerPrice,
    uint256 floorPrice,
    bool    triggerable,
    bool    expired
)
```

Everything needed to judge one guard. **Not `view`**. See [Keepers](keepers.md)
for why, and why it does not matter off chain.

Never reverts. If the pool cannot be quoted, `currentSpotOutput` is zero and
`triggerable` is false, so a missing pool reads as "cannot act" rather than
breaking the caller.

### Other reads

| Function | Returns |
|---|---|
| `guards(uint256)` | The full stored guard |
| `nextGuardId()` | Id the next guard will take |
| `isAllowedToken(address)` | Allowlist membership |
| `allowedTokens(uint256)`, `allowedTokensLength()` | The allowlist itself |
| `totalEscrowed(address)` | Escrow per token, for asserting the invariant |
| `poolExists(address,uint24)` | Genuinely `view`; touches the factory, not the quoter |
| `PROTOCOL_FEE_BPS`, `KEEPER_BOUNTY_BPS` | `15` and `10`, both `constant` |
| `swapRouter`, `quoter`, `uniswapFactory`, `usdg` | `immutable` |
| `feeRecipient`, `minDepositUsdEquivalent` | `immutable` |

## Events

```solidity
event GuardCreated(
    uint256 indexed guardId,
    address indexed owner,
    address indexed token,
    uint24  fee,
    uint256 amount,
    uint256 triggerPrice,
    uint256 floorPrice,
    uint64  expiry
);

event GuardTriggered(
    uint256 indexed guardId,
    address indexed keeper,
    uint256 amountOut,
    uint256 fee,
    uint256 bounty,
    uint256 ownerAmount
);

event GuardWithdrawn(
    uint256 indexed guardId,
    address indexed owner,
    uint256 amount
);
```

`owner` is indexed on `GuardCreated`, which is how the interface finds your
guards without an on chain enumeration.

## Errors

Constructor:

| Error | Meaning |
|---|---|
| `ZeroAddress()` | A required address argument was zero |
| `EmptyAllowlist()` | No collateral tokens supplied |
| `DuplicateAllowedToken(address)` | Allowlist contained a repeat |
| `TokenIsUsdg()` | The settlement token appeared in the allowlist |

`createGuard`:

| Error | Meaning |
|---|---|
| `TokenNotAllowed(address)` | Not on the allowlist |
| `ZeroAmount()` | `amount` was zero |
| `FloorAboveTrigger(uint256,uint256)` | Floor exceeded trigger |
| `FloorBelowMinimum(uint256,uint256)` | Below the minimum deposit |
| `ExpiryInPast(uint64,uint256)` | Expiry already passed |
| `PoolDoesNotExist(address,uint24)` | No V3 pool at that fee tier |
| `TransferAmountMismatch(uint256,uint256)` | Received less than requested |

`trigger` and `withdraw`:

| Error | Meaning |
|---|---|
| `GuardNotActive(uint256)` | Already settled or withdrawn |
| `GuardExpired(uint256,uint64)` | Past expiry; withdraw instead |
| `NotGuardOwner(uint256,address)` | Only the owner may withdraw |
| `TriggerConditionNotMet(uint256,uint256)` | Quote is still above the trigger |
| `SettlementBelowFloor(uint256,uint256)` | Defence in depth behind the router |

The interface decodes all of these, so a failed transaction reads as a sentence
rather than a selector.
