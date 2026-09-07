/**
 * Pexo wordmark and mark.
 *
 * Placeholder identity: a bracket closing under a rule — the floor holding
 * under a price. Replace with a real logo asset when one exists.
 */

export function PexoMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 5v9.5a5.5 5.5 0 0 0 5.5 5.5H20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="square"
      />
      <path d="M4 21.5h16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="square" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <>
      <PexoMark />
      <span>Pexo</span>
    </>
  );
}
