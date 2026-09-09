/**
 * Pexo wordmark and mark.
 *
 * These are the delivered brand files, not drawn in code: the mark is a
 * six-bladed pinwheel whose curves do not survive being approximated by hand,
 * so it ships as artwork. Raster rather than vector because the pack arrived as
 * PNG; exports are 2x the largest size used, which is why the intrinsic sizes
 * below are larger than anything rendered.
 *
 * Only the lockup is rendered as a component. `mark.png` is used too, but by
 * the document rather than by React: it is the favicon, the touch icon, and the
 * image a wallet shows when pairing over WalletConnect.
 *
 * The rest of the pack sits in `public/brand` unused on purpose. Everything on
 * this site is on paper, so `lockup-on-dark.png`, `mark-on-dark.png` and the
 * monochrome `mark-ink.png` have nowhere to go yet; they are what the first
 * dark surface, or any print or partner placement, will need.
 */

/** Intrinsic size of `lockup.png`, used to reserve space before it loads. */
const LOCKUP_W = 423;
const LOCKUP_H = 128;

/**
 * The full lockup, mark and wordmark together.
 *
 * `alt` carries the name because the mark replaces the word that used to be
 * typeset beside it; without it the header link would have no text at all.
 */
export function Wordmark({ className = "h-[22px]" }: { className?: string }) {
  return (
    <img
      src="/brand/lockup.png"
      alt="Pexo"
      width={LOCKUP_W}
      height={LOCKUP_H}
      className={`w-auto ${className}`}
      decoding="async"
    />
  );
}
