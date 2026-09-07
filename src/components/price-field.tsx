import { useEffect, useRef, type CSSProperties } from "react";
import { scrollProgress } from "@/state/experience";

/**
 * The page backdrop: price paths running right to left, every one of them
 * stopped by a single floor line.
 *
 * The whole product is one sentence — price can go where it likes, but not
 * below the floor you set — so the backdrop draws exactly that. A path falls,
 * meets the floor, and goes flat along it instead of through it. Nothing else
 * on the page has to explain the idea.
 *
 * It runs the length of the page and follows the same story as you scroll:
 *
 *   hero        paths roam, the floor is barely there
 *   problem     volatility rises and the falls cut deeper
 *   how         the floor draws itself in underneath
 *   guarantees  paths press into it and run visibly flat-bottomed
 *   keeper      pressure eases and they lift away again
 *
 * Canvas 2D, not WebGL. The whole scene is a few hundred line segments, which
 * costs less than a shader and a geometry buffer, and it removes three.js from
 * the bundle entirely. That matters most on the phones least able to afford it.
 *
 * Opacity is modulated per zone so the field is loudest over open space and
 * quietest behind body copy. It must never compete with reading.
 */

/** Horizontal distance between samples, in CSS pixels. */
const STEP = 15;

/** Ink and the floor's green, matching the design tokens. */
const INK = "13, 15, 18";
const FLOOR = "15, 107, 82";

type Path = {
  /**
   * Height above the floor per sample, oldest first, in band units where 0 is
   * resting on the floor and 1 is the top of this path's band.
   */
  values: number[];
  /** Share of the band this path uses, so they do not overlap as one mass. */
  amp: number;
  alpha: number;
  /** Current level, carried between samples so the walk stays continuous. */
  level: number;
  /** Counts down while a fall is in progress. */
  falling: number;
};

/** Eases a value through a set of stops, matching the old backdrop's ramps. */
function ramp(stops: readonly (readonly [number, number])[], t: number): number {
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (t <= x1) {
      const k = Math.min(1, Math.max(0, (t - x0) / (x1 - x0)));
      return y0 + (y1 - y0) * (k * k * (3 - 2 * k));
    }
  }
  return stops[stops.length - 1][1];
}

