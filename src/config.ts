import { asset } from './base';

/**
 * STV-50 — HOLD_RIDER = seated cat + rider (not boatman).
 *
 * SCROLL_APPROACH → AUTO_PLAY (boat→lizard→sit) → content-swap rider →
 * HOLD_RIDER freeze → NEW scroll CSS-scale retreat on THAT still
 * (never scrub video-3 during retreat — cat stands/runs by ~0.5s).
 *
 * Continuous boat→lizard→horse file still missing; AUTO_PLAY uses video-1
 * then swaps screen content to video-3@riderHoldSec (geometry differs).
 */
export const timebase = {
  fps: 24,
  video1Sec: 7.75,
  video2Sec: 5.041667,
  video3Sec: 5.041667,
  /** SCROLL_APPROACH end on video-2 (scrub only; no CSS zoom). */
  approachEndSec: 1.75,
  /** AUTO_PLAY start on video-1 — boat beat. */
  autoplayStartSec: 4.0,
  /** First fully seated cat on video-1 (lizard on TV) — then swap to rider. */
  sitSec: 7.0,
  /** HOLD_RIDER on video-3 — seated cat + horse/rider (= video-3-utp.jpg). */
  riderHoldSec: 0.083,
} as const;

/** Explicit TZ control states — one media source + one driver each. */
export type BreathState =
  | 'SCROLL_APPROACH'
  | 'AUTO_PLAY'
  | 'HOLD_RIDER'
  | 'SCROLL_OUTRO';

export const config = {
  // STV-50: approach scrub → autoplay boat→sit → HOLD rider still → CSS retreat.
  distances: {
    approach: 1.8, // SCROLL_APPROACH — scrub video-2 0→approachEndSec
    autoplay: 0.2, // AUTO_PLAY lock; mid-scroll discarded
    waitClose: 0.35, // HOLD_RIDER — freeze video-3@riderHoldSec
    retreat: 2.0, // HOLD_RIDER — CSS scale-only (NO video-3 scrub)
    comparison: 1.6, // HOLD_RIDER — RGB UTP on rider still
    utpDlg: 1.6, // HOLD_RIDER — DLG UTP on rider still
    orbit: 2.8, // SCROLL_OUTRO — keep rider still (no scrub; cat would run)
    finale: 3.5,
    ambience: 4.5,
    rotate: 3.2,
    obsolete: 2.2,
  },
  reveal: { from: 0, to: 0.28 },
  text: { enterEnd: 0.22, leaveEnd: 0.22 },
  ambience: { blackEnd: 0.12, videoIn: 0.26, turnOnAt: 0.42 },
  driveEndRatio: 0.2634,
  timebase,
  utpHoldRatio: timebase.riderHoldSec / timebase.video3Sec,
  // No dual CSS+recorded zoom: approach = scrub only (scale 1); retreat = scale only.
  breathScale: { play: 1, close: 1, utp: 0.88, sound: 0.88 },
  cropScale: 1,
  playback: {
    loopVideo1: false,
    loopVideo4: false,
    crossfadeMs: 280,
    breathCrossfadeMs: 0,
    seekTolerance: 0.035,
    breathRate: 1,
  },
  zoomMedia: {
    src: asset('media/zoom.mp4'),
    poster: asset('media/zoom-start.jpg'),
    end: asset('media/zoom-end.jpg'),
  },
  ambienceMedia: {
    src: asset('media/ambience.mp4'),
    poster: asset('media/ambience-start.jpg'),
    end: asset('media/ambience-end.jpg'),
  },
  rotateMedia: {
    src: asset('media/rotate.mp4'),
    poster: asset('media/rotate-start.jpg'),
    end: asset('media/rotate-end.jpg'),
  },
  rotate: { titleIn: 0.06, titleEnd: 0.22, bodyIn: 0.14, bodyEnd: 0.34 },
  obsolete: { liftPx: 210, utpIn: 0.12, utpEnd: 0.42 },
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

export const autoplayLockStart = phaseOffset('autoplay');

/**
 * Map scroll phase → TZ breath state (breath segment only).
 * HOLD_RIDER covers wait/retreat/UTPs (scale-only after freeze).
 * Returns null outside the four-state breath block.
 */
export function resolveBreathState(phase: Phase, autoplayDone: boolean): BreathState | null {
  if (phase === 'approach') return 'SCROLL_APPROACH';
  if (phase === 'autoplay' || !autoplayDone) return 'AUTO_PLAY';
  if (phase === 'orbit') return 'SCROLL_OUTRO';
  if (
    phase === 'waitClose'
    || phase === 'retreat'
    || phase === 'comparison'
    || phase === 'utpDlg'
  ) return 'HOLD_RIDER';
  return null;
}

/**
 * Story resolver:
 * - SCROLL_APPROACH while distance < autoplay lock
 * - force AUTO_PLAY until done (mid-scroll discarded)
 * - then map from unlock baseline (NEW scroll → HOLD then SCROLL_OUTRO)
 */
export function resolveBreathStory(
  distance: number,
  autoplayDone: boolean,
  unlockDistance: number,
): { phase: Phase; progress: number } {
  if (distance < autoplayLockStart) {
    return resolvePhase(distance);
  }
  if (!autoplayDone) {
    return { phase: 'autoplay', progress: 0 };
  }
  const post = Math.max(0, distance - unlockDistance);
  const waitStart = phaseOffset('waitClose');
  return resolvePhase(waitStart + post);
}

export function resolvePhase(distance: number): { phase: Phase; progress: number } {
  for (const phase of phases) {
    const start = phaseOffset(phase);
    if (distance < start + config.distances[phase]) return { phase, progress: clamp((distance - start) / config.distances[phase]) };
  }
  return { phase: 'obsolete', progress: 1 };
}

/** Scale rail — never combined with scrub on the same state. */
export function breathMediaScale(phase: Phase, progress: number): number {
  const { play, close, utp, sound } = config.breathScale;
  if (phase === 'approach') return play + (close - play) * smooth(progress);
  if (phase === 'autoplay' || phase === 'waitClose') return close;
  if (phase === 'retreat') return close + (utp - close) * smooth(progress);
  if (phase === 'comparison' || phase === 'utpDlg') return utp;
  // SCROLL_OUTRO: scrub only — keep utp (sound == utp).
  if (phase === 'orbit') return sound;
  return sound;
}

/** SCROLL_APPROACH scrub: 0 → approachEndSec. */
export function approachScrubSec(progress: number): number {
  return timebase.approachEndSec * smooth(progress);
}

/**
 * STV-50: SCROLL_OUTRO does not scrub video-3 (would stand/run the cat).
 * Kept for API compat — always returns rider hold.
 */
export function outroScrubSec(_progress: number): number {
  return timebase.riderHoldSec;
}

/** @deprecated — use outroScrubSec */
export function orbitScrubSec(progress: number): number {
  return outroScrubSec(progress);
}

/** @deprecated */
export function breathVideoProgress(_phase: Phase, _progress: number): number {
  return 0;
}
/** @deprecated */
export function zoomProgress(phase: Phase, progress: number): number {
  return breathVideoProgress(phase, progress);
}
/** @deprecated */
export const driveHeadProgress = breathVideoProgress;

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
    corners: [[number, number], [number, number], [number, number], [number, number]];
  };
}
