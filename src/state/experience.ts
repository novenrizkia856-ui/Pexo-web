import { create } from "zustand";

/**
 * A single scroll-progress value drives the whole landing experience: the 3D
 * backdrop reads it every frame, and section chrome reads the derived phase.
 *
 * Progress is kept in a mutable ref-like object rather than in the store so the
 * render loop can sample it at 60fps without triggering React updates. Only the
 * coarse phase — which changes a handful of times per page — lives in state.
 */
export const scrollProgress = { current: 0 };

/**
 * Scroll measured in viewport heights rather than as a fraction of the page.
 *
 * The hero is one viewport tall, so anything keyed to leaving the hero must use
 * this — whole-page progress depends on total document height, which changes
 * with viewport width and content, and would stretch a hero-length transition
 * across thousands of pixels on a long page.
 */
export const heroProgress = { current: 0 };

export type Phase = "hero" | "body" | "close";

const PHASE_THRESHOLDS = {
  /** Hero holds until the first section is genuinely engaged. */
  heroLeave: 0.08,
  /** The closing stretch, where the backdrop settles onto the floor plane. */
  closeEnter: 0.82,
} as const;

function phaseFor(progress: number): Phase {
  if (progress < PHASE_THRESHOLDS.heroLeave) return "hero";
  if (progress < PHASE_THRESHOLDS.closeEnter) return "body";
  return "close";
}

type ExperienceState = {
  phase: Phase;
  /** True once the user has scrolled at all — used to retire the scroll cue. */
  moved: boolean;
  sync: (progress: number) => void;
};

export const useExperience = create<ExperienceState>((set, get) => ({
  phase: "hero",
  moved: false,
  sync: (progress) => {
    const phase = phaseFor(progress);
    const moved = progress > 0.01;
    const prev = get();
    if (prev.phase === phase && prev.moved === moved) return;
    set({ phase, moved });
  },
}));
