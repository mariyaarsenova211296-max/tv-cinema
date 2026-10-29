import { asset } from './base';

/**
 * STV-58/59 / TZ breath scheme (single continuous clip from Figma 112:2884):
 *   SCROLL_APPROACH  — scroll SCRUB  0 → 1.0s
 *   AUTO_PLAY        — time PLAY     1.0 → 7.0s @1× (scroll clamped at gate)
 *   HOLD_RIDER       — freeze        @7.0s
 *   SCROLL_OUTRO     — scroll SCRUB  7 → end  (video-driven retreat; UTPs hold end)
 *   then SCRUB 5→6 transition (112:2885) once → sound PLAY → ambience PLAY
 *
 * One <video> / one timeline for breath-s3to5 across screens 3→4 / 4 / 4→5 / 5.
 * Scale rail stays 1 — retreat is video-driven, not CSS.
 * STV-61: toSound scrubs only 0→scrubEndSec (handoff into sound), so the
 * cat→violin transition does not continue past the sound start and re-play.
 */
export const timebase = {
  fps: 24,
  approachEndSec: 1.0,
  holdSec: 7.0,
  /** Full-length Figma export of 112:2884 / VIDEO 72:1038. */
  breathSec: 10.033,
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
    toSound: 2.2, // screen 5→6 SCRUB (112:2885)
    finale: 3.5, // sound PLAY (112:2886)
    ambience: 4.5, // ambience PLAY (112:2887)
    rotate: 3.2, // never-obsolete scrub (no new Figma map in STV-58)
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
  /** Screen 3 — Figma 112:2889 / VIDEO 102:19080 (PLAY). */
  heroMedia: {
    src: asset('media/hero-s3.mp4'),
    poster: asset('media/hero-s3-start.jpg'),
    end: asset('media/hero-s3-end.jpg'),
    figma: '112:2889',
    videoFill: '102:19080',
    mode: 'PLAY' as const,
  },
  /**
   * Breath master — screens 3→4 / 4 / 4→5 / 5.
   * SCRUB 0→1 / PLAY 1→7 / SCRUB 7→end. Figma 112:2884 / VIDEO 72:1038.
   */
  breathMedia: {
    src: asset('media/breath-s3to5.mp4'),
    poster: asset('media/breath-s3to5-start.jpg'),
    end: asset('media/breath-s3to5-end.jpg'),
    figma: '112:2884',
    videoFill: '72:1038',
    mode: 'SCRUB+PLAY' as const,
  },
  /**
   * Screen 5→6 transition — Figma 112:2885 / VIDEO 72:1039 (SCRUB).
   * Full export is ~6.03s but content after ~4.0s leaves the sound handoff
   * (violin) and re-enters earlier horse frames — that looked like a second
   * transition before sound PLAY. Scrub only 0→scrubEndSec.
   */
  toSoundMedia: {
    src: asset('media/transition-s5to6.mp4'),
    poster: asset('media/transition-s5to6-start.jpg'),
    end: asset('media/transition-s5to6-end.jpg'),
    figma: '112:2885',
    videoFill: '72:1039',
    mode: 'SCRUB' as const,
    /** Seconds — last frame that matches sound-s6 start (violin handoff). */
    scrubEndSec: 4.0,
  },
  /** Screen 6 sound — Figma 112:2886 / VIDEO 102:19079 (PLAY). */
  soundMedia: {
    src: asset('media/sound-s6.mp4'),
    poster: asset('media/sound-s6-start.jpg'),
    end: asset('media/sound-s6-end.jpg'),
    figma: '112:2886',
    videoFill: '102:19079',
    mode: 'PLAY' as const,
  },
  /** Screen 7 ambience — Figma 112:2887 / VIDEO 100:2499 (PLAY). */
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
    note: 'Kept — no STV-58 Figma remapping for never-obsolete scrub',
  },
  /** Screen 9 remote — removed in STV-59 (last blocks cut from /alt/). */
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

export const autoplayLockStart = phaseOffset('autoplay');

export function resolveBreathState(phase: Phase, autoplayDone: boolean): BreathState | null {
  if (phase === 'approach') return 'SCROLL_APPROACH';
  if (phase === 'autoplay') return 'AUTO_PLAY';
  // Keep AUTO_PLAY only while the breath runway is waiting on the 1→7 playhead.
  // Do not force AUTO_PLAY onto post-breath phases (toSound/finale/…) — that
  // competed with their own SCRUB/PLAY controllers and caused freezes/repeats.
  if (!autoplayDone) {
    if (
      phase === 'waitClose'
      || phase === 'retreat'
      || phase === 'comparison'
      || phase === 'utpDlg'
    ) {
      return 'AUTO_PLAY';
    }
    return null;
  }
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
  // Epsilon so sub-pixel scroll at the gate still enters AUTO_PLAY.
  if (distance < autoplayLockStart - 0.0005) return resolvePhase(distance);
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
