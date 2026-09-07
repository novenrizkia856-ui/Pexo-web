import { useEffect } from "react";
import { heroProgress, scrollProgress, useExperience } from "@/state/experience";

/**
 * Writes normalised page scroll into the shared progress value, and syncs the
 * coarse phase into the store. Renders nothing.
 */
export function ScrollTracker() {
  const sync = useExperience((s) => s.sync);

  useEffect(() => {
    let frame = 0;

    function measure() {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      scrollProgress.current = progress;
      heroProgress.current =
        window.innerHeight > 0 ? window.scrollY / window.innerHeight : 0;
      sync(progress);
    }

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sync]);

  return null;
}
