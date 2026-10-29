import { asset } from './base';

/**
 * STV-51 — ONE continuous breath source (Section 5 storyboard).
 *
 * SCROLL_APPROACH → scrub 0→1.0s
 * AUTO_PLAY → play 1.0→7.0 @1× (mars→dino→boat→lizard→rider+sit)
 *   — no scroll-driven currentTime; no source swap
 * HOLD_RIDER → freeze @7.0 (rider + sitting cat, close)
 * SCROLL_OUTRO → pause + scrub 7+(duration-7)*progress to end
 *   — video-driven retreat, NOT CSS scale
 *
 * True storyboard file still missing (see manifest). Interim stand-in is
 * video-1 bytes as breath-story.mp4 (lizard@7, not rider) — never a v1→v3 jump.
 */
export const timebase = {
  fps: 24,
  video1Sec: 7.75,
  video2Sec: 5.041667,
  video3Sec: 5.041667,
  /** SCROLL_APPROACH end — scrub only 0→1.0s. */
  approachEndSec: 1.0,
  /** AUTO_PLAY window on the same clip. */
  autoplayStartSec: 1.0,
  /** HOLD_RIDER freeze (storyboard: rider + sitting cat). */
  holdSec: 7.0,
  sitSec: 7.0,
} as const;

/** Explicit TZ control states — one media source + one driver each. */
export type BreathState =
  | 'SCROLL_APPROACH'
  | 'AUTO_PLAY'
  | 'HOLD_RIDER'
  | 'SCROLL_OUTRO';

export const config = {
  // STV-51: approach scrub → autoplay → hold@7 → video outro scrub (no CSS retreat).
  distances: {
    approach: 1.8, // SCROLL_APPROACH — scrub 0→1.0s
    autoplay: 0.2, // AUTO_PLAY lock; mid-scroll discarded
    waitClose: 0.35, // HOLD_RIDER — freeze @7.0
    retreat: 2.0, // SCROLL_OUTRO — video scrub (no CSS scale)
    comparison: 1.6, // SCROLL_OUTRO — RGB UTP while scrubbing
    utpDlg: 1.6, // SCROLL_OUTRO — DLG UTP while scrubbing
    orbit: 2.8, // SCROLL_OUTRO — continue scrub to end
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
  // No CSS zoom/retreat — approach + outro are video-driven; scale stays 1.
  breathScale: { play: 1, close: 1, utp: 1, sound: 1 },
  cropScale: 1,
  playback: {
    loopVideo1: false,
    loopVideo4: false,
    crossfadeMs: 280,
    breathCrossfadeMs: 0,
    seekTolerance: 0.035,
    breathRate: 1,
  },
  /** Single continuous breath clip — Section 5 scheme. */
  breathMedia: {
    src: asset('media/breath-story.mp4'),
    poster: asset('media/breath-story-start.jpg'),
    end: asset('media/breath-story-end.jpg'),
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

const OUTRO_PHASES: Phase[] = ['retreat', 'comparison', 'utpDlg', 'orbit'];
export const outroDistance = OUTRO_PHASES.reduce((a, p) => a + config.distances[p], 0);

/**
 * Map scroll phase → TZ breath state (breath segment only).
 * HOLD_RIDER = brief freeze @7; retreat+UTPs+orbit = SCROLL_OUTRO (video scrub).
 */
export function resolveBreathState(phase: Phase, autoplayDone: boolean): BreathState | null {
  if (phase === 'approach') return 'SCROLL_APPROACH';
  if (phase === 'autoplay' || !autoplayDone) return 'AUTO_PLAY';
  if (phase === 'waitClose') return 'HOLD_RIDER';
  if (OUTRO_PHASES.includes(phase)) return 'SCROLL_OUTRO';
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

/** Scale rail — always 1 on breath (no CSS retreat; outro is video scrub). */
export function breathMediaScale(phase: Phase, progress: number): number {
  const { play, close, utp, sound } = config.breathScale;
  if (phase === 'approach') return play + (close - play) * smooth(progress);
  if (phase === 'autoplay' || phase === 'waitClose') return close;
  if (phase === 'retreat' || phase === 'comparison' || phase === 'utpDlg' || phase === 'orbit') return utp;
  return sound;
}

/** SCROLL_APPROACH scrub: 0 → approachEndSec (1.0). */
export function approachScrubSec(progress: number): number {
  return timebase.approachEndSec * smooth(progress);
}

/**
 * Combined 0→1 progress across SCROLL_OUTRO phases (retreat→orbit).
 */
export function outroBlockProgress(phase: Phase, progress: number): number {
  if (!OUTRO_PHASES.includes(phase)) return phase === 'waitClose' ? 0 : 1;
  let traveled = 0;
  for (const p of OUTRO_PHASES) {
    if (p === phase) {
      return clamp((traveled + progress * config.distances[p]) / outroDistance);
    }
    traveled += config.distances[p];
  }
  return 1;
}

/**
 * SCROLL_OUTRO scrub: 7 + (duration − 7) * progress → end.
 * Pass measured media duration; falls back to video1Sec if unknown.
 */
export function outroScrubSec(progress: number, duration: number = timebase.video1Sec): number {
  const hold = timebase.holdSec;
  const last = Math.max(hold, duration - 1 / 24);
  const span = Math.max(0, last - hold);
  return hold + span * smooth(progress);
}

/** @deprecated — use outroScrubSec */
export function orbitScrubSec(progress: number, duration: number = timebase.video1Sec): number {
  return outroScrubSec(progress, duration);
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
