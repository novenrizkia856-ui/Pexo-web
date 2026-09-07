import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PEXO_CONFIG, shortAddress } from "@/config/pexo.config";
import { landing } from "@/content/landing";
import { Eyebrow, Section } from "@/components/ui";
import { DrawLine, LineReveal, Reveal } from "@/components/motion";

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

/**
 * The Pexo token contract address.
 *
 * The token does not exist yet, so this publishes a "Coming soon" state rather
 * than a zero address dressed up as a deployment. The copy control is rendered
 * either way so the layout does not shift once an address lands, but it stays
 * inert while there is nothing to put on the clipboard.
 */
export function CaSection() {
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
      timer.current = window.setTimeout(() => {
        setCopied(false);
        timer.current = null;
      }, 1800);
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
    <Section id="contract">
      <DrawLine className="mb-16" />

      <Reveal kind="blur" className="mb-6">
        <Eyebrow>{ca.eyebrow}</Eyebrow>
      </Reveal>
      <LineReveal
        lines={ca.titleLines}
        className="pxo-title mb-7 max-w-title text-balance"
        delay={80}
      />
      <Reveal tag="p" kind="fade" delay={280} className="pxo-lead mb-12 max-w-lead text-pretty">
        {ca.lead}
      </Reveal>

      <Reveal kind="scale" duration={760}>
        <div className="pxo-card pxo-glow pxo-card-lift flex flex-wrap items-center justify-between gap-6 p-7 md:p-9">
          <div className="min-w-0">
            <span className="block text-eyebrow uppercase tracking-[0.09em] text-faint">
              {ca.label}
            </span>

            {address ? (
              <span
                ref={addressRef}
                className="num mt-2 block truncate text-[clamp(1.125rem,2.4vw,1.75rem)]"
                title={address}
              >
                {narrow ? shortAddress(address) : address}
              </span>
            ) : (
              <span className="num pxo-pending mt-2 block text-[clamp(1.125rem,2.4vw,1.75rem)]">
                {ca.pending}
              </span>
            )}

            {!address ? (
              <span className="mt-2 block text-xs text-faint">{ca.pendingNote}</span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={copy}
            disabled={!address}
            aria-disabled={!address}
            aria-label={address ? ca.copyLabel : `${ca.copyLabel} (not available yet)`}
            title={address ? ca.copyLabel : ca.pendingNote}
            className="pxo-button pxo-button-secondary shrink-0"
          >
            <span className="pxo-copy-icon" aria-hidden="true">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </span>
            <span>{copied ? ca.copiedLabel : "Copy"}</span>
          </button>
        </div>
      </Reveal>
    </Section>
  );
}
