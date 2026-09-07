import { PEXO_CONFIG } from "@/config/pexo.config";
import { landing } from "@/content/landing";
import { Button, Eyebrow, Section } from "@/components/ui";
import { CountUp, DrawLine, LineReveal, Reveal } from "@/components/motion";
import { KeeperNetwork } from "@/components/visuals/keeper-network";

const bps = (n: number) => `${(n / 100).toFixed(2)}%`;

/**
 * Like the how-it-works section, the picture does the explaining. The copy is
 * two lines and the figures sit alongside the visual rather than under a wall
 * of text.
 */
export function KeeperSection() {
  const { keeper } = landing;

  return (
    <Section id="keepers">
      <DrawLine className="mb-16" />

      <Reveal kind="blur" className="mb-6">
        <Eyebrow>{keeper.eyebrow}</Eyebrow>
      </Reveal>
      <LineReveal
        lines={keeper.titleLines}
        className="pxo-title mb-14 max-w-title text-balance"
        quietFrom={1}
        delay={80}
      />

      <Reveal kind="scale" duration={900} className="mb-14">
        <div className="pxo-visual pxo-glow">
          <KeeperNetwork />
        </div>
      </Reveal>

      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="flex max-w-lead flex-col gap-4">
          {keeper.body.map((paragraph, i) => (
            <Reveal
              key={paragraph}
              tag="p"
              kind="rise"
              className="pxo-lead text-pretty"
              delay={i * 110}
            >
              {paragraph}
            </Reveal>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <Reveal kind="scale" delay={200}>
            <dl className="pxo-card pxo-glow pxo-card-lift flex gap-10 px-7 py-5">
              <div>
                <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">Bounty</dt>
                <dd className="num mt-1 text-xl text-armed">
                  <CountUp value={PEXO_CONFIG.protocol.keeperBountyBps} format={bps} />
                </dd>
              </div>
              <div>
                <dt className="text-eyebrow uppercase tracking-[0.09em] text-faint">
                  Protocol fee
                </dt>
                <dd className="num mt-1 text-xl">
                  <CountUp value={PEXO_CONFIG.protocol.feeBps} format={bps} />
                </dd>
              </div>
            </dl>
          </Reveal>

          <Reveal kind="rise" delay={300}>
            <Button href={keeper.button.href} variant="secondary" withArrow>
              {keeper.button.label}
            </Button>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
