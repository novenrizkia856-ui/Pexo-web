import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PEXO_CONFIG, shortAddress } from "@/config/pexo.config";
import { landing } from "@/content/landing";

/**
 * The Pexo token address, as a single inline row.
 *
 * Lives in the hero because the address is the thing people arrive looking for,
 * and asking them to scroll for it loses most of them. It is the only place the
 * address appears, so there is no second copy to keep in step.
 *
 * The token is NOT part of the guard protocol. That distinction is stated here
 * rather than left to the reader, because an address on a DeFi landing page is
 * otherwise assumed to be the thing the product runs on.
 */

function CopyIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M6 15H5.5A2.5 2.5 0 0 1 3 12.5v-7A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5V6" />
    </svg>
  );
}

function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12.5 9.5 18 20 6.5" />
    </svg>
  );
}

/**
 * True on narrow viewports, so the address can be middle truncated.
 *
 * The displayed address is chosen here rather than by rendering both forms and
 * hiding one with CSS: two text nodes would both land in a text selection, and
 * anyone copying the address by hand would get it twice over.
 */
function useNarrow(query = "(max-width: 767px)") {
  const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function ContractAddress() {
  const { ca } = landing;
  const address = PEXO_CONFIG.token.address;
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const addressRef = useRef<HTMLSpanElement | null>(null);
  const narrow = useNarrow();

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard writes can be denied outright: an insecure context, a
      // permissions policy, or an embedded frame. Rather than fail silently,
      // select the address so it can still be copied by hand.
      setCopied(false);
      const node = addressRef.current;
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  return (
    <div className="w-full text-center">
      {/*
        Tighter gaps below `sm`: at 375px the label, value and button need
        335px against the 327px available, and the 8px shortfall lands on the
        value, which is the one part that must stay readable.
      */}
      <div className="pxo-card flex w-full items-center gap-2 p-2 pl-3 text-left sm:gap-3 sm:pl-4">
      <span className="shrink-0 text-eyebrow uppercase tracking-[0.09em] text-faint">
        {ca.label}
      </span>

      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />

      {address ? (
        <span
          ref={addressRef}
          className="num min-w-0 flex-1 truncate text-sm"
          title={address}
        >
          {narrow ? shortAddress(address) : address}
        </span>
      ) : (
        <span className="num pxo-pending min-w-0 flex-1 truncate text-sm" title={ca.pendingNote}>
          {ca.pending}
        </span>
      )}

      <button
        type="button"
        onClick={copy}
        disabled={!address}
        aria-disabled={!address}
        aria-label={address ? ca.copyLabel : `${ca.copyLabel} (not available yet)`}
        title={address ? ca.copyLabel : ca.pendingNote}
        className="pxo-button pxo-button-secondary pxo-button-small shrink-0"
      >
        <span className="pxo-copy-icon" aria-hidden="true">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </span>
        <span>{copied ? ca.copiedLabel : "Copy"}</span>
      </button>
      </div>

      {/*
        Carried over from the section this replaced. An address on a DeFi
        landing page is assumed to be what the product runs on, and here it is
        not, so the line stays with the address rather than being dropped.

        It sits on its own paper backing because the backdrop is at its busiest
        exactly here: a grid line running through a line of 12px grey makes it
        unreadable. Backing the type is the fix, rather than quietening the
        animation, which is the thing being asked for.
      */}
      <p className="mt-2 inline-block rounded-md bg-paper/85 px-2.5 py-1 text-xs text-muted">
        {ca.note}
      </p>
    </div>
  );
}
