/**
 * The product, drawn once.
 *
 * A price path falls toward a floor and flattens onto it. The dashed
 * continuation shows where the same price went without a guard under it. The
 * shaded band below the floor is the region a guarded position cannot reach.
 *
 * Everything animates in CSS. There is no animation loop and no
 * requestAnimationFrame, so it keeps working in a background tab and costs
 * nothing per frame on the main thread.
 */

const FLOOR_Y = 268;

/** Guarded: falls, meets the floor, then runs along it. */
const GUARDED =
  "M 60 126 C 104 96 132 152 172 140 C 212 128 240 96 282 112 " +
  "C 324 128 348 178 390 170 C 432 162 456 118 498 148 " +
  "C 538 176 560 244 604 268 L 844 268";

/** Unguarded: the same path, carrying on through the floor. */
const UNGUARDED = "M 604 268 C 648 292 690 330 740 336 L 844 340";

export function GuardChart() {
  return (
    <svg
      viewBox="0 0 880 380"
      className="pxo-chart block h-auto w-full"
      role="img"
      aria-label="A price path falling to a set floor and flattening onto it, while the unguarded path continues below."
    >
      {/* Grid ------------------------------------------------------------- */}
      <g stroke="var(--color-line)" strokeWidth="1">
        {[70, 130, 190, 250, 310].map((y) => (
          <line key={y} x1="60" y1={y} x2="844" y2={y} />
        ))}
      </g>

      {/* The region a guarded position cannot enter ----------------------- */}
      <rect
        x="60"
        y={FLOOR_Y}
        width="784"
        height={380 - FLOOR_Y}
        fill="var(--color-danger)"
        opacity="0.045"
      />

      {/* Floor ------------------------------------------------------------ */}
      <line
        x1="60"
        y1={FLOOR_Y}
        x2="844"
        y2={FLOOR_Y}
        stroke="var(--color-armed)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
        className="pxo-chart-floor"
      />
      <text
        x="60"
        y={FLOOR_Y - 12}
        className="pxo-chart-tag pxo-chart-tag-armed"
      >
        YOUR FLOOR
      </text>

      {/* Unguarded continuation ------------------------------------------- */}
      <path
        d={UNGUARDED}
        fill="none"
        stroke="var(--color-danger)"
        strokeWidth="2"
        strokeDasharray="4 6"
        strokeLinecap="round"
        className="pxo-chart-unguarded"
        opacity="0.5"
      />
      <text x="700" y="366" className="pxo-chart-tag pxo-chart-tag-danger">
        WITHOUT A FLOOR
      </text>

      {/* Guarded path ------------------------------------------------------ */}
      <path
        d={GUARDED}
        pathLength={1}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pxo-chart-path"
      />

      {/* Deposit ----------------------------------------------------------- */}
      <g className="pxo-chart-marker" style={{ animationDelay: "0.2s" }}>
        <circle cx="60" cy="126" r="5" fill="var(--color-ink)" />
        <text x="60" y="104" className="pxo-chart-tag">
          DEPOSIT
        </text>
      </g>

      {/* Settlement -------------------------------------------------------- */}
      <g className="pxo-chart-marker" style={{ animationDelay: "2.6s" }}>
        <circle
          cx="604"
          cy={FLOOR_Y}
          r="9"
          fill="none"
          stroke="var(--color-armed)"
          strokeWidth="1.5"
          className="pxo-chart-ping"
        />
        <circle cx="604" cy={FLOOR_Y} r="5" fill="var(--color-armed)" />
        <text x="604" y={FLOOR_Y + 30} className="pxo-chart-tag pxo-chart-tag-armed">
          SETTLES HERE
        </text>
      </g>
    </svg>
  );
}
