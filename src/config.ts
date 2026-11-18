import { asset } from './base';

/**
 * STV-77 · smoother continuous breath-space scroll-scrub.
 * Sole visual = breath-space.mp4. No image inserts / hold pauses.
 * Captions fade by video time (bidirectional). toSound → sound poster → finale.
 */
export const timebase = {
  fps: 30,
  lastFrameSec: 20.0,
  breathSec: 20.066667,
  /** Planet / RGB caption window (video seconds). */
  planetSec: 4.867,
  rgbBodySec: 7.2,
  rgbOutSec: 9.5,
  dlgStartSec: 10.0,
  dlgEndSec: 11.3,
} as const;

/**
 * Continuous scrub segments — no hold inserts.
 * STV-77: ~1.7× scroll height vs STV-75 so the same 20s maps to more wheel travel.
 */
export const breathSegments = [
  { phase: 'breathStart', distance: 2.5, t0: 0, t1: 4.867 },
  { phase: 'breathPlanet', distance: 1.1, t0: 4.867, t1: 6.033 },
  { phase: 'breathClose', distance: 1.0, t0: 6.033, t1: 7.4 },
  { phase: 'breathToFlight', distance: 1.2, t0: 7.4, t1: 10.0 },
  { phase: 'breathDlg', distance: 1.7, t0: 10.0, t1: 11.3 },
  { phase: 'breathTurn', distance: 1.5, t0: 11.3, t1: 14.733 },
  { phase: 'breathEnd', distance: 0.5, t0: 14.733, t1: 20.0 },
] as const;

export type BreathPhase = (typeof breathSegments)[number]['phase'];

export const config = {
  distances: {
    breathStart: 2.5,
    breathPlanet: 1.1,
    breathClose: 1.0,
    breathToFlight: 1.2,
    breathDlg: 1.7,
    breathTurn: 1.5,
    breathEnd: 0.5,
    toSound: 0.4,
    finale: 3.5,
    ambience: 4.5,
    rotate: 3.2,
    obsolete: 2.2,
  },
  reveal: { from: 0, to: 0.22 },
  /**
   * Caption windows in video seconds (STV-75).
   * Fade spans are absolute seconds for enter/leave ramps.
   */
  captions: {
    rgbTitleIn: 4.867,
    rgbTitleInEnd: 5.5,
    rgbTitleOut: 8.8,
    rgbTitleOutEnd: 9.5,
    rgbBodyIn: 7.2,
    rgbBodyInEnd: 7.7,
    rgbBodyOut: 8.8,
    rgbBodyOutEnd: 9.5,
    dlgIn: 10.0,
    dlgInEnd: 10.28,
    dlgOut: 11.0,
    dlgOutEnd: 11.3,
    dlgIcon: asset('assets/breath/icon-dlg.svg'),
    rgbTitle: asset('assets/breath/rgb-mini-led-title.svg'),
  },
  ambience: { blackEnd: 0.12, videoIn: 0.26, turnOnAt: 0.42 },
  timebase,
  breathScale: { play: 1, close: 1, utp: 1, sound: 1 },
  cropScale: 1,
  playback: {
    crossfadeMs: 280,
    breathCrossfadeMs: 0,
    /** Settle threshold once lerp is close to scroll target (seconds). */
    seekTolerance: 0.02,
    breathRate: 1,
    /**
     * STV-77 scrub follow: exponential lerp of displayed time → scroll target.
     * Higher Hz = snappier; ~14 keeps bidirectional scrub fluid without snap.
     */
    scrubFollowHz: 14,
    /** Snap + hold when |display−target| below this (seconds). */
    scrubSettleSec: 1 / 60,
    /** After scroll target stops changing for this long, force settle (ms). */
    scrubIdleMs: 90,
  },
  heroMedia: {
    src: asset('media/hero-s3.mp4'),
    poster: asset('media/hero-s3-start.jpg'),
    end: asset('media/hero-s3-end.jpg'),
    figma: '126:4173',
    videoFill: '126:4172',
    videoHash: '641fcee477bc7943832719bbb004989e86865076',
    copyFigma: '126:4114',
    copyAtSec: 3,
    durationSec: 6.041667,
    mode: 'PLAY' as const,
  },
  breathMedia: {
    src: asset('media/breath-space.mp4'),
    poster: asset('media/breath-space-start.jpg'),
    end: asset('media/breath-space-end.jpg'),
    figma: '1:151',
    videoFill: '1:152',
    videoHash: '443f466e11a7dc170fc9dd87c6d8dddb57fb9278',
    mode: 'SCRUB' as const,
    lastFrameSec: timebase.lastFrameSec,
  },
  toSoundMedia: {
    src: '',
    poster: asset('media/sound-s6-start.jpg'),
    end: asset('media/sound-s6-start.jpg'),
    figma: 'stv74-fade',
    mode: 'FADE' as const,
  },
  soundMedia: {
    src: asset('media/sound-s6.mp4'),
    poster: asset('media/sound-s6-start.jpg'),
    end: asset('media/sound-s6-end.jpg'),
    figma: '112:2886',
    videoFill: '102:19079',
    mode: 'PLAY' as const,
  },
  ambienceMedia: {
    src: asset('media/ambience-s7.mp4'),
    poster: asset('media/ambience-s7-start.jpg'),
    end: asset('media/ambience-s7-end.jpg'),
    figma: '112:2887',
    videoFill: '100:2499',
    mode: 'PLAY' as const,
  },
  rotateMedia: {
    src: asset('media/rotate.mp4'),
    poster: asset('media/rotate-start.jpg'),
    end: asset('media/rotate-end.jpg'),
    figma: '121:4113',
    videoFill: '121:4112',
    videoHash: 'c5bb42fed47b1daba7058bbeab097c4a75dceb1a',
    mode: 'SCRUB' as const,
    scrubEndSec: 4.0,
  },
  remoteMedia: {
    src: '',
    poster: '',
    end: '',
    figma: '112:2888',
    videoFill: '102:19081',
    mode: 'PLAY' as const,
    missing: true,
  },
  rotate: { titleIn: 0.06, titleEnd: 0.22, bodyIn: 0.14, bodyEnd: 0.34 },
  obsolete: { liftPx: 210, utpIn: 0.12, utpEnd: 0.42 },
} as const;

