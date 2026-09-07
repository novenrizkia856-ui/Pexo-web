import { Suspense, lazy, useEffect } from "react";
import { ScrollTracker } from "@/components/scroll-tracker";
import { ScrollRail } from "@/components/scroll-rail";
import { SiteHeader } from "@/components/site-header";
import { initPointerGlow } from "@/lib/pointer-glow";
import { HeroSection } from "@/sections/hero-section";
import { ProblemSection } from "@/sections/problem-section";
import { HowSection } from "@/sections/how-section";
import { GuaranteesSection } from "@/sections/guarantees-section";
import { AssetsSection } from "@/sections/assets-section";
import { KeeperSection } from "@/sections/keeper-section";
import { SiteFooter } from "@/sections/site-footer";

// three.js is ~600kB and is only ever used by the landing backdrop. Splitting it
// out keeps it off the app route entirely, and off the critical path here.
const FloorCorridor = lazy(() =>
  import("@/components/floor-corridor").then((m) => ({ default: m.FloorCorridor })),
);

export function LandingRoute() {
  useEffect(() => initPointerGlow(), []);

  return (
    <>
      <ScrollTracker />
      <Suspense fallback={null}>
        <FloorCorridor />
      </Suspense>
      <SiteHeader />
      <ScrollRail />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowSection />
        <GuaranteesSection />
        <AssetsSection />
        <KeeperSection />
      </main>
      <SiteFooter />
    </>
  );
}
