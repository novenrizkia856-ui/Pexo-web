import { useEffect, useRef } from "react";

const STOPS = [
  { id: "problem", label: "The gap" },
  { id: "how", label: "How it works" },
  { id: "guarantees", label: "Guarantees" },
  { id: "assets", label: "Assets" },
  { id: "contract", label: "Token" },
  { id: "keepers", label: "Keepers" },
] as const;

/**
 * A progress rail down the right edge, with a marker per section.
 *
 * Written directly to the DOM from a scroll handler rather than held in React
 * state: it updates on every scroll frame, and re-rendering a component that
 * often to move one transform would be wasteful.
 */
export function ScrollRail() {
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const fill = fillRef.current;
    const root = rootRef.current;
    if (!fill || !root) return;

    const dots = Array.from(
      root.querySelectorAll<HTMLElement>("[data-rail-dot]"),
    );

    let frame = 0;

    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      fill.style.transform = `scaleY(${progress.toFixed(4)})`;

      // The active section is the last one whose top has passed the middle.
      const middle = window.innerHeight * 0.5;
      let activeIndex = -1;
      STOPS.forEach((stop, i) => {
        const node = document.getElementById(stop.id);
        if (node && node.getBoundingClientRect().top <= middle) activeIndex = i;
      });

      dots.forEach((dot, i) => {
        dot.toggleAttribute("data-active", i === activeIndex);
        dot.toggleAttribute("data-passed", i < activeIndex);
      });
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
  }, []);

  return (
    <nav ref={rootRef} className="pxo-rail max-lg:hidden" aria-label="Page progress">
      <span className="pxo-rail-track" aria-hidden="true">
        <span ref={fillRef} className="pxo-rail-fill" />
      </span>

      <ol className="pxo-rail-stops">
        {STOPS.map((stop) => (
          <li key={stop.id}>
            <a href={`#${stop.id}`} data-rail-dot className="pxo-rail-dot">
              <span className="pxo-rail-label">{stop.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
