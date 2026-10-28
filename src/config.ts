import { asset } from './base';

export const config = {
  // Scroll distances are viewport heights, independent of video durations.
  // After the static title, sticky reveal→zoom scrubs Figma 12:464 TV enlarge (zoom.mp4),
  // then feature plays the walking-cat tail of combined video-1 from driveEndRatio.
  // After spatial-sound finale: fade to black → play Figma 34:547 Video 2 once → text 28:541.
  distances: {
    reveal: 0.45,
    zoom: 0.85,
    feature: 1.3,
    retreat: 2.5,
    comparison: 1.5,
    orbit: 2.5,
    // Long enough that typical scroll doesn't outrun video-4 (~4s) before `ended`.
    finale: 3.5,
    // Sticky stay covers ~5s ambience play-once + 28:541 text soft-enter.
    ambience: 4.5,
    // Figma 54:751 — scroll-scrub TV rotate (~2s file); title/body fade early.
    rotate: 2.4,
    // Figma 54:848 — lift plate + reveal 4 UTPs (reverse: UTPs out, then scrub back).
    obsolete: 2.2,
  },
  // Soft opacity fade-in for the zoom layer at the start of reveal (scale lives in zoom.mp4).
  reveal: { from: 0, to: 0.35, scale: 0.52 },
  zoom: { from: 0.52, to: 1 },
  text: { enterEnd: 0.2, leaveEnd: 0.16 },
  // Last screen (ambience / “finale” 5.04s): 1st scroll starts video after black;
  // 2nd scroll (turnOnAt) TV/text soft-enter; video keeps playing to file end.
  ambience: { blackEnd: 0.12, videoIn: 0.26, turnOnAt: 0.42 },
  // Combined video-1 (Figma 17:466 appear+drive + walking cat). driveEndRatio = start of walking-cat tail.
  driveEndRatio: 0.2634,
  // Feature video-1 plays once after zoom; retreat/orbit scrub; finale + ambience play once.
  playback: { loopVideo1: false, loopVideo4: false, crossfadeMs: 280, seekTolerance: 0.035, video1Rate: 1.5 },
  /** Figma 12:464 — scroll-scrubbed TV enlarge before feature. */
  zoomMedia: {
    src: asset('media/zoom.mp4'),
    poster: asset('media/zoom-start.jpg'),
    end: asset('media/zoom-end.jpg'),
  },
  /** Figma 34:547 Video 2 (28:538) — play once on scroll after spatial sound. */
  ambienceMedia: {
    src: asset('media/ambience.mp4'),
    poster: asset('media/ambience-start.jpg'),
    end: asset('media/ambience-end.jpg'),
  },
  /** Figma 54:751 / 54:752 — scroll-scrubbed rotate (no autoplay/loop). */
  rotateMedia: {
    src: asset('media/rotate.mp4'),
    poster: asset('media/rotate-start.jpg'),
    end: asset('media/rotate-end.jpg'),
  },
  // Early soft-enter for 54:854 / 54:855 during rotate scrub.
  rotate: { titleIn: 0.06, titleEnd: 0.22, bodyIn: 0.14, bodyEnd: 0.34 },
  // Plate lift + UTP reveal during obsolete (progress 0→1).
  obsolete: { liftPx: 210, utpIn: 0.12, utpEnd: 0.42 },
  media: [1, 2, 3, 4].map(n => ({
    src: asset(`media/video-${n}.mp4`),
    poster: asset(`media/video-${n}-start.jpg`),
    end: asset(`media/video-${n}-end.jpg`),
  })),
} as const;

/** 0–1 progress through Figma 12:464 zoom.mp4 across reveal→zoom. */
export function zoomProgress(phase: Phase, progress: number): number {
  if (phase === 'reveal') return smooth(progress) * 0.4;
  if (phase === 'zoom') return 0.4 + smooth(progress) * 0.6;
  return 1;
}

/** @deprecated Use zoomProgress — kept for any leftover imports. */
export const driveHeadProgress = zoomProgress;

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
  return { phase: 'obsolete', progress: 1 };
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
  ambience: { title: string; body: string } | null;
  neverObsolete: {
    title: string;
    body: string;
    utps: { icon: string; title: string; body: string }[];
  } | null;
  comparison: null | {
    mini: string;
    rgb: string;
    // Normalized screen corners in the final video-2 frame, clockwise from top left.
    corners: [[number, number], [number, number], [number, number], [number, number]];
  };
}
