import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { registerReveal } from "@/lib/reveal-sweep";

/**
 * Shared entrance machinery.
 *
 * Everything here uses CSS transitions rather than a JS animation loop: an
 * entrance is a one-shot transition, the compositor runs it without per-frame
 * JS, and it does not depend on requestAnimationFrame — which is paused
 * whenever the page is not being rendered.
 */
function useInView(once = true) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInstant(true);
      setShown(true);
      return;
    }

    let observer: IntersectionObserver | null = null;

    const reveal = () => {
      // Nothing to animate for if the page is not being drawn.
      if (document.visibilityState === "hidden") setInstant(true);
      setShown(true);
    };

    const check = () => {
      const rect = node.getBoundingClientRect();
      const inView =
        rect.top < window.innerHeight * 0.94 && rect.bottom > 0 && rect.height > 0;
      if (inView) {
        reveal();
        observer?.disconnect();
      }
      return inView;
    };

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          if (once) observer?.disconnect();
        } else if (!once) {
          setShown(false);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(node);

    const unregister = registerReveal(check);

    return () => {
      unregister();
      observer?.disconnect();
    };
  }, [once]);

  return { ref, shown, instant };
}

const EASE = "var(--ease-out-soft)";

/* -------------------------------------------------------------------------- */

/**
 * Headline reveal: each line rises out from behind a mask, one after another.
 *
 * Used for section titles, where a single fade would undersell the type. Pass
 * the lines as separate strings so each gets its own mask — splitting on
 * rendered line breaks is not possible before layout.
 */
export function LineReveal({
  lines,
  tag = "h2",
  className,
  lineClassName,
  quietFrom,
  delay = 0,
  stagger = 90,
}: {
  lines: readonly string[];
  tag?: ElementType;
  className?: string;
  lineClassName?: string;
  /** Index from which lines render in the quiet tone. */
  quietFrom?: number;
  delay?: number;
  stagger?: number;
}) {
  const { ref, shown, instant } = useInView();

  return createElement(
    tag,
    { ref, className, "aria-label": lines.join(" ") },
    lines.map((line, i) => (
      <span
        key={line + i}
        aria-hidden="true"
        className="block overflow-hidden"
        style={{ paddingBottom: "0.08em", marginBottom: "-0.08em" }}
      >
        <span
          className={[
            "block",
            lineClassName ?? "",
            quietFrom !== undefined && i >= quietFrom ? "pxo-display-quiet" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            transform: shown ? "translateY(0)" : "translateY(105%)",
            transition: instant
              ? "none"
              : `transform 820ms ${EASE} ${delay + i * stagger}ms`,
          }}
        >
          {line}
        </span>
      </span>
    )),
  );
}

/* -------------------------------------------------------------------------- */

type RevealStyle = "rise" | "fade" | "blur" | "scale" | "left" | "right";

function styleFor(kind: RevealStyle, shown: boolean, distance: number): CSSProperties {
  if (shown) {
    return { opacity: 1, transform: "translate3d(0,0,0) scale(1)", filter: "blur(0px)" };
  }
  switch (kind) {
    case "fade":
      return { opacity: 0, transform: "translate3d(0,0,0)", filter: "blur(0px)" };
    case "blur":
      return { opacity: 0, transform: "translate3d(0,8px,0)", filter: "blur(7px)" };
    case "scale":
      return { opacity: 0, transform: "translate3d(0,10px,0) scale(0.965)", filter: "blur(0px)" };
    case "left":
      return { opacity: 0, transform: `translate3d(${-distance}px,0,0)`, filter: "blur(0px)" };
    case "right":
      return { opacity: 0, transform: `translate3d(${distance}px,0,0)`, filter: "blur(0px)" };
    default:
      return { opacity: 0, transform: `translate3d(0,${distance}px,0)`, filter: "blur(0px)" };
  }
}

/**
 * The general entrance. `kind` varies the gesture so a long page does not
 * repeat one motion the whole way down.
 */
export function Reveal({
  children,
  tag = "div",
  className,
  delay = 0,
  distance = 18,
  kind = "rise",
  duration = 620,
  once = true,
}: {
  children: ReactNode;
  tag?: ElementType;
  className?: string;
  delay?: number;
  distance?: number;
  kind?: RevealStyle;
  duration?: number;
  once?: boolean;
}) {
  const { ref, shown, instant } = useInView(once);

  const style: CSSProperties = {
    ...styleFor(kind, shown, distance),
    transition: instant
      ? "none"
      : `opacity ${duration}ms ${EASE} ${delay}ms, transform ${duration}ms ${EASE} ${delay}ms, filter ${duration}ms ${EASE} ${delay}ms`,
    willChange: shown ? undefined : "opacity, transform",
  };

  return createElement(tag, { ref, className, style }, children);
}

/* -------------------------------------------------------------------------- */

/**
 * A rule that draws itself in from the left when scrolled to. Used to separate
 * sections without the hard edge of a static border.
 */
export function DrawLine({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  const { ref, shown, instant } = useInView();

  return (
    <span
      ref={ref as React.Ref<HTMLSpanElement>}
      aria-hidden="true"
      className={`block h-px w-full origin-left bg-line-strong ${className}`}
      style={{
        transform: shown ? "scaleX(1)" : "scaleX(0)",
        transition: instant ? "none" : `transform 1100ms ${EASE} ${delay}ms`,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Counts a figure up when it scrolls into view.
 *
 * Driven by a timer rather than rAF so it still completes on a page that is
 * not being rendered, and it always lands exactly on the target value.
 */
export function CountUp({
  value,
  format,
  duration = 1100,
  className,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const { ref, shown, instant } = useInView();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!shown) return;
    if (instant) {
      setDisplay(value);
      return;
    }

    const start = Date.now();
    const id = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // Ease out, so it decelerates onto the final figure.
      setDisplay(value * (1 - Math.pow(1 - t, 3)));
      if (t >= 1) window.clearInterval(id);
    }, 1000 / 60);

    return () => window.clearInterval(id);
  }, [shown, instant, value, duration]);

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>
      {format(shown ? display : 0)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Translates its children against the scroll, for depth between layers.
 *
 * Reads the shared scroll value rather than adding its own listener, and stays
 * off entirely when reduced motion is requested.
 */
export function Parallax({
  children,
  strength = 28,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let current = 0;

    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      // -1 when leaving the top, +1 when entering from the bottom.
      const centre = (rect.top + rect.height / 2 - window.innerHeight / 2) /
        (window.innerHeight / 2 + rect.height / 2);
      const target = Math.max(-1, Math.min(1, centre)) * strength;
      current += (target - current) * 0.18;
      node.style.transform = `translate3d(0, ${current.toFixed(2)}px, 0)`;
      if (Math.abs(target - current) > 0.05) schedule();
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [strength]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
