import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M17 7H7M17 7v10" />
    </svg>
  );
}

/** True for hrefs that are still placeholders in config or content. */
export function isTodoHref(href: string): boolean {
  return href.startsWith("TODO_");
}

export function Button({
  children,
  href,
  onClick,
  variant = "primary",
  withArrow = false,
  small = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  withArrow?: boolean;
  small?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const className = [
    "pxo-button",
    `pxo-button-${variant}`,
    small ? "pxo-button-small" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <span>{children}</span>
      {withArrow ? (
        <span className="pxo-button-arrow" aria-hidden="true">
          <ArrowIcon className="size-3.5" />
        </span>
      ) : null}
    </>
  );

  // A placeholder destination renders as visibly unavailable rather than as a
  // link that goes nowhere.
  if (href && isTodoHref(href)) {
    return (
      <span
        className={className}
        aria-disabled="true"
        title="Destination not configured yet"
      >
        {inner}
      </span>
    );
  }

  if (href && href.startsWith("/")) {
    return (
      <Link to={href} className={className}>
        {inner}
      </Link>
    );
  }

  if (href) {
    const external = href.startsWith("http");
    return (
      <a
        href={href}
        className={className}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {inner}
      </a>
    );
  }

  return (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="pxo-eyebrow">{children}</span>;
}

/** A value the product does not know yet. Never render a guess in its place. */
export function TodoValue({ children }: { children: ReactNode }) {
  return <span className="pxo-todo">{children}</span>;
}

export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`relative z-10 mx-auto w-full max-w-[76rem] px-6 py-[clamp(5rem,12vh,9rem)] md:px-10 ${className}`}
    >
      {children}
    </section>
  );
}
