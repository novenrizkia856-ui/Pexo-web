import { landing } from "@/content/landing";
import { Eyebrow, Section } from "@/components/ui";
import { DrawLine, LineReveal, Reveal } from "@/components/motion";
import { GuardChart } from "@/components/visuals/guard-chart";

/**
 * The visual carries this section. The three steps sit under it as short
 * captions rather than as the explanation, because the chart already shows
 * what happens.
 */
export function HowSection() {
  const { how } = landing;

  return (
    <Section id="how">
      <DrawLine className="mb-16" />

      <Reveal kind="blur" className="mb-6">
        <Eyebrow>{how.eyebrow}</Eyebrow>
      </Reveal>
      <LineReveal
        lines={how.titleLines}
        className="pxo-title mb-14 max-w-title text-balance"
        delay={80}
      />

      <Reveal kind="scale" duration={900} className="mb-14">
        <div className="pxo-visual pxo-glow">
          <GuardChart />
        </div>
      </Reveal>

      <ol className="grid gap-px overflow-hidden rounded-[--radius-card] border border-line bg-line md:grid-cols-3">
        {how.steps.map((step, i) => (
          <Reveal
            key={step.index}
            tag="li"
            kind="rise"
            delay={i * 120}
            className="pxo-step pxo-glow flex flex-col gap-3 bg-paper p-7 md:p-8"
          >
            <span className="num text-eyebrow tracking-[0.14em] text-faint">{step.index}</span>
            <h3 className="text-base font-medium tracking-[-0.015em]">{step.title}</h3>
            <p className="text-[0.9375rem] leading-relaxed text-muted text-pretty">{step.body}</p>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
