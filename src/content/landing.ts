/**
 * Every word on the landing page.
 *
 * Sections read from here, so copy review never means opening a component.
 * Anything the brief did not settle is marked [[TODO: ...]] in place rather
 * than being invented. Those strings are meant to be visible in review.
 *
 * House style: short sentences. No em dashes, no en dashes, no hyphenated
 * connectives. Where a dash would have joined two clauses, use two sentences.
 */

export const landing = {
  hero: {
    titleLines: ["Set your floor.", "Walk away."],
    subtitle:
      "Tokenized stocks trade around the clock. The market behind them does not. Name the price you want out at and the least you will accept, then walk away.",
    buttons: [
      { label: "Create a guard", href: "/app", variant: "primary" as const, withArrow: true },
      { label: "How it works", href: "#how", variant: "secondary" as const },
    ],
    scrollCue: "Scroll",
  },

  problem: {
    eyebrow: "The weekend gap",
    titleLines: ["The market closes.", "Your position doesn't."],
    body: [
      "Tokenized equities keep trading through nights, weekends and holidays. The exchange behind them is shut.",
      "Price drifts. Then the market reopens and reprices, all at once.",
    ],
  },

  how: {
    eyebrow: "How it works",
    titleLines: ["Three steps,", "then nothing."],
    steps: [
      {
        index: "01",
        title: "Deposit and set a floor",
        body: "Pick an asset and an amount. Set the price you want out at, and the least you will accept.",
      },
      {
        index: "02",
        title: "The contract watches",
        body: "Pool price is read onchain. Nothing sits in between.",
      },
      {
        index: "03",
        title: "Settle or withdraw",
        body: "Reach your trigger and it settles, never under your floor. Never reach it and you withdraw free.",
      },
    ],
  },

  guarantees: {
    eyebrow: "What is actually guaranteed",
    titleLines: ["The floor is not a promise.", "It's the transaction."],
    lead: "The guarantee is structural. It holds because of how settlement is built, not because of a policy.",
    items: [
      {
        title: "Your floor is the minimum output",
        body: "Your floor is passed to the swap as its minimum acceptable output. If the swap cannot return it, the transaction reverts and your tokens stay put. Settling below your floor is not a risk that gets managed. It is a transaction that cannot succeed. You receive that floor less the 0.15% protocol fee and the 0.10% keeper bounty.",
        weight: "primary" as const,
      },
      {
        title: "No oracle",
        body: "Price comes from the pool itself, read at settlement. There is no feed to lag, stall, or be pushed into triggering you.",
        weight: "secondary" as const,
      },
      {
        title: "Noncustodial",
        body: "The contract holds your deposit while the guard is open. Pexo never takes possession of it.",
        weight: "secondary" as const,
      },
      {
        title: "Two prices, not one",
        body: "You set the price that fires the guard and the least you will accept for it. The gap between them is yours to choose: wide fills more reliably at a worse worst case, narrow settles closer to your trigger but a fast move can skip past it. If price falls straight through your floor, the guard does not settle and you keep the tokens.",
        weight: "secondary" as const,
      },
      {
        title: "No admin keys",
        body: "Four functions change state, and three of them are yours: create, settle, withdraw. There is no owner, no pause, no upgrade path, and no setter. The compiled contract contains no self destruct and no delegate call. Verify it yourself on the explorer once it is live.",
        weight: "secondary" as const,
      },
    ],
  },

  assets: {
    eyebrow: "Supported assets",
    titleLines: ["Guardable instruments."],
    lead: "Tokenized equities and index products on Robinhood Chain.",
    emptyTitle: "Registry not yet published",
    emptyBody:
      "Supported assets are read from protocol config. They appear here once the contract is live on mainnet.",
  },

  /**
   * The Pexo token contract address.
   *
   * Deliberately worded to keep it separate from the guard protocol. The two
   * are unrelated systems and the copy must not imply otherwise.
   */
  ca: {
    eyebrow: "Token",
    titleLines: ["Contract address."],
    lead: "The Pexo token is separate from the guard protocol. The guard system does not read, hold, or settle it.",
    label: "PEXO token",
    pending: "Coming soon",
    pendingNote: "Published here the moment it deploys.",
    copyLabel: "Copy contract address",
    copiedLabel: "Copied",
  },

  keeper: {
    eyebrow: "Open participation",
    titleLines: ["Anyone can trigger.", "That is the design."],
    body: [
      "Once price reaches a floor, any address can settle the guard and take the bounty.",
      "No allowlist. No registration. If settling pays, someone will.",
    ],
    button: { label: "How settlement works", href: "/docs/keepers" },
  },

  footer: {
    wordmark: "Pexo",
    tagline: "Downside floors for tokenized stocks.",
    /**
     * Only destinations that exist. Source and socials are deliberately absent
     * until they do: a disabled link still tells a visitor the thing is missing,
     * and there is no reason to advertise that.
     */
    columns: [
      {
        title: "Protocol",
        links: [
          { label: "Documentation", href: "/docs" },
          { label: "How it works", href: "/docs/how-it-works" },
          { label: "The floor guarantee", href: "/docs/the-floor-guarantee" },
        ],
      },
      {
        title: "Reference",
        links: [
          { label: "Contract", href: "/docs/contract-reference" },
          { label: "Deployment", href: "/docs/deployment" },
          { label: "Risks", href: "/docs/risks" },
        ],
      },
    ],
    disclaimer:
      "Pexo is noncustodial. Using it means interacting with a smart contract directly. Nothing here is financial advice.",
  },
} as const;
