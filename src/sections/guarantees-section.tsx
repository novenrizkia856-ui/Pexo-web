import { landing } from "@/content/landing";
import { Eyebrow, Section } from "@/components/ui";
import { DrawLine, LineReveal, Reveal } from "@/components/motion";

/**
 * Pexo's actual differentiator, so it gets the most space on the page: the
 * headline guarantee is a full-width panel, the supporting three sit under it.
 */
export function GuaranteesSection() {
  const { guarantees } = landing;
  const [primary, ...rest] = guarantees.items;

  return (
    <Section id="guarantees">
      <DrawLine className="mb-16" />

      <Reveal kind="blur" className="mb-6">
        <Eyebrow>{guarantees.eyebrow}</Eyebrow>
      </Reveal>
      <LineReveal
        lines={guarantees.titleLines}
        className="pxo-title mb-7 max-w-title text-balance"
        quietFrom={1}
        delay={80}
      />
      <Reveal tag="p" kind="fade" delay={300} className="pxo-lead mb-16 max-w-lead text-pretty">
        {guarantees.lead}
      </Reveal>

      <Reveal kind="scale" duration={780}>
        <article className="pxo-card pxo-glow pxo-card-lift mb-4 border-l-2 border-l-armed p-8 md:p-12">
          <h3 className="pxo-title mb-6 max-w-[22ch] text-[clamp(1.5rem,2.6vw,2.25rem)] text-balance">
            {primary.title}
          </h3>
          <p className="pxo-lead max-w-[62ch] text-pretty">{primary.body}</p>
        </article>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3">
        {rest.map((item, i) => (
          <Reveal key={item.title} kind="rise" distance={26} delay={i * 120}>
            <article className="pxo-card pxo-glow pxo-card-lift flex h-full flex-col gap-3 p-7">
              <h3 className="text-base font-medium tracking-[-0.015em]">{item.title}</h3>
              <p
                className={
                  "unverified" in item && item.unverified
                    ? "pxo-todo !block leading-relaxed"
                    : "text-[0.9375rem] leading-relaxed text-muted text-pretty"
                }
              >
                {item.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
