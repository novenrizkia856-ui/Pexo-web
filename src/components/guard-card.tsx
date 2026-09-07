import { PEXO_CONFIG } from "@/config/pexo.config";
import {
  bountyOn,
  effectiveStatus,
  floorNetOfCuts,
  headroom,
  isStranded,
  isTriggerable,
  type Guard,
} from "@/lib/guards";
import { dateLabel, money, percent, quantity, untilLabel } from "@/lib/format";
import { Button } from "@/components/ui";

const STATE_LABEL = {
  armed: "Armed",
  triggered: "Settled",
  expired: "Expired",
} as const;

export function GuardCard({
  guard,
  quote,
  busy,
  onTrigger,
  onWithdraw,
}: {
  guard: Guard;
  /** The position's real exit quote, price impact included. */
  quote: number;
  busy: boolean;
  onTrigger: (id: string) => void;
  onWithdraw: (id: string) => void;
}) {
  const status = effectiveStatus(guard);
  const gap = headroom(guard, quote);
  const triggerable = isTriggerable(guard, quote);
  const stranded = isStranded(guard, quote);
  const { feeBps, keeperBountyBps } = PEXO_CONFIG.protocol;
  const netFloor = floorNetOfCuts(guard, feeBps, keeperBountyBps);
  const bounty = bountyOn(guard, keeperBountyBps);
  const tier = PEXO_CONFIG.feeTiers.find((t) => t.value === guard.fee)?.label ?? "";

  // Distance from the trigger, clamped to a readable range for the meter.
  const meter = Math.max(0, Math.min(1, gap / 0.25));

  return (
    <article className="pxo-card pxo-glow pxo-card-lift flex flex-col gap-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="num grid size-9 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold text-on-accent"
            style={{ background: guard.asset.accent }}
          >
            {guard.asset.symbol.slice(0, 2)}
          </span>
          <div>
            <h3 className="num text-base font-medium">{guard.asset.symbol}</h3>
            <p className="text-xs text-faint">
              {quantity(guard.amount)} · <span className="num">{guard.id}</span> · {tier}
            </p>
          </div>
        </div>
        <span className={`pxo-state pxo-state-${status}`}>{STATE_LABEL[status]}</span>
      </header>

      {status === "triggered" ? (
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">Settled for</dt>
            <dd className="num mt-1 text-lg">
              {money(guard.settledAmount ?? guard.floorPrice)}
            </dd>
          </div>
          <div>
            <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">Settled by</dt>
            <dd className="num mt-1 truncate text-lg">{guard.settledBy ?? "Unknown"}</dd>
          </div>
        </dl>
      ) : (
        <>
          {/* Two by two. Four currency columns collide in a card this narrow. */}
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
            <div>
              <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">Exit</dt>
              <dd className="num mt-1 text-base">{money(quote)}</dd>
            </div>
            <div>
              <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">Trigger</dt>
              <dd className="num mt-1 text-base">{money(guard.triggerPrice)}</dd>
            </div>
            <div>
              <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">Floor</dt>
              <dd className="num mt-1 text-base text-armed">{money(guard.floorPrice)}</dd>
            </div>
            <div>
              <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">
                {status === "expired" ? "Expired" : "Expires"}
              </dt>
              <dd className="num mt-1 text-base">
                {status === "expired"
                  ? dateLabel(guard.expiresAt)
                  : untilLabel(guard.expiresAt)}
              </dd>
            </div>
          </dl>

          {/* Headroom above the trigger. Empty means the trigger is reached. */}
          <div>
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-paper-sunk"
              role="img"
              aria-label={`Exit quote is ${percent(gap)} relative to the trigger`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${
                  stranded ? "bg-danger" : triggerable ? "bg-triggered" : "bg-armed"
                }`}
                style={{ width: `${Math.max(2, meter * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-faint">
              {stranded ? (
                <span className="text-danger">
                  Below the floor. Nothing can settle it, and nothing can settle it low
                  either. Withdraw or wait for the price to recover.
                </span>
              ) : triggerable ? (
                <span className="text-triggered">At or below the trigger. Settleable now.</span>
              ) : (
                <>
                  <span className="num">{percent(gap)}</span> above the trigger
                </>
              )}
            </p>
          </div>
        </>
      )}

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {status === "armed" ? (
          <>
            <Button
              variant={triggerable && !stranded ? "primary" : "secondary"}
              small
              disabled={!triggerable || stranded || busy}
              onClick={() => onTrigger(guard.id)}
            >
              {stranded
                ? "Cannot fill"
                : triggerable
                  ? `Settle · earn ${money(bounty)}`
                  : "Not settleable"}
            </Button>
            <Button variant="ghost" small disabled={busy} onClick={() => onWithdraw(guard.id)}>
              Withdraw
            </Button>
            <span className="ml-auto text-xs text-faint">
              You get ≥ <span className="num">{money(netFloor)}</span>
            </span>
          </>
        ) : (
          <Button variant="secondary" small disabled={busy} onClick={() => onWithdraw(guard.id)}>
            {status === "triggered" ? "Claim USDG" : "Withdraw tokens"}
          </Button>
        )}
      </footer>
    </article>
  );
}
