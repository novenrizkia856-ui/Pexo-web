import { animated, useSpring } from "@react-spring/web";
import { landing } from "@/content/landing";
import { Button } from "@/components/ui";
import { LineReveal, Reveal } from "@/components/motion";
import { useExperience } from "@/state/experience";

export function HeroSection() {
  const moved = useExperience((s) => s.moved);
  const { hero } = landing;

  const cue = useSpring({
    opacity: moved ? 0 : 1,
    transform: moved ? "translateY(6px)" : "translateY(0px)",
    config: { tension: 180, friction: 26 },
  });

  return (
    <section
      aria-label="Pexo introduction"
      className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
    >
      <LineReveal
        tag="h1"
        lines={hero.titleLines}
        className="pxo-display mb-10 max-w-title text-balance"
        quietFrom={1}
        delay={120}
        stagger={110}
      />

      <Reveal tag="p" kind="blur" delay={480} className="pxo-lead mb-12 max-w-lead text-pretty">
        {hero.subtitle}
      </Reveal>

      <Reveal
        kind="scale"
        delay={640}
        className="flex gap-3 max-sm:w-full max-sm:max-w-72 max-sm:flex-col"
      >
        {hero.buttons.map((button) => (
          <Button
            key={button.label}
            href={button.href}
            variant={button.variant}
            withArrow={"withArrow" in button ? button.withArrow : false}
          >
            {button.label}
          </Button>
        ))}
      </Reveal>

      <animated.span
        style={cue}
        aria-hidden="true"
        className="pxo-scroll-cue absolute bottom-9 text-eyebrow uppercase tracking-[0.18em] text-faint"
      >
        {hero.scrollCue}
      </animated.span>
    </section>
  );
}
