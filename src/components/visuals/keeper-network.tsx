/**
 * Permissionless triggering, drawn once.
 *
 * A guard reaches its floor at the centre. Anonymous addresses all around fire
 * at it. Whoever lands first settles the position and takes the bounty. There
 * is no privileged node in the picture, which is the whole point.
 *
 * CSS animation only, like the rest of the visuals here.
 */

const CENTRE = { x: 440, y: 186 };

/** Keepers, placed by hand so the arrangement reads as scattered, not radial. */
const KEEPERS = [
  { x: 96, y: 74, delay: 0.0 },
  { x: 208, y: 250, delay: 1.15 },
  { x: 120, y: 176, delay: 2.3 },
  { x: 336, y: 62, delay: 0.55 },
  { x: 300, y: 306, delay: 1.75 },
  { x: 604, y: 72, delay: 0.3 },
  { x: 684, y: 236, delay: 1.45 },
  { x: 560, y: 312, delay: 2.05 },
  { x: 784, y: 132, delay: 0.85 },
] as const;

export function KeeperNetwork() {
  return (
    <svg
      viewBox="0 0 880 380"
      className="pxo-net block h-auto w-full"
      role="img"
      aria-label="Many independent addresses firing at a single guard that has reached its floor."
    >
      {/* Reach lines -------------------------------------------------------- */}
      <g stroke="var(--color-line-strong)" strokeWidth="1">
        {KEEPERS.map((k) => (
          <line key={`l-${k.x}-${k.y}`} x1={k.x} y1={k.y} x2={CENTRE.x} y2={CENTRE.y} />
        ))}
      </g>

      {/* Keeper nodes ------------------------------------------------------- */}
      {KEEPERS.map((k) => (
        <g key={`k-${k.x}-${k.y}`}>
          <rect
            x={k.x - 7}
            y={k.y - 7}
            width="14"
            height="14"
            rx="3.5"
            fill="var(--color-paper)"
            stroke="var(--color-faint)"
            strokeWidth="1.25"
            className="pxo-net-node"
            style={{ animationDelay: `${k.delay}s` }}
          />
        </g>
      ))}

      {/* Pulses travelling inward ------------------------------------------- */}
      {KEEPERS.map((k) => (
        <circle
          key={`p-${k.x}-${k.y}`}
          cx={k.x}
          cy={k.y}
          r="3.5"
          fill="var(--color-armed)"
          className="pxo-net-pulse"
          style={
            {
              "--dx": `${CENTRE.x - k.x}px`,
              "--dy": `${CENTRE.y - k.y}px`,
              animationDelay: `${k.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* The guard ----------------------------------------------------------- */}
      <g>
        <circle
          cx={CENTRE.x}
          cy={CENTRE.y}
          r="52"
          fill="none"
          stroke="var(--color-armed)"
          strokeWidth="1.5"
          className="pxo-net-ring"
        />
        <rect
          x={CENTRE.x - 92}
          y={CENTRE.y - 30}
          width="184"
          height="60"
          rx="14"
          fill="var(--color-glass-strong)"
          stroke="var(--color-line-strong)"
          strokeWidth="1"
        />
        <text x={CENTRE.x} y={CENTRE.y - 6} className="pxo-net-label">
          GUARD AT FLOOR
        </text>
        <text x={CENTRE.x} y={CENTRE.y + 16} className="pxo-net-value">
          BOUNTY OPEN
        </text>
      </g>
    </svg>
  );
}
