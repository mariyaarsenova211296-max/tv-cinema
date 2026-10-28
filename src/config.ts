import { asset } from './base';

/**
 * STV-45 media timebases (seconds @ 24fps).
 * Confirmed against public/media/video-{2,3}.mp4 + Figma 81:2086 still.
 */
export const timebase = {
  fps: 24,
  video2Sec: 5.041667,
  video3Sec: 5.041667,
  /** Scroll approach ends here — camera settle / final close-up; then autoplay. */
  approachEndSec: 1.75,
  /** Horse + sitting cat freeze (Figma 81:2086 / 72:1864 / 81:1994). */
  utpHoldSec: 0.2,
  /** Scroll cat-exit / camera pull ends before horse-return tail (~4.25s). */
  catExitEndSec: 2.5,
} as const;

export const config = {
  // STV-45: scroll-scrub approach (no CSS auto-zoom) → autoplay after close-up →
  // still → scale retreat → RGB→DLG UTPs below cat → scroll cat-exit → sound.
  distances: {
    approach: 1.8, // scroll-scrub video-2 0→approachEndSec
    autoplay: 0.2, // locked while clip plays; scroll discarded
    waitClose: 0.35, // still on horse+sitting-cat until new scroll
    retreat: 2.0, // scale-only pull-back to UTP framing, then stop
    comparison: 1.6, // RGB-miniled (72:1864 / 72:1975)
    utpDlg: 1.6, // DLG 288 гц (81:1994 / 72:1938)
    orbit: 2.2, // scroll-driven cat exit (video-3 hold→catExitEnd)
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
  /** Hold ratio on video-3 (utpHoldSec / video3Sec). */
  utpHoldRatio: timebase.utpHoldSec / timebase.video3Sec,
  // Breath scale: approach is IN the video — no CSS far→close zoom.
  // Retreat pulls the still back for UTP space below the cat.
  breathScale: { play: 1, utp: 0.88, sound: 1 },
  cropScale: 1.12,
  // Breath transitions hard-cut (no dual-frame crossfade ghosts).
  playback: {
    loopVideo1: false,
    loopVideo4: false,
    crossfadeMs: 280,
    breathCrossfadeMs: 0,
    seekTolerance: 0.035,
    video1Rate: 1.5,
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
 * STV-45 story resolver:
 * - approach scroll-mapped (video scrub)
 * - past approach → force autoplay until clip reaches horse+sitting-cat
 * - then map from unlock baseline (mid-play scroll discarded)
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

/** Breath scale rail — approach lives in video; CSS only retreats for UTPs. */
export function breathMediaScale(phase: Phase, progress: number): number {
  const { play, utp, sound } = config.breathScale;
  if (phase === 'approach' || phase === 'autoplay' || phase === 'waitClose') return play;
  if (phase === 'retreat') return play + (utp - play) * smooth(progress);
  if (phase === 'comparison' || phase === 'utpDlg') return utp;
  if (phase === 'orbit') return utp + (sound - utp) * smooth(progress);
  return sound;
}

/** Scroll-scrub time (sec) during approach: 0 → approachEndSec. */
export function approachScrubSec(progress: number): number {
  return timebase.approachEndSec * smooth(progress);
}

/** Scroll-scrub time (sec) during orbit/cat-exit: hold → catExitEnd. */
export function orbitScrubSec(progress: number): number {
  const { utpHoldSec, catExitEndSec } = timebase;
  return utpHoldSec + (catExitEndSec - utpHoldSec) * smooth(progress);
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