export type Phase = keyof typeof config.distances;
export const phases = Object.keys(config.distances) as Phase[];
export const totalDistance = Object.values(config.distances).reduce((a, b) => a + b, 0);
export const phaseOffset = (phase: Phase) =>
  phases.slice(0, phases.indexOf(phase)).reduce((a, b) => a + config.distances[b], 0);
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smooth = (p: number) => {
  const n = clamp(p);
  return n * n * (3 - 2 * n);
};

export function resolvePhase(distance: number): { phase: Phase; progress: number } {
  for (const phase of phases) {
    const start = phaseOffset(phase);
    if (distance < start + config.distances[phase]) {
      return { phase, progress: clamp((distance - start) / config.distances[phase]) };
    }
  }
  return { phase: 'obsolete', progress: 1 };
}

export function isBreathPhase(phase: Phase): phase is BreathPhase {
  return breathSegments.some(s => s.phase === phase);
}

/**
 * Map phase + progress → breath-space.mp4 currentTime (seconds).
 * Linear within each segment so segment boundaries don't zero-out velocity
 * (smoothstep per segment felt sticky / snappy across handoffs).
 */
export function breathScrubSec(phase: Phase, progress: number): number | null {
  const seg = breathSegments.find(s => s.phase === phase);
  if (!seg) return null;
  if (seg.t0 === seg.t1) return seg.t0;
  return seg.t0 + (seg.t1 - seg.t0) * clamp(progress);
}

/** Opacity from video-time window [in, inEnd] → hold → [out, outEnd]. */
export function captionOpacityAt(
  t: number,
  inStart: number,
  inEnd: number,
  outStart: number,
  outEnd: number,
): number {
  if (t < inStart || t > outEnd) return 0;
  if (t < inEnd) return smooth((t - inStart) / Math.max(0.001, inEnd - inStart));
  if (t <= outStart) return 1;
  return 1 - smooth((t - outStart) / Math.max(0.001, outEnd - outStart));
}

export function rgbTitleOpacityAt(t: number): number {
  const c = config.captions;
  return captionOpacityAt(t, c.rgbTitleIn, c.rgbTitleInEnd, c.rgbTitleOut, c.rgbTitleOutEnd);
}

export function rgbBodyOpacityAt(t: number): number {
  const c = config.captions;
  return captionOpacityAt(t, c.rgbBodyIn, c.rgbBodyInEnd, c.rgbBodyOut, c.rgbBodyOutEnd);
}

export function dlgOpacityAt(t: number): number {
  const c = config.captions;
  return captionOpacityAt(t, c.dlgIn, c.dlgInEnd, c.dlgOut, c.dlgOutEnd);
}

export function toSoundLayers(progress: number): {
  breath: number;
  black: number;
  poster: number;
} {
  const p = smooth(progress);
  if (p < 0.45) {
    const t = p / 0.45;
    return { breath: 1 - t, black: t, poster: 0 };
  }
  const t = (p - 0.45) / 0.55;
  return { breath: 0, black: 1 - t, poster: t };
}

export function breathMediaScale(_phase: Phase, _progress: number): number {
  return 1;
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
  remote: {
    title: string;
    features: { title: string; body: string }[];
    touchTitle: string;
    touchBody: string;
    findTitle: string;
    findBody: string;
  } | null;
  comparison: null | {
    mini: string;
    rgb: string;
    corners: [[number, number], [number, number], [number, number], [number, number]];
  };
  breathSpace?: {
    rgbTitle: string;
    rgbBody: string;
    dlgTitle: string;
    dlgBody: string;
  } | null;
}
