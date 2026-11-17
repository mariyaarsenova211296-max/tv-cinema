import { asset } from './base';

/**
 * STV-74 · breath-space scroll-scrub (TZ scroll-breath-space).
 * Pure scroll → currentTime on breath-space.mp4. No autoplayLock / AUTO_PLAY.
 * Hold inserts at 6.033s (compare) and 7.400s (macro). toSound fades last
 * frame → black → sound-s6-start.jpg, then finale plays sound-s6.mp4.
 */
export const timebase = {
  fps: 30,
  /** Last available frame start (TZ). */
  lastFrameSec: 20.0,
  /** Source duration ≈ 20.033–20.067s. */
  breathSec: 20.033,
  compareHoldSec: 6.033,
  macroHoldSec: 7.4,
  dlgStartSec: 10.0,
  dlgEndSec: 11.3,
} as const;

/** Scroll-mapped breath segments (distance in sticky heights H). */
export const breathSegments = [
  { phase: 'breathStart', distance: 1.5, t0: 0, t1: 4.867, hold: false },
  { phase: 'breathPlanet', distance: 0.65, t0: 4.867, t1: 6.033, hold: false },
  { phase: 'breathCompare', distance: 1.25, t0: 6.033, t1: 6.033, hold: true },
  { phase: 'breathToMacro', distance: 0.6, t0: 6.033, t1: 7.4, hold: false },
  { phase: 'breathMacro', distance: 1.0, t0: 7.4, t1: 7.4, hold: true },
  { phase: 'breathToFlight', distance: 0.7, t0: 7.4, t1: 10.0, hold: false },
  { phase: 'breathDlg', distance: 1.0, t0: 10.0, t1: 11.3, hold: false },
  { phase: 'breathTurn', distance: 0.85, t0: 11.3, t1: 14.733, hold: false },
  { phase: 'breathEnd', distance: 0.25, t0: 14.733, t1: 20.0, hold: false },
] as const;

export type BreathPhase = (typeof breathSegments)[number]['phase'];

