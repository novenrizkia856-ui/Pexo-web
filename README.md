# Pexo — web

Non-custodial downside floors for tokenized stocks on Robinhood Chain.

A holder deposits a tokenized equity, sets a floor price and an expiry, and
walks away. If the on-chain price reaches the floor, anyone can trigger the
settlement into USDG and collect a bounty. The floor doubles as the swap's
minimum output, so settling below it is not a managed risk — it is a
transaction that cannot succeed. If the price never reaches the floor, the
holder withdraws the original tokens for free.

## Status

**Live.** The app talks to the deployed contract on Robinhood Chain.

| | |
|---|---|
| Contract | [`0x765ec7b94587E5573c5E467Ef07458953Cd09911`](https://robinhoodchain.blockscout.com/address/0x765ec7b94587E5573c5E467Ef07458953Cd09911?tab=contract) |
| Deployed | block 56,477,524 |
| Source | verified on Blockscout, exact match |
| `MOCK_MODE` | **off** (derived: `gapGuard` is a real address) |

**No guard has been created on mainnet yet.** The guard list, settle and
withdraw paths have been exercised against a mainnet fork and read correctly
against the live chain, but nothing has run end to end with real funds. Do the
smoke test before pointing anyone at this.

## Stack

| | |
|---|---|
| Build | Vite 5 (static output, no SSR) |
| Chain | viem, loaded only on `/app` |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| Motion | CSS transitions for reveals, react-spring for continuous motion |
| 3D | three.js (landing backdrop, lazy-loaded) |
| State | Zustand |
| Routing | react-router-dom |

## Commands

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview    # serve the built output
npm run typecheck
```

## Configuration

Everything on-chain lives in one file: [`src/config/pexo.config.ts`](src/config/pexo.config.ts).

No address, RPC URL, chain id, or protocol parameter may be inlined anywhere
else. Every value currently marked `TODO` is a deliberate placeholder.

Verified Robinhood Chain values — real RPC, explorer, and tokenized stock
addresses — are held in [`docs/CHAIN-NOTES.md`](docs/CHAIN-NOTES.md) rather than
in the config, so they get re-confirmed against mainnet at deploy time instead
of being trusted silently.

### Talking to the chain

Reads go over the public RPC with a plain HTTP client, so the page can show
contract state before a wallet is connected. Writes need the injected provider.

Three things about this were not obvious and cost time:

- **Multicall3 must be declared on the chain definition.** Without it viem
  refuses to batch and throws `ChainDoesNotSupportContract`, then retries in a
  way that surfaces as unrelated looking CORS errors. It is deployed on this
  chain at the canonical `0xca11bde0…76ca11`.
- **`guardStatus` is not a `view` function and cannot be.** Pricing a Uniswap V3
  trade needs QuoterV2, which executes a swap and recovers the answer from the
  revert, and that is unreachable through `STATICCALL`. It is called with
  `simulateContract`, which is `eth_call` and costs nothing.
- **There is no per-owner getter on the contract.** Guards are discovered from
  `GuardCreated` logs with `owner` as an indexed topic, then read individually
  for current state. The event says a guard once existed; `guards()` says what
  it is now.

### Config drift is checked at runtime

The allowlist, settlement currency, minimum deposit and fee constants are all
immutable on chain but duplicated in config so the UI can render without a round
trip. `findConfigDrift()` compares them against the contract when the app route
mounts and surfaces any mismatch in the error banner.

A build pointed at the wrong deployment, or with a hand edited constant the
contract actually fixes, would otherwise show numbers that quietly disagree with
what a transaction will do.

### MOCK_MODE

`MOCK_MODE` is derived, not hand-set:

```ts
export const MOCK_MODE =
  PEXO_CONFIG.contracts.gapGuard === "0x000…000";
```

While the guard contract is the zero address, it is forced on, so the app can
never silently attempt a real call against a placeholder. Every action in
[`src/state/protocol.ts`](src/state/protocol.ts) checks it and throws a pointed
error if a live path is reached before it exists.

Wiring the real contract means replacing the bodies of the actions in that one
store. No component needs to change.

### The Pexo token (CA)

`PEXO_CONFIG.token` is deliberately separate from `PEXO_CONFIG.contracts`.
The token is **not part of the protocol**: the guard system does not read,
hold, or settle it, and no app logic depends on it.

The address itself lives in [`src/config/token-address.ts`](src/config/token-address.ts),
alone, so publishing it at launch is a one line diff. While it is `null` the
hero row publishes a "Coming soon" state and the copy control renders but stays
inert. Set it and the same row shows the address, enables copy, and links it to
the explorer. Nothing else changes.

### Before deploying this frontend

- [ ] Run the contract smoke test first. Shipping a UI to a contract that has
      never settled once on mainnet moves that risk onto whoever uses it first.
- [ ] Confirm `minDepositUsd` here still matches `minDepositUsdEquivalent` on
      chain. The runtime check catches a mismatch, but catching it before deploy
      is better.
- [ ] Fill the `TODO_*_URL` links in `src/content/landing.ts`, or accept that
      they render as visibly disabled.

**Publishing the token address** is one line, on purpose: set
`PEXO_TOKEN_ADDRESS` in [`src/config/token-address.ts`](src/config/token-address.ts),
commit, push. The hero switches from "Coming soon" to the address, enables the
copy button, and links it to the explorer. Nothing else is edited. Paste the
mixed case form the explorer shows; anything that is not `0x` plus 40 hex
characters is refused, loudly in development and by staying on "Coming soon" in
production, rather than published broken.

### Deploying

Zero config on Vercel: static output in `dist/`, `vercel.json` sets the SPA
rewrite that `/app` needs. No server runtime and no API routes.

**Set two environment variables in the Vercel project:**

```
VITE_SITE_URL                  = https://your-deployed-origin
VITE_WALLETCONNECT_PROJECT_ID  = your Reown project id
```

`og:image` must be an absolute URL, so it can only be written once the origin is
known. Without `VITE_SITE_URL` the image tags are omitted and the Twitter card
degrades to `summary`, which is correct: `summary_large_image` pointing at
nothing renders as an empty box wherever the link is shared.

`VITE_WALLETCONNECT_PROJECT_ID` comes from [Reown](https://dashboard.reown.com).
Without it the app still builds and runs, and simply does not offer the
WalletConnect connector; only an injected extension can connect. The id is
public — it ships in the bundle by design — and is scoped by the **Allowed
domains** list on the project, so add every origin that serves this build,
including Vercel preview domains if pairing should work there.

Both are read at build time, not at runtime. Changing either one needs a
redeploy; setting it does nothing to a build that already exists.

## Deploying

Static output, zero-config on Vercel. `vercel.json` sets the build command,
output directory, and the SPA rewrite that `/app` needs on a static host.

There is no server runtime and no API route. Both environment variables are
optional to build: each one only turns a feature on, and the build succeeds
without either. See [Deploying](#deploying) above for what each one enables.

## Conventions

- **Copy** lives in [`src/content/landing.ts`](src/content/landing.ts), not in
  components. Anything unresolved is marked `[[TODO: …]]` in place so it is
  visible in review rather than quietly shipped.
- **Placeholders render as placeholders.** A `TODO_` href renders disabled, and
  a zero contract address renders as "Contract not deployed" — never as a
  plausible-looking value.
- **Approvals are always exact-amount.** There is no unlimited-approval
  affordance anywhere in the UI or its copy.
- **Colour carries meaning.** The base palette is a neutral graphite scale; hue
  is reserved for guard state (armed / triggered / expired), so a colour on
  screen always means something.
- **Motion is CSS driven.** Entrances are one shot CSS transitions, not a JS
  animation loop, so the compositor runs them and nothing depends on
  `requestAnimationFrame`. Only the 3D backdrop and the pointer glow use rAF.
- **Component CSS lives in `@layer components`.** Tailwind v4 emits utilities
  into `@layer utilities`, and unlayered CSS beats any layered rule regardless
  of specificity — so unlayered component classes would silently defeat every
  utility applied alongside them.
#   P e x o - w e b 
 
 