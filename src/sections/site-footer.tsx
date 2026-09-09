import {
  CHAIN_CONFIGURED,
  PEXO_CONFIG,
  explorerAddressUrl,
  isPlaceholderAddress,
} from "@/config/pexo.config";
import { landing } from "@/content/landing";
import { Wordmark } from "@/components/brand";
import { Link } from "react-router-dom";
import { TodoValue } from "@/components/ui";
import { DrawLine, Reveal } from "@/components/motion";

function ContractAddress() {
  const address = PEXO_CONFIG.contracts.gapGuard;
  const href = explorerAddressUrl(address);

  // Never present a zero address as if it were a deployment.
  if (isPlaceholderAddress(address)) {
    return <TodoValue>Contract not deployed</TodoValue>;
  }

  const label = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return href && CHAIN_CONFIGURED ? (
    <a
      className="num text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer"
      title={address}
    >
      {label}
    </a>
  ) : (
    <span className="num text-xs text-muted" title={address}>
      {label}
    </span>
  );
}

export function SiteFooter() {
  const { footer } = landing;

  return (
    <footer className="relative z-10 border-t border-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto grid w-full max-w-[76rem] gap-12 px-6 py-16 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] md:px-10">
        <Reveal kind="left" distance={24}>
          <div className="flex flex-col items-start gap-4">
            <span className="pxo-brand">
              <Wordmark className="h-7" />
            </span>
            <p className="max-w-[34ch] text-sm leading-relaxed text-muted">{footer.tagline}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="text-eyebrow uppercase tracking-[0.09em] text-faint">
                {PEXO_CONFIG.chain.name} · {PEXO_CONFIG.chain.id}
              </span>
              <ContractAddress />
            </div>
          </div>
        </Reveal>

        {footer.columns.map((column, i) => (
          <Reveal key={column.title} kind="rise" distance={22} delay={120 + i * 110}>
            <nav className="flex flex-col gap-3" aria-label={column.title}>
              <h2 className="text-eyebrow uppercase tracking-[0.09em] text-faint">
                {column.title}
              </h2>
              {column.links.map((link) => {
                const className =
                  "text-sm text-muted underline-offset-4 hover:text-ink hover:underline";
                // Internal routes go through the router; opening docs in a new
                // tab would be wrong, and a full reload throws away the page.
                return link.href.startsWith("/") ? (
                  <Link key={link.label} to={link.href} className={className}>
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className={className}
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>
          </Reveal>
        ))}
      </div>

      <div className="mx-auto w-full max-w-[76rem] px-6 md:px-10">
        <DrawLine />
      </div>
      <div className="mx-auto w-full max-w-[76rem] px-6 py-7 md:px-10">
        <Reveal tag="p" kind="fade" delay={200} className="max-w-[80ch] text-xs leading-relaxed text-faint">
          {footer.disclaimer}
        </Reveal>
      </div>
    </footer>
  );
}