export const config = {
  distances: {
    breathStart: 1.5,
    breathPlanet: 0.65,
    breathCompare: 1.25,
    breathToMacro: 0.6,
    breathMacro: 1.0,
    breathToFlight: 0.7,
    breathDlg: 1.0,
    breathTurn: 0.85,
    breathEnd: 0.25,
    /** Fade last breath frame → black → sound poster. */
    toSound: 0.4,
    finale: 3.5,
    ambience: 4.5,
    rotate: 3.2,
    obsolete: 2.2,
  },
  reveal: { from: 0, to: 0.22 },
  /** Caption enter/leave within a phase (fraction of phase progress). */
  text: { enterEnd: 0.18, leaveEnd: 0.18 },
  /**
   * Caption timing bounds (phase progress) — reported in STV-74.
   * rgbTitle: fade in late on breathPlanet → hold through compare/toMacro/macro → out early on toFlight
   * compareLabels: full breathCompare with enter/leave
   * macroBody: full breathMacro
   * dlg: full breathDlg
   */
  captions: {
    rgbTitleInPhase: 'breathPlanet' as BreathPhase,
    rgbTitleInFrom: 0.45,
    rgbTitleHoldThrough: ['breathCompare', 'breathToMacro', 'breathMacro'] as BreathPhase[],
    rgbTitleOutPhase: 'breathToFlight' as BreathPhase,
    rgbTitleOutBy: 0.35,
    compareLiftPx: 195,
    dlgIcon: asset('assets/breath/icon-dlg.svg'),
    rgbTitle: asset('assets/breath/rgb-mini-led-title.svg'),
    compareMini: asset('assets/breath/compare-mini.jpg'),
    compareRgb: asset('assets/breath/compare-rgb.jpg'),
    macroImage: asset('assets/breath/macro.jpg'),
  },
  ambience: { blackEnd: 0.12, videoIn: 0.26, turnOnAt: 0.42 },
  timebase,
  breathScale: { play: 1, close: 1, utp: 1, sound: 1 },
  cropScale: 1,
  playback: {
    crossfadeMs: 280,
    breathCrossfadeMs: 0,
    seekTolerance: 0.04,
    breathRate: 1,
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
    figma: '2654:1959',
    videoFill: '2654:1960',
    videoHash: '443f466e11a7dc170fc9dd87c6d8dddb57fb9278',
    mode: 'SCRUB' as const,
    lastFrameSec: timebase.lastFrameSec,
  },
  /**
   * toSound is no longer transition-s5to6.mp4 (cat flash).
   * Scroll fades breath end → black → sound poster; finale takes over.
   */
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

/** Map phase + progress → breath-space.mp4 currentTime (seconds). */
export function breathScrubSec(phase: Phase, progress: number): number | null {
  const seg = breathSegments.find(s => s.phase === phase);
  if (!seg) return null;
  if (seg.hold || seg.t0 === seg.t1) return seg.t0;
  return seg.t0 + (seg.t1 - seg.t0) * smooth(progress);
}

/** RGB MINI LED title opacity from phase progress (bidirectional). */
export function rgbTitleOpacity(phase: Phase, progress: number): number {
  if (phase === 'breathPlanet') {
    const from = config.captions.rgbTitleInFrom;
    if (progress < from) return 0;
    return smooth((progress - from) / Math.max(0.001, 1 - from));
  }
  if ((config.captions.rgbTitleHoldThrough as readonly string[]).includes(phase)) return 1;
  if (phase === 'breathToFlight') {
    const by = config.captions.rgbTitleOutBy;
    if (progress >= by) return 0;
    return 1 - smooth(progress / Math.max(0.001, by));
  }
  return 0;
}

/** Compare half-labels + divider opacity. */
export function compareOverlayOpacity(phase: Phase, progress: number): number {
  if (phase !== 'breathCompare') return 0;
  const { enterEnd, leaveEnd } = config.text;
  if (progress < enterEnd) return smooth(progress / enterEnd);
  if (progress > 1 - leaveEnd) return 1 - smooth((progress - (1 - leaveEnd)) / leaveEnd);
  return 1;
}

/** Macro description opacity. */
export function macroBodyOpacity(phase: Phase, progress: number): number {
  if (phase !== 'breathMacro') return 0;
  const { enterEnd, leaveEnd } = config.text;
  if (progress < enterEnd) return smooth(progress / enterEnd);
  if (progress > 1 - leaveEnd) return 1 - smooth((progress - (1 - leaveEnd)) / leaveEnd);
  return 1;
}

/** Macro still opacity (full hold; slight fade at edges). */
export function macroStillOpacity(phase: Phase, progress: number): number {
  if (phase !== 'breathMacro') return 0;
  if (progress < 0.08) return smooth(progress / 0.08);
  if (progress > 0.92) return 1 - smooth((progress - 0.92) / 0.08);
  return 1;
}

/** Compare still split opacity. */
export function compareStillOpacity(phase: Phase, progress: number): number {
  return compareOverlayOpacity(phase, progress);
}

/** Compare composition lift (reveal labels in 1388→860 window). */
export function compareLiftPx(phase: Phase, progress: number): number {
  if (phase !== 'breathCompare') return 0;
  return smooth(progress) * config.captions.compareLiftPx;
}

/** DLG caption opacity during flight scrub. */
export function dlgOpacity(phase: Phase, progress: number): number {
  if (phase !== 'breathDlg') return 0;
  const { enterEnd, leaveEnd } = config.text;
  if (progress < enterEnd) return smooth(progress / enterEnd);
  if (progress > 1 - leaveEnd) return 1 - smooth((progress - (1 - leaveEnd)) / leaveEnd);
  return 1;
}

/**
 * toSound progress → layer opacities.
 * 0–0.45: breath end fades to black
 * 0.45–1: sound poster fades in
 */
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

/** Scale rail — always 1 for video-driven breath. */
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
    miniLabel: string;
    rgbLabel: string;
    macroBody: string;
    dlgTitle: string;
    dlgBody: string;
  } | null;
}
