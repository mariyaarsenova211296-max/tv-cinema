import { asset } from './base';

export const config = {
  // STV-44: scroll approach → autoplay video-2 (gated) → stronger scale retreat →
  // RGB→DLG UTPs → scroll orbit (video-3) into sound framing → Dolby finale.
  distances: {
    approach: 1.6, // scroll-driven TV approach before clip
    autoplay: 0.2, // locked while video-2 plays; scroll discarded
    waitClose: 0.35, // parked on close-up until new scroll
    retreat: 2.2, // stronger scale-only pull-back to UTP framing
    comparison: 1.6, // RGB-miniled
    utpDlg: 1.6, // DLG 288 гц
    orbit: 2.4, // scroll-driven camera retreat/angle (video-3) before sound
    finale: 3.5,
    ambience: 4.5,
    rotate: 3.2,
    obsolete: 2.2,
  },
  // Soft opacity fade-in during approach.
  reveal: { from: 0, to: 0.28 },
  // UTP card fades ~0.7s feel via enter/leave window + CSS transition.
  text: { enterEnd: 0.22, leaveEnd: 0.22 },
  ambience: { blackEnd: 0.12, videoIn: 0.26, turnOnAt: 0.42 },
  driveEndRatio: 0.2634,
  // Early video-3 frame: horse + sitting cat (freeze / UTP still).
  utpHoldRatio: 0.04,
  // Single breath scale rail (applied once via --breath-scale; crop is separate).
  // Approach far→close stitches into autoplay; retreat close→utp is a clear pull-back.
  breathScale: { far: 0.62, close: 1.42, utp: 0.92, sound: 1 },
  // Letterbox crop on the decoded plane — never multiply with breath on another node.
  cropScale: 1.12,
  playback: { loopVideo1: false, loopVideo4: false, crossfadeMs: 280, seekTolerance: 0.035, video1Rate: 1.5 },
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

/** Start of autoplay lock (= end of scroll approach). */
export const autoplayLockStart = phaseOffset('autoplay');

/**
 * STV-44 story resolver:
 * - approach is scroll-mapped normally
 * - once past approach, force autoplay until the clip finishes
 * - then map from unlock baseline so mid-play scroll is discarded (no retreat queue)
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

/** Single breath scale rail — stitch approach end == autoplay/wait close. */
export function breathMediaScale(phase: Phase, progress: number): number {
  const { far, close, utp, sound } = config.breathScale;
  if (phase === 'approach') return far + (close - far) * smooth(progress);
  if (phase === 'autoplay' || phase === 'waitClose') return close;
  if (phase === 'retreat') return close + (utp - close) * smooth(progress);
  if (phase === 'comparison' || phase === 'utpDlg') return utp;
  if (phase === 'orbit') return utp + (sound - utp) * smooth(progress);
  return sound;
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
