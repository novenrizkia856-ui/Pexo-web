import { PEXO_CONFIG } from "@/config/pexo.config";
import { landing } from "@/content/landing";
import { Eyebrow, Section } from "@/components/ui";
import { DrawLine, LineReveal, Reveal } from "@/components/motion";

/**
 * Reads the registry straight from config. While it is empty, the section says
 * so plainly rather than showing placeholder tickers that imply support.
 */
export function AssetsSection() {
  const { assets } = landing;
  const supported = PEXO_CONFIG.tokens.supportedAssets;

  return (
    <Section id="assets">
      <DrawLine className="mb-16" />

      <Reveal kind="blur" className="mb-6">
        <Eyebrow>{assets.eyebrow}</Eyebrow>
      </Reveal>
      <LineReveal
        lines={assets.titleLines}
        className="pxo-title mb-7 max-w-title text-balance"
        delay={80}
      />
      <Reveal tag="p" kind="fade" delay={280} className="pxo-lead mb-12 max-w-lead text-pretty">
        {assets.lead}
      </Reveal>

      {supported.length === 0 ? (
        <Reveal kind="settle" duration={720}>
          <div className="pxo-card pxo-glow flex flex-col items-start gap-3 border-dashed p-10 md:p-14">
            <h3 className="text-base font-medium">{assets.emptyTitle}</h3>
            <p className="max-w-[56ch] text-[0.9375rem] leading-relaxed text-muted text-pretty">
              {assets.emptyBody}
            </p>
          </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[--radius-card] border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
          {supported.map((asset, i) => (
            <Reveal key={asset.id} kind="rise" delay={i * 70}>
              <div className="pxo-token pxo-glow flex h-full items-center gap-3 bg-paper p-6">
                {asset.logo ? (
                  <img
                    src={asset.logo}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 shrink-0 rounded-full object-contain"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="num grid size-7 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold text-on-accent"
                    style={{ background: asset.accent }}
                  >
                    {asset.symbol.slice(0, 2)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="num block text-sm font-medium">{asset.symbol}</span>
                  <span className="block truncate text-xs text-faint">{asset.name}</span>
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </Section>
  );
}
