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

// The backdrop is canvas 2D and costs a few kB, but it is still only ever used
// here, so it stays split out and off the app route.
const PriceField = lazy(() =>
  import("@/components/price-field").then((m) => ({ default: m.PriceField })),
);

export function LandingRoute() {
  useEffect(() => initPointerGlow(), []);

  return (
    <>
      <ScrollTracker />
      <Suspense fallback={null}>
        <PriceField />
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
