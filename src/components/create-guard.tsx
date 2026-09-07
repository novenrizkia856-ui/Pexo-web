import { useEffect, useMemo, useState } from "react";
import { MOCK_MODE, PEXO_CONFIG } from "@/config/pexo.config";
import { useProtocol } from "@/state/protocol";
import { money, quantity, toDateTimeLocal } from "@/lib/format";
import { Button } from "@/components/ui";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Create-guard flow.
 *
 * Two prices, because the contract takes two. `triggerPrice` decides when the
 * guard fires; `floorPrice` is the least it may settle for and is passed to the
 * swap as its minimum output. The gap between them is the holder's own slippage
 * budget: wide fills reliably at a worse worst case, narrow settles closer to
 * the trigger but is easier for a fast move to skip past.
 *
 * The quote shown is the position's real exit, price impact included, not the
 * mark price. A holder who cannot see what their own size costs cannot choose a
 * floor that will actually fill.
 *
 * Approval is always framed as an exact amount for this one deposit. There is
 * deliberately no unlimited-approval affordance anywhere in this component.
 */
export function CreateGuard({ onDone }: { onDone: () => void }) {
  const assets = useProtocol((s) => s.assets)();
  const markOf = useProtocol((s) => s.mark);
  const quoteOf = useProtocol((s) => s.quote);
  const slippageOf = useProtocol((s) => s.slippageBps);
  const createGuard = useProtocol((s) => s.createGuard);
  const approve = useProtocol((s) => s.approve);
  const allowanceOf = useProtocol((s) => s.allowanceOf);
  const balances = useProtocol((s) => s.balances);
  const busy = useProtocol((s) => s.status) === "pending";

  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [fee, setFee] = useState<number>(PEXO_CONFIG.defaultFeeTier);
  const [amount, setAmount] = useState("10");
  const [trigger, setTrigger] = useState("");
  const [floor, setFloor] = useState("");
  const [expiry, setExpiry] = useState(toDateTimeLocal(Date.now() + 7 * DAY));
  /** Read from the token, not remembered locally: an allowance may already exist. */
  const [allowance, setAllowance] = useState(0);

  const asset = assets.find((a) => a.id === assetId) ?? assets[0];
  const amountNumber = Number(amount);
  const balance = asset ? (balances[asset.id] ?? 0) : 0;

  // Re-read the on-chain allowance whenever the token changes or a tx lands.
  useEffect(() => {
    if (!asset || MOCK_MODE) return;
    let live = true;
    void allowanceOf(asset).then((a) => {
      if (live) setAllowance(a);
    });
    return () => {
      live = false;
    };
  }, [asset, allowanceOf, busy]);
  const triggerNumber = Number(trigger);
  const floorNumber = Number(floor);
  const expiryMs = new Date(expiry).getTime();

  const mark = asset ? markOf(asset.id) : 0;
  const validAmount = Number.isFinite(amountNumber) && amountNumber > 0;

  const exitQuote = useMemo(
    () => (asset && validAmount ? quoteOf(asset.id, amountNumber, fee) : 0),
    [asset, validAmount, amountNumber, fee, quoteOf],
  );
  const slippageBps = useMemo(
    () => (asset && validAmount ? slippageOf(asset.id, amountNumber, fee) : 0),
    [asset, validAmount, amountNumber, fee, slippageOf],
  );

  const { feeBps, keeperBountyBps, minDepositUsd, slippageWarnBps, slippageBlockBps } =
    PEXO_CONFIG.protocol;

  const protocolFee = floorNumber > 0 ? (floorNumber * feeBps) / 10_000 : 0;
  const bounty = floorNumber > 0 ? (floorNumber * keeperBountyBps) / 10_000 : 0;
  const floorNet = floorNumber > 0 ? floorNumber - protocolFee - bounty : 0;

  const problems: string[] = [];
  if (!asset) problems.push("No guardable asset is available.");
  if (!validAmount) problems.push("Enter a deposit amount.");
  if (!Number.isFinite(triggerNumber) || triggerNumber <= 0)
    problems.push("Set a trigger price.");
  if (!Number.isFinite(floorNumber) || floorNumber <= 0) problems.push("Set a floor price.");
  if (floorNumber > 0 && triggerNumber > 0 && floorNumber > triggerNumber)
    problems.push("The floor cannot be above the trigger.");
  if (triggerNumber > 0 && exitQuote > 0 && triggerNumber >= exitQuote)
    problems.push("The trigger must be below the current quote, or it fires immediately.");
  if (floorNumber > 0 && floorNumber < minDepositUsd)
    problems.push(`Minimum deposit is ${money(minDepositUsd)}.`);
  if (!MOCK_MODE && validAmount && amountNumber > balance)
    problems.push(
      `You hold ${quantity(balance)} ${asset?.symbol ?? ""}, which is less than this deposit.`,
    );
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now())
    problems.push("Expiry must be in the future.");
  if (slippageBps >= slippageBlockBps)
    problems.push(
      `This position is too large for the ${
        PEXO_CONFIG.feeTiers.find((t) => t.value === fee)?.label ?? ""
      } pool. Exiting it would cost ${(slippageBps / 100).toFixed(2)}%, which no sensible floor survives.`,
    );

  const valid = problems.length === 0;
  const warnSlippage = slippageBps >= slippageWarnBps && slippageBps < slippageBlockBps;

  /** Prefills a sane pair once the position is known. */
  function suggest() {
    if (!exitQuote) return;
    setTrigger((exitQuote * 0.97).toFixed(2));
    setFloor((exitQuote * 0.92).toFixed(2));
  }

  const approved = MOCK_MODE || allowance >= amountNumber;

  async function doApprove() {
    if (!valid || !asset) return;
    if (MOCK_MODE) {
      setAllowance(amountNumber);
      return;
    }
    try {
      await approve(asset, amountNumber);
      setAllowance(await allowanceOf(asset));
    } catch {
      // The store surfaces the reason; nothing useful to add here.
    }
  }

  async function submit() {
    if (!valid || !asset) return;
    await createGuard({
      asset,
      amount: amountNumber,
      triggerPrice: triggerNumber,
      floorPrice: floorNumber,
      fee,
      expiresAt: expiryMs,
    });
    onDone();
  }

  if (!asset) {
    return (
      <div className="pxo-card border-dashed p-8">
        <p className="text-sm text-muted">
          No guardable asset is configured. Populate{" "}
          <code className="num">PEXO_CONFIG.tokens.supportedAssets</code> to enable this flow.
        </p>
      </div>
    );
  }

  return (
    <form
      className="pxo-card flex flex-col gap-6 p-6 md:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {/* Position ------------------------------------------------------- */}
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="block">
          <span className="pxo-field-label">Asset</span>
          <select
            className="pxo-field"
            value={assetId}
            onChange={(e) => {
              setAssetId(e.target.value);
              setAllowance(0);
            }}
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.symbol} · {a.name}
              </option>
            ))}
          </select>
          <span className="pxo-field-hint">
            Mark <span className="num">{money(mark)}</span>
          </span>
        </label>

        <label className="block">
          <span className="pxo-field-label">Amount</span>
          <input
            className="pxo-field num"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <span className="pxo-field-hint">
            {MOCK_MODE ? "Held by the contract until settled." : `You hold ${quantity(balance)}`}
          </span>
        </label>

        <label className="block">
          <span className="pxo-field-label">Pool</span>
          <select
            className="pxo-field"
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
          >
            {PEXO_CONFIG.feeTiers.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="pxo-field-hint">Fixed for the life of this guard.</span>
        </label>
      </div>

      {/* What this position is actually worth on the way out -------------- */}
      <div className="pxo-card flex flex-wrap items-end justify-between gap-4 border-dashed p-5">
        <div>
          <span className="text-eyebrow uppercase tracking-[0.09em] text-faint">
            Your exit right now
          </span>
          <span className="num mt-1 block text-2xl">
            {exitQuote > 0 ? money(exitQuote) : "Enter an amount"}
          </span>
          {validAmount ? (
            <span
              className={`mt-1 block text-xs ${
                slippageBps >= slippageBlockBps
                  ? "text-danger"
                  : warnSlippage
                    ? "text-triggered"
                    : "text-faint"
              }`}
            >
              {(slippageBps / 100).toFixed(2)}% below the mark, because this position moves
              the pool on its way out
            </span>
          ) : null}
        </div>
        <Button variant="ghost" small onClick={suggest} disabled={!exitQuote}>
          Suggest prices
        </Button>
      </div>

      {warnSlippage ? (
        <p className="text-xs leading-relaxed text-triggered">
          A position this size loses {(slippageBps / 100).toFixed(2)}% just getting out. Set
          the floor with that in mind, or split it across smaller guards.
        </p>
      ) : null}

      {/* The two prices --------------------------------------------------- */}
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="block">
          <span className="pxo-field-label">Trigger price</span>
          <input
            className="pxo-field num"
            inputMode="decimal"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder={exitQuote ? (exitQuote * 0.97).toFixed(2) : "0.00"}
          />
          <span className="pxo-field-hint">Anyone may settle at or below this.</span>
        </label>

        <label className="block">
          <span className="pxo-field-label">Floor price</span>
          <input
            className="pxo-field num"
            inputMode="decimal"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder={exitQuote ? (exitQuote * 0.92).toFixed(2) : "0.00"}
          />
          <span className="pxo-field-hint">The swap cannot fill below this.</span>
        </label>

        <label className="block">
          <span className="pxo-field-label">Expiry</span>
          <input
            className="pxo-field num"
            type="datetime-local"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
          <span className="pxo-field-hint">After this it can no longer trigger.</span>
        </label>
      </div>

      {triggerNumber > 0 && floorNumber > 0 && floorNumber <= triggerNumber ? (
        <p className="text-xs leading-relaxed text-muted">
          Your settlement room is{" "}
          <span className="num">
            {(((triggerNumber - floorNumber) / triggerNumber) * 100).toFixed(2)}%
          </span>
          . Wider fills more reliably at a worse worst case; narrower settles closer to the
          trigger but a fast move can skip past it entirely.
        </p>
      ) : null}

      {/* Outcome ---------------------------------------------------------- */}
      <dl className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
        <div>
          <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">
            You receive at least
          </dt>
          <dd className="num mt-1 text-lg text-armed">
            {floorNet > 0 ? money(floorNet) : "Not set"}
          </dd>
          <dd className="mt-1 text-xs text-faint">Your floor, less the two cuts below.</dd>
        </div>
        <div>
          <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">Protocol fee</dt>
          <dd className="num mt-1 text-lg">
            {protocolFee > 0 ? money(protocolFee) : "Not set"}
          </dd>
        </div>
        <div>
          <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">Keeper bounty</dt>
          <dd className="num mt-1 text-lg">{bounty > 0 ? money(bounty) : "Not set"}</dd>
        </div>
      </dl>

      {problems.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {problems.map((problem) => (
            <li key={problem} className="text-xs text-danger">
              {problem}
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        Two explicit steps. The approval names the exact amount, and is spent
        by this deposit alone — there is no standing allowance left behind.
      */}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button
          variant="secondary"
          disabled={!valid || approved || busy}
          onClick={() => void doApprove()}
        >
          {approved
            ? `Approved ${quantity(amountNumber)} ${asset.symbol}`
            : `Approve exactly ${valid ? quantity(amountNumber) : ""} ${asset.symbol}`}
        </Button>
        <Button type="submit" variant="primary" withArrow disabled={!valid || !approved || busy}>
          {busy ? "Creating…" : "Create guard"}
        </Button>
        <p className="w-full text-xs text-faint">
          Pexo never requests an unlimited allowance. The approval above covers this deposit
          and nothing further.
        </p>
      </div>
    </form>
  );
}
