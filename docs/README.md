---
title: Introduction
description: What Pexo is, and the one idea the whole protocol rests on.
---

# Pexo

Pexo puts a floor under a tokenized stock position, without taking custody of it.

You deposit a tokenized equity, name the price at which you want out, and name
the least you will accept. Then you walk away. If the price falls to your
trigger, anyone can settle the position into USDG on your behalf and collect a
small bounty for doing it. If it never falls that far, you withdraw the original
tokens whenever you like, for free.

There are three functions that change anything: `createGuard`, `trigger`,
`withdraw`. There is no fourth.

## The problem it solves

Tokenized equities trade on chain around the clock. The exchange behind them does
not. Through nights, weekends and market holidays, NYSE and Nasdaq are shut while
the token keeps trading on thin liquidity.

Price drifts during that window. Then the real market reopens and reprices, all
at once. Until now the only defences were to watch the market yourself, or to
close the position entirely and give up the exposure.

## The one idea

Your floor price is passed to the swap as its `amountOutMinimum`.

That single detail is the whole design. It means the floor is not a promise the
protocol makes and then tries to keep. It is a condition of the transaction
itself. A settlement below your floor is not a risk that gets managed, bounded,
or priced. It is a transaction that cannot be included in a block.

Everything else in these docs follows from that.

## What Pexo does not do

It is worth being clear about this early, because a floor sounds like a stronger
promise than it is.

- **It cannot guarantee execution.** If price falls straight through your floor
  between two blocks, no keeper can settle, and the guard simply stays escrowed
  until you withdraw. See [Risks](risks.md).
- **It is not a stop loss with a counterparty.** Nobody is obliged to take the
  other side. Settlement happens against a DEX pool or not at all.
- **It does not predict anything.** There is no oracle, no model, no view on
  where price is going.

## Where to go next

| | |
|---|---|
| [How it works](how-it-works.md) | The lifecycle of a guard, start to finish |
| [The floor guarantee](the-floor-guarantee.md) | Why the floor holds, derived rather than asserted |
| [Two prices](two-prices.md) | Why trigger and floor are separate numbers |
| [Fees](fees.md) | What comes out of a settlement, and who gets it |
| [Keepers](keepers.md) | Settling other people's guards for the bounty |
| [Contract reference](contract-reference.md) | Every function, event and error |
| [Deployment](deployment.md) | Addresses, and how to verify them yourself |
| [Security](security.md) | What was reviewed, and what was found |
| [Risks](risks.md) | Read this one before depositing anything |