export function PriceField() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let columns = 0;
    let paths: Path[] = [];

    /**
     * Advances one path by a single sample.
     *
     * `pressure` is how hard the market is pushing down, and rises as the page
     * is read. The walk mean-reverts toward the middle of the band so paths do
     * not drift off the top, and clamps at zero, which is the floor: the clamp
     * is the entire point of the image, so it is a hard `max`, never a soft
     * bounce that could dip under.
     */
    function advance(path: Path, pressure: number) {
      if (path.falling > 0) {
        path.falling -= 1;
        path.level -= 0.055 + Math.random() * 0.05;
      } else {
        const pull = (0.55 - path.level) * 0.035;
        path.level += pull + (Math.random() - 0.5) * (0.05 + pressure * 0.06);
        // A fall starts rarely, and more often the further down the page.
        if (Math.random() < 0.006 + pressure * 0.022) {
          path.falling = 6 + Math.floor(Math.random() * 14);
        }
      }

      if (path.level > 1) path.level = 1;
      // The floor. Nothing below this, ever.
      if (path.level < 0) path.level = 0;

      path.values.push(path.level);
      if (path.values.length > columns) path.values.shift();
    }

    function build() {
      const count = width < 640 ? 5 : width < 1100 ? 7 : 9;
      paths = Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        const path: Path = {
          values: [],
          // Nearer paths are taller and more present; far ones sit low and faint.
          amp: 0.34 + t * 0.66,
          alpha: 0.1 + (1 - t) * 0.16,
          level: 0.35 + Math.random() * 0.4,
          falling: 0,
        };
        // Fill the history so the field is already alive on the first frame
        // rather than drawing itself in from the right edge.
        for (let s = 0; s < columns; s += 1) advance(path, 0.2);
        return path;
      });
    }

    function resize() {
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      if (w === 0 || h === 0) return;

      width = w;
      height = h;
      columns = Math.ceil(w / STEP) + 2;

      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      build();
    }

    let frame = 0;
    let visible = true;
    let phase = 0;
    let eased = 0;
    let last = performance.now();

    function draw(now: number) {
      const dt = Math.min(64, now - last);
      last = now;

      const p = scrollProgress.current;
      eased += (p - eased) * 0.07;

      const pressure = ramp(
        [
          [0, 0.05],
          [0.3, 0.45],
          [0.68, 1],
          [0.9, 0.35],
          [1, 0.2],
        ],
        eased,
      );
      const floorAlpha = ramp(
        [
          [0, 0.06],
          [0.22, 0.5],
          [0.6, 1],
          [1, 0.85],
        ],
        eased,
      );

      // Scroll the tape by advancing a sub-sample phase, so motion is smooth
      // rather than stepping one whole column at a time.
      if (!reduced) {
        phase += (dt / 1000) * STEP * 1.5;
        while (phase >= STEP) {
          phase -= STEP;
          for (const path of paths) advance(path, pressure);
        }
      }

      const floorY = Math.round(height * 0.78) + 0.5;
      const band = height * 0.4;

      ctx!.clearRect(0, 0, width, height);

      for (const path of paths) {
        ctx!.beginPath();
        for (let i = 0; i < path.values.length; i += 1) {
          const x = i * STEP - phase;
          const y = floorY - path.values[i] * band * path.amp;
          if (i === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = `rgba(${INK}, ${path.alpha})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();

        // Redraw only the stretches sitting on the floor, in the floor's own
        // colour. This is the moment the guarantee is doing something, so it is
        // the one thing in the backdrop that is not grey.
        ctx!.beginPath();
        let open = false;
        for (let i = 0; i < path.values.length; i += 1) {
          const onFloor = path.values[i] === 0;
          const x = i * STEP - phase;
          if (onFloor && !open) {
            ctx!.moveTo(x, floorY);
            open = true;
          } else if (onFloor) {
            ctx!.lineTo(x, floorY);
          } else {
            open = false;
          }
        }
        ctx!.strokeStyle = `rgba(${FLOOR}, ${Math.min(0.55, path.alpha * 3.2)})`;
        ctx!.lineWidth = 1.75;
        ctx!.stroke();
      }

      // The floor itself, drawn last so it reads as the thing underneath.
      ctx!.beginPath();
      ctx!.moveTo(0, floorY);
      ctx!.lineTo(width, floorY);
      ctx!.strokeStyle = `rgba(${FLOOR}, ${0.28 * floorAlpha})`;
      ctx!.lineWidth = 1;
      ctx!.stroke();

      // Lift the mask once the hero is behind, so the field fills the frame
      // further down instead of only hugging the bottom edge.
      const maskStart = ramp(
        [
          [0, 54],
          [0.16, 6],
          [1, 0],
        ],
        eased,
      );
      host!.style.setProperty("--field-mask-start", maskStart + "%");
      host!.style.setProperty("--field-mask-mid", maskStart + 26 + "%");
    }

    function loop(now: number) {
      frame = requestAnimationFrame(loop);
      if (!visible) return;
      draw(now);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      // Skip the gap, or the tape lurches forward by however long the tab slept.
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      // One frame, held. The image still says what it needs to say standing
      // still, so there is no reason to run a loop for it.
      draw(performance.now());
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (canvas.parentNode === host) host.removeChild(canvas);
    };
  }, []);

  const maskValue =
    "linear-gradient(to bottom, transparent 0%, transparent var(--field-mask-start), #000 var(--field-mask-mid), #000 100%)";

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={
        {
          "--field-mask-start": "54%",
          "--field-mask-mid": "80%",
          maskImage: maskValue,
          WebkitMaskImage: maskValue,
        } as CSSProperties
      }
    />
  );
}
