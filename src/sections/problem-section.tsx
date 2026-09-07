import { landing } from "@/content/landing";
import { Eyebrow, Section } from "@/components/ui";
import { DrawLine, LineReveal, Parallax, Reveal } from "@/components/motion";

export function ProblemSection() {
  const { problem } = landing;

  return (
    <Section id="problem">
      <DrawLine className="mb-16" />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <Reveal kind="blur" className="mb-6">
            <Eyebrow>{problem.eyebrow}</Eyebrow>
          </Reveal>
          <LineReveal
            lines={problem.titleLines}
            className="pxo-title text-balance"
            quietFrom={1}
            delay={80}
          />
        </div>

        {/* Drifts against the headline as it passes, which is the section's point. */}
        <Parallax strength={22} className="flex flex-col justify-end gap-6">
          {problem.body.map((paragraph, i) => (
            <Reveal
              key={paragraph}
              tag="p"
              kind="right"
              distance={26}
              className="pxo-lead text-pretty"
              delay={160 + i * 110}
            >
              {paragraph}
            </Reveal>
          ))}
        </Parallax>
      </div>
    </Section>
  );
}
