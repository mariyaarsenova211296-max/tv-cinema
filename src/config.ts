import { asset } from './base';

/**
 * STV-53 / TZ breath scheme (single continuous clip):
 *   SCROLL_APPROACH  — scroll SCRUB  0 → 1.0s
 *   AUTO_PLAY        — time PLAY     1.0 → 7.0s @1×
 *   HOLD_RIDER       — freeze        @7.0s
 *   SCROLL_OUTRO     — scroll SCRUB  7 → end  (video-driven retreat)
 *   then 2 UTPs (RGB → DLG) on the hold/outro still
 *
 * Scale rail stays 1 — retreat is video-driven, not CSS.
 */
export const timebase = {
  fps: 24,
  approachEndSec: 1.0,
  holdSec: 7.0,
  /** Known duration of interim breath-story (video-1 stand-in). */
  breathSec: 7.75,
} as const;

export type BreathState =
  | 'SCROLL_APPROACH'
  | 'AUTO_PLAY'
  | 'HOLD_RIDER'
  | 'SCROLL_OUTRO';

export const config = {
  distances: {
    approach: 1.8,
    autoplay: 0.2,
    waitClose: 0.35,
    retreat: 2.0, // maps to SCROLL_OUTRO video scrub
    comparison: 1.6, // RGB UTP
    utpDlg: 1.6, // DLG UTP
    finale: 3.5, // v4 sound PLAY
    ambience: 4.5, // v5 ambience PLAY
    rotate: 3.2, // never-obsolete scrub
    obsolete: 2.2,
  },
  reveal: { from: 0, to: 0.28 },
  text: { enterEnd: 0.22, leaveEnd: 0.22 },
  ambience: { blackEnd: 0.12, videoIn: 0.26, turnOnAt: 0.42 },
  timebase,
  breathScale: { play: 1, close: 1, utp: 1, sound: 1 },
  cropScale: 1,
  playback: {
    crossfadeMs: 280,
    breathCrossfadeMs: 0,
    seekTolerance: 0.035,
    breathRate: 1,
  },
  /** Figma 102:19080 — hero (SCRUB/PLAY). */
  heroMedia: {
    src: asset('media/v1-hero.mp4'),
    poster: asset('media/v1-hero-start.jpg'),
    end: asset('media/v1-hero-end.jpg'),
    figma: '102:19080',
    mode: 'PLAY' as const,
  },
  /**
   * Breath master — TZ 0–1 SCRUB / 1–7 PLAY / post-7 SCRUB.
   * Interim: copy of video-1 (7.75s). True continuous export for 72:1038
   * spanning to rider@7 still missing (MCP returns PNG only for VIDEO fills).
   */
  breathMedia: {
    src: asset('media/breath-story.mp4'),
    poster: asset('media/breath-story-start.jpg'),
    end: asset('media/breath-story-end.jpg'),
    figmaApproach: '72:1038',
    mode: 'SCRUB+PLAY' as const,
  },
  /** Figma 72:1039 — to-sound / outro source retained for reference. */
  toSoundMedia: {
    src: asset('media/v3-to-sound.mp4'),
    poster: asset('media/v3-to-sound-start.jpg'),
    end: asset('media/v3-to-sound-end.jpg'),
    figma: '72:1039',
    mode: 'SCRUB' as const,
  },
  /** Figma 102:19079 — spatial sound (PLAY). */
  soundMedia: {
    src: asset('media/v4-sound.mp4'),
    poster: asset('media/v4-sound-start.jpg'),
    end: asset('media/v4-sound-end.jpg'),
    figma: '102:19079',
    mode: 'PLAY' as const,
  },
  /** Figma 100:2499 — ambience (PLAY). */
  ambienceMedia: {
    src: asset('media/v5-ambience.mp4'),
    poster: asset('media/v5-ambience-start.jpg'),
    end: asset('media/v5-ambience-end.jpg'),
    figma: '100:2499',
    mode: 'PLAY' as const,
  },
  rotateMedia: {
    src: asset('media/rotate.mp4'),
    poster: asset('media/rotate-start.jpg'),
    end: asset('media/rotate-end.jpg'),
  },
  /** Figma 102:19081 — remote VIDEO fill; no MP4 available via MCP. */
  remoteMedia: {
    src: null as string | null,
    figma: '102:19081',
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

export const autoplayLockStart = phaseOffset('autoplay');

export function resolveBreathState(phase: Phase, autoplayDone: boolean): BreathState | null {
  if (phase === 'approach') return 'SCROLL_APPROACH';
  if (phase === 'autoplay' || !autoplayDone) return 'AUTO_PLAY';
  // waitClose = freeze @7 before retreat; retreat + UTPs = video-driven outro
  // (UTPs hold the post-retreat end frame — do not jump back to t=7).
  if (phase === 'waitClose') return 'HOLD_RIDER';
  if (phase === 'retreat' || phase === 'comparison' || phase === 'utpDlg') {
    return 'SCROLL_OUTRO';
  }
  return null;
}

export function resolveBreathStory(
  distance: number,
  autoplayDone: boolean,
  unlockDistance: number,
): { phase: Phase; progress: number } {
  if (distance < autoplayLockStart) return resolvePhase(distance);
  if (!autoplayDone) return { phase: 'autoplay', progress: 0 };
  const post = Math.max(0, distance - unlockDistance);
  const waitStart = phaseOffset('waitClose');
  return resolvePhase(waitStart + post);
}

export function resolvePhase(distance: number): { phase: Phase; progress: number } {
  for (const phase of phases) {
    const start = phaseOffset(phase);
    if (distance < start + config.distances[phase]) {
      return { phase, progress: clamp((distance - start) / config.distances[phase]) };
    }
  }
  return { phase: 'obsolete', progress: 1 };
}

/** Scale rail — always 1 for single-clip video-driven retreat. */
export function breathMediaScale(_phase: Phase, _progress: number): number {
  return 1;
}

export function approachScrubSec(progress: number): number {
  return timebase.approachEndSec * smooth(progress);
}

/** SCROLL_OUTRO: 7 + (duration − 7) × progress */
export function outroScrubSec(progress: number, duration: number = timebase.breathSec): number {
  const hold = timebase.holdSec;
  const last = Math.max(hold, duration - 1 / 24);
  return hold + (last - hold) * smooth(progress);
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
}
