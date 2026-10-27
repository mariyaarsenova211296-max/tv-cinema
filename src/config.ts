import { asset } from './base';

export const config = {
  // Scroll distances are viewport heights, independent of video durations.
  // Title is a static section; sticky stage opens on full-size video (brief hold), then scroll-linked scrub.
  distances: { reveal: 0.35, zoom: 0.25, feature: 1.3, retreat: 2.5, comparison: 1.5, orbit: 2.5, finale: 1.5 },
  reveal: { from: 0, to: 0, scale: 1 },
  zoom: { from: 1, to: 1 },
  text: { enterEnd: 0.2, leaveEnd: 0.16 },
  // Video 1 plays once to its final frame after the static title; later clips are scroll-scrubbed (finale plays).
  playback: { loopVideo1: false, loopVideo4: true, crossfadeMs: 280, seekTolerance: 0.035 },
  media: [1, 2, 3, 4].map(n => ({
    src: asset(`media/video-${n}.mp4`),
    poster: asset(`media/video-${n}-start.jpg`),
    end: asset(`media/video-${n}-end.jpg`),
  })),
} as const;

export type Phase = keyof typeof config.distances;
export const phases = Object.keys(config.distances) as Phase[];
export const totalDistance = Object.values(config.distances).reduce((a, b) => a + b, 0);
export const phaseOffset = (phase: Phase) => phases.slice(0, phases.indexOf(phase)).reduce((a, b) => a + config.distances[b], 0);
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smooth = (p: number) => { const n = clamp(p); return n * n * (3 - 2 * n); };
export function resolvePhase(distance: number): { phase: Phase; progress: number } {
  for (const phase of phases) {
    const start = phaseOffset(phase);
    if (distance < start + config.distances[phase]) return { phase, progress: clamp((distance - start) / config.distances[phase]) };
  }
  return { phase: 'finale', progress: 1 };
}

export interface DesignCard {
  src: string;
  alt: string;
  href?: string;
  aspectRatio: string;
  width?: number;
}

export interface Design {
  logo: { src: string; alt: string } | null;
  menu: { label: string; href: string; primary?: boolean; active?: boolean }[];
  utilities: { label: string; icon: string; href: string }[];
  cta: { label: string; price: string; href: string; thumb: string } | null;
  cardsTitle: string | null;
  cards: DesignCard[];
  revealTitle: string | null;
  comparisonLabels: { mini: string; rgb: string } | null;
  comparisonFeatures: { icon: string; title: string; body: string }[];
  finale: { eyebrow: string; title: string; body: string } | null;
  comparison: null | {
    mini: string;
    rgb: string;
    // Normalized screen corners in the final video-2 frame, clockwise from top left.
    corners: [[number, number], [number, number], [number, number], [number, number]];
  };
}
