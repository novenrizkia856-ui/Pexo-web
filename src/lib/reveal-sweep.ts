/**
 * A shared, rAF-throttled sweep for reveals whose IntersectionObserver never
 * fired.
 *
 * IntersectionObserver delivers nothing while a page is not being rendered — a
 * background tab, or an embedded preview that is hidden. If the page is
 * scrolled in that state, elements scrolled past never receive a callback and
 * would stay at opacity 0 permanently once it came back.
 *
 * Rather than give every Reveal its own scroll listener, pending ones register
 * here and a single listener re-checks them. Each unregisters as soon as it
 * reveals, so the set drains to empty and the listener detaches.
 */

type Check = () => boolean;

const pending = new Set<Check>();
let frame = 0;
let timer = 0;
let attached = false;

function sweep() {
  frame = 0;
  timer = 0;
  for (const check of [...pending]) {
    if (check()) pending.delete(check);
  }
  if (pending.size === 0) detach();
}

function cancel() {
  if (frame) cancelAnimationFrame(frame);
  if (timer) clearTimeout(timer);
  frame = 0;
  timer = 0;
}

function schedule() {
  if (frame || timer) return;
  // requestAnimationFrame does not run while the page is hidden, which is
  // exactly the case this fallback exists to cover. Use a timer there.
  if (document.visibilityState === "hidden") {
    timer = window.setTimeout(sweep, 0);
  } else {
    frame = requestAnimationFrame(sweep);
  }
}

function attach() {
  if (attached) return;
  attached = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
}

function detach() {
  if (!attached) return;
  attached = false;
  cancel();
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  document.removeEventListener("visibilitychange", schedule);
}

/** Register a pending reveal. Returns an unsubscribe. */
export function registerReveal(check: Check): () => void {
  pending.add(check);
  attach();
  schedule();
  return () => {
    pending.delete(check);
    if (pending.size === 0) detach();
  };
}
