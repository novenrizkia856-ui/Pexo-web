/**
 * Pointer glow for cards.
 *
 * A single delegated listener rather than handlers on every card: it tracks the
 * pointer, finds the nearest `.pxo-glow` ancestor underneath it, and writes the
 * local coordinates as CSS custom properties. The highlight itself is drawn by
 * CSS, so nothing re-renders and no React state is involved.
 *
 * Skipped entirely for coarse pointers and for reduced motion.
 */
export function initPointerGlow(): () => void {
  if (typeof window === "undefined") return () => {};

  const fine = window.matchMedia("(pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return () => {};

  let frame = 0;
  let pending: PointerEvent | null = null;
  let active: HTMLElement | null = null;

  const clear = () => {
    if (!active) return;
    active.removeAttribute("data-glow");
    active = null;
  };

  const apply = () => {
    frame = 0;
    const event = pending;
    pending = null;
    if (!event) return;

    const target = event.target;
    const card =
      target instanceof Element ? (target.closest(".pxo-glow") as HTMLElement | null) : null;

    if (!card) {
      clear();
      return;
    }

    if (card !== active) {
      clear();
      active = card;
      card.setAttribute("data-glow", "on");
    }

    const rect = card.getBoundingClientRect();
    card.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
    card.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
  };

  const onMove = (event: PointerEvent) => {
    pending = event;
    if (frame) return;
    frame = requestAnimationFrame(apply);
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", clear);
  window.addEventListener("blur", clear);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerleave", clear);
    window.removeEventListener("blur", clear);
    clear();
  };
}
