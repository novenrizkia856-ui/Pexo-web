---
title: Deployment
description: Addresses, parameters, and how to check them yourself.
---

# Deployment

## The contract

| | |
|---|---|
| Address | `0x765ec7b94587E5573c5E467Ef07458953Cd09911` |
| Chain | Robinhood Chain, id **4663** |
| Deployed in block | 56,477,524 |
| Deployment transaction | `0xa1c90b87e36cbaf661fed3c635eff5066aef2f7aa907aeae245ef8ab029404ca` |
| Gas used | 1,586,265 |
| Compiler | `v0.8.28+commit.7893614a`, optimizer on, 200 runs, no viaIR |
| EVM version | prague |
| License | MIT |
| Verification | Exact match on Blockscout |

[View on Blockscout](https://robinhoodchain.blockscout.com/address/0x765ec7b94587E5573c5E467Ef07458953Cd09911)

## Constructor arguments

Every one of these is `immutable`. They were fixed at deployment and no
transaction can change any of them.

| Argument | Value |
|---|---|
| `swapRouter` | `0xCaf681a66D020601342297493863E78C959E5cb2` |
| `quoter` | `0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7` |
| `uniswapV3Factory` | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` |
| `usdg` | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| `minDepositUsdEquivalent` | `2000000000` (that is $2,000 at 6 decimals) |
| `feeRecipient` | `0x28d836E46c698Ccc530B4D981b089eC14bE39757` |

## The allowlist

Three tokens, fixed forever. Adding a fourth requires deploying a new contract.

| Symbol | Address | Decimals |
|---|---|---|
| AAPL | `0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9` | 18 |
| TSLA | `0x322F0929c4625eD5bAd873c95208D54E1c003b2d` | 18 |
| NVDA | `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC` | 18 |

All three were confirmed on chain as 18 decimal ERC-20s with a live 0.05% V3
pool against USDG.

## Settlement token

USDG, the Global Dollar, at `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. Read
back from the chain: `name() == "Global Dollar"`, `symbol() == "USDG"`,
`decimals() == 6`.

**Six decimals.** This is the single most common source of error when
integrating. An 18 decimal assumption inflates every USDG amount by a factor of
a trillion.

## Why V3 and not V2

V2 pairs for these tokens exist on Robinhood Chain, and they hold dust. Measured
against the live pools:

| Venue | One AAPL sells for |
|---|---|
| Uniswap V3, 0.05% tier | **$321.76** |
| Uniswap V2 pair | **$0.0086** |

A protocol settling on V2 would price every position at essentially zero, and no
guard would ever be able to fill above its floor. The swap layer is V3 for that
reason.

## What nobody can do

The deployed ABI contains **no owner, no admin, no pause, no upgrade, and no
setter of any kind.** This is not a policy choice enforced by a multisig; the
functions do not exist.

The deployed runtime bytecode was scanned and contains **zero** occurrences of
`SELFDESTRUCT`, `DELEGATECALL`, `CALLCODE`, `CREATE`, and `CREATE2`. There is no
proxy, no implementation slot, and no path to replace the code.

The one thing the deploying key retains is a permanent claim on protocol
revenue: `feeRecipient` is the deployer's own address. That address collects
0.15% of every settlement forever and cannot be changed. It has no power over
guards, escrow, or user funds, but you should know it exists.

## Checking this yourself

Do not take the table above on trust. Read it off the chain:

```bash
cast call 0x765ec7b94587E5573c5E467Ef07458953Cd09911 "usdg()(address)" \
  --rpc-url https://rpc.mainnet.chain.robinhood.com
```

```bash
cast call 0x765ec7b94587E5573c5E467Ef07458953Cd09911 "minDepositUsdEquivalent()(uint256)" \
  --rpc-url https://rpc.mainnet.chain.robinhood.com
```

```bash
cast call 0x765ec7b94587E5573c5E467Ef07458953Cd09911 "PROTOCOL_FEE_BPS()(uint16)" \
  --rpc-url https://rpc.mainnet.chain.robinhood.com
```

To confirm the code matches the published source, build the repository at the
pinned compiler version and compare the runtime bytecode, masking the immutable
slots. That comparison was run before this documentation was written and the two
were identical everywhere the template is non-zero.

The interface performs a smaller version of this check on load, reading the fee
constants, USDG address, and minimum deposit from the contract and refusing to
show numbers if its own configuration disagrees.

## Network

| | |
|---|---|
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Chain id | 4663 |
| Explorer | `https://robinhoodchain.blockscout.com` |
| Native token | ETH |
| Multicall3 | `0xca11bde05977b3631167028862be2a173976ca11` |

Robinhood Chain is an Arbitrum Orbit L2. Gas is paid in ETH and observed at
around 0.363 gwei, which is what the keeper economics in [Fees](fees.md) are
derived from.
