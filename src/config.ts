import { asset } from './base';

export const config = {
  // Scroll distances are viewport heights, independent of video durations.
  // STV-41/42: after breath-hold, full video-2 (72:1038) scrub approach→retreat.
  // Frozen horse+cat still (video-3 hold): Mini LED → RGB → DLG, then orbit scrub.
  distances: {
    reveal: 0.45,
    zoom: 1.1,
    feature: 1.6,
    retreat: 2.2,
    utpMini: 1.6, // Mini LED UTP on freeze still
    comparison: 1.6, // RGB-miniled UTP (81:2087)
    utpDlg: 1.6, // DLG 288 гц UTP (81:2180)
    orbit: 2.5, // camera pull-away scrub of video-3
    // Long enough that typical scroll doesn't outrun video-4 (~4s) before `ended`.
    finale: 3.5,
    // Sticky stay covers ~5s ambience play-once + 28:541 text soft-enter.
    ambience: 4.5,
    // Figma 54:751 — scroll-scrub TV rotate (~4s full export); title/body fade early.
    rotate: 3.2,
    // Figma 54:848 — lift plate + reveal 4 UTPs (reverse: UTPs out, then scrub back).
    obsolete: 2.2,
  },
  // Soft opacity fade-in at the start of reveal (media is video-2, not zoom.mp4).
  reveal: { from: 0, to: 0.35, scale: 0.52 },
  zoom: { from: 0.52, to: 1 },
  text: { enterEnd: 0.2, leaveEnd: 0.16 },
  // Last screen (ambience / “finale” 5.04s): 1st scroll starts video after black;
  // 2nd scroll (turnOnAt) TV/text soft-enter; video keeps playing to file end.
  ambience: { blackEnd: 0.12, videoIn: 0.26, turnOnAt: 0.42 },
  // Legacy combined video-1 ratio — unused for breath flow after STV-41.
  driveEndRatio: 0.2634,
  // Hold UTP cards on an early video-3 frame (cat + cowboy) matching 81:2086.
  utpHoldRatio: 0.04,
  playback: { loopVideo1: false, loopVideo4: false, crossfadeMs: 280, seekTolerance: 0.035, video1Rate: 1.5 },
  /** @deprecated STV-41 — stray zoom.mp4 removed from breath flow; kept for asset refs. */
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
  /** Figma 54:751 / 54:752 — full ~4s VIDEO fill, scroll-scrubbed (no autoplay/loop). */
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

const breathPhases = ['reveal', 'zoom', 'feature', 'retreat'] as const;

/** 0–1 progress through full video-2 across reveal→zoom→feature→retreat (no trim). */
export function breathVideoProgress(phase: Phase, progress: number): number {
  const total = breathPhases.reduce((sum, p) => sum + config.distances[p], 0);
  let offset = 0;
  for (const p of breathPhases) {
    if (phase === p) return clamp((offset + smooth(progress) * config.distances[p]) / total);
    offset += config.distances[p];
  }
  if (phase === 'utpMini' || phase === 'comparison' || phase === 'utpDlg' || phase === 'orbit' || phase === 'finale' || phase === 'ambience' || phase === 'rotate' || phase === 'obsolete') {
    return 1;
  }
  return 0;
}

/** @deprecated STV-41 — zoom.mp4 scrub removed; breath uses breathVideoProgress. */
export function zoomProgress(phase: Phase, progress: number): number {
  return breathVideoProgress(phase, progress);
}

/** @deprecated Use breathVideoProgress — kept for any leftover imports. */
export const driveHeadProgress = breathVideoProgress;

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
