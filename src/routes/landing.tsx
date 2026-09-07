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
import { CaSection } from "@/sections/ca-section";
import { KeeperSection } from "@/sections/keeper-section";
import { SiteFooter } from "@/sections/site-footer";

// three.js is ~600kB and is only ever used by the landing backdrop. Splitting it
// out keeps it off the app route entirely, and off the critical path here.
const FloorField = lazy(() =>
  import("@/components/floor-field").then((m) => ({ default: m.FloorField })),
);

export function LandingRoute() {
  useEffect(() => initPointerGlow(), []);

  return (
    <>
      <ScrollTracker />
      <Suspense fallback={null}>
        <FloorField />
      </Suspense>
      <SiteHeader />
      <ScrollRail />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowSection />
        <GuaranteesSection />
        <AssetsSection />
        <CaSection />
        <KeeperSection />
      </main>
      <SiteFooter />
    </>
  );
}
