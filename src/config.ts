import { asset } from './base';

export const config = {
  // STV-43: after breath-hold — autoplay video-2 once (scroll discarded), stop on
  // horse+sitting-cat (video-3 stitch), wait for NEW scroll → scale-only retreat,
  // then static Mini→RGB→DLG UTPs, then spatial sound finale as before.
  distances: {
    autoplay: 0.2, // enter sticky; progress ignored until play finishes
    waitClose: 0.4, // parked on close-up until new scroll
    retreat: 1.5, // scale-only pull-back of the still
    utpMini: 1.6,
    comparison: 1.6,
    utpDlg: 1.6,
    finale: 3.5,
    ambience: 4.5,
    rotate: 3.2,
    obsolete: 2.2,
  },
  // Soft opacity fade-in when sticky media appears.
  reveal: { from: 0, to: 0.35, scale: 0.52 },
  zoom: { from: 0.52, to: 1 },
  // UTP card fades ~0.7s feel via enter/leave window + CSS transition.
  text: { enterEnd: 0.22, leaveEnd: 0.22 },
  ambience: { blackEnd: 0.12, videoIn: 0.26, turnOnAt: 0.42 },
  driveEndRatio: 0.2634,
  // Early video-3 frame: horse + sitting cat (freeze / UTP still).
  utpHoldRatio: 0.04,
  // Close-up scale while waiting; retreat eases down to 1.
  breathScale: { close: 1.2, retreated: 1 },
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

/** Phases after autoplay unlock (scroll maps here; autoplay scroll is discarded). */
export const postAutoplayPhases = phases.filter(p => p !== 'autoplay');

export function resolvePhase(distance: number): { phase: Phase; progress: number } {
  for (const phase of phases) {
    const start = phaseOffset(phase);
    if (distance < start + config.distances[phase]) return { phase, progress: clamp((distance - start) / config.distances[phase]) };
  }
  return { phase: 'obsolete', progress: 1 };
}

/**
 * STV-43 story resolver: force autoplay until done; then map scroll from unlock
 * baseline so scroll during autoplay is discarded (not queued into retreat).
 */
export function resolveBreathStory(
  distance: number,
  autoplayDone: boolean,
  unlockDistance: number,
): { phase: Phase; progress: number } {
  if (!autoplayDone) return { phase: 'autoplay', progress: 0 };
  const post = Math.max(0, distance - unlockDistance);
  const waitStart = phaseOffset('waitClose');
  return resolvePhase(waitStart + post);
}

/** Scale for breath media: close-up until retreat progresses. */
export function breathMediaScale(phase: Phase, progress: number): number {
  const { close, retreated } = config.breathScale;
  if (phase === 'autoplay' || phase === 'waitClose') return close;
  if (phase === 'retreat') return close + (retreated - close) * smooth(progress);
  if (phase === 'utpMini' || phase === 'comparison' || phase === 'utpDlg') return retreated;
  return 1;
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
