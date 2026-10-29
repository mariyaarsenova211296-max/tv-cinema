import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  approachScrubSec,
  config,
  clamp,
  outroScrubSec,
  resolveBreathState,
  smooth,
  timebase,
} from './config';
import type { BreathState, Phase } from './config';

type Props = {
  phase: Phase;
  progress: number;
  active: boolean;
  reduced: boolean;
  breathScale: number;
  autoplayDone: boolean;
  onAutoplayDone?: () => void;
};

export function MediaStage({
  phase,
  progress,
  active,
  reduced,
  breathScale,
  autoplayDone,
  onAutoplayDone,
}: Props) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const ambienceRef = useRef<HTMLVideoElement | null>(null);
  const rotateRef = useRef<HTMLVideoElement | null>(null);
  const playPending = useRef(new Set<number | 'ambience' | 'breath'>());
  const finalePlayArmed = useRef(false);
  const ambiencePlayArmed = useRef(false);
  const breathPlayArmed = useRef(false);
  const breathDoneNotified = useRef(false);
  const onDoneRef = useRef(onAutoplayDone);
  onDoneRef.current = onAutoplayDone;

  const [display, setDisplay] = useState(-1);
  const [ambienceReady, setAmbienceReady] = useState(false);
  const [ambienceEnded, setAmbienceEnded] = useState(false);
  const [rotateReady, setRotateReady] = useState(false);
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [ambienceError, setAmbienceError] = useState(false);
  const [rotateError, setRotateError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [video4Ended, setVideo4Ended] = useState(false);
  const [breathEnded, setBreathEnded] = useState(false);
  const [breathPlaying, setBreathPlaying] = useState(false);

  const breathState: BreathState | null = resolveBreathState(
    phase,
    autoplayDone || breathEnded,
  );
  const inApproach = breathState === 'SCROLL_APPROACH';
  const inAutoplay = breathState === 'AUTO_PLAY';
  const inHold = breathState === 'HOLD_RIDER';
  const inOutro = breathState === 'SCROLL_OUTRO';
  const inBreathFlow = breathState !== null;
  const inAmbience = phase === 'ambience';
  const scrubbingRotate = phase === 'rotate';
  const holdingRotateEnd = phase === 'obsolete';
  const inRotateScene = scrubbingRotate || holdingRotateEnd;
  const ambienceBlack = inAmbience && progress < config.ambience.blackEnd;
  const ambiencePlayingPhase = inAmbience && progress >= config.ambience.blackEnd;
  const holdSoundStill = ambienceBlack;

  // One visible source per breath state.
  const index = inRotateScene
    ? 0
    : holdSoundStill ? 3
      : inApproach || inAutoplay || inHold ? 1
        : inOutro ? 2
          : phase === 'finale' ? 3
            : inAmbience ? 0
              : 0;

  const rotateRatio = scrubbingRotate ? smooth(progress) : holdingRotateEnd ? 1 : 0;
  const approachSec = inApproach ? approachScrubSec(progress) : timebase.approachEndSec;
  const outroSec = inOutro ? outroScrubSec(progress) : 0;

  const soundFade =
    phase === 'finale'
      ? (video4Ended && progress > 0.85 ? 1 - smooth((progress - 0.85) / 0.15) : 1)
      : ambienceBlack
        ? 1 - smooth(progress / config.ambience.blackEnd)
        : 0;
  const ambienceFade =
    ambiencePlayingPhase
      ? smooth((progress - config.ambience.blackEnd) / Math.max(0.001, config.ambience.videoIn - config.ambience.blackEnd))
      : 0;

  const playingFinale = Boolean(
    active && visible && phase === 'finale' && !video4Ended && (!reduced || manual),
  );
  const playingAmbience = Boolean(
    active && visible && ambiencePlayingPhase && !ambienceEnded && !ambienceError && (!reduced || manual),
  );
  const playingBreath = Boolean(
    inAutoplay && breathPlaying && !breathEnded && (!reduced || manual),
  );

  const breathCrossfade = inBreathFlow ? config.playback.breathCrossfadeMs : config.playback.crossfadeMs;

  function parkClipEnd(el: HTMLVideoElement) {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    el.pause();
    if (!el.seeking && Math.abs(el.currentTime - last) > config.playback.seekTolerance) {
      el.currentTime = last;
    }
  }

  function seekPaused(el: HTMLVideoElement, sec: number) {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    const target = clamp(sec, 0, last);
    el.pause();
    if (!el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
  }

  function notifyBreathDone() {
    if (breathDoneNotified.current) return;
    breathDoneNotified.current = true;
    setBreathEnded(true);
    setBreathPlaying(false);
    onDoneRef.current?.();
  }

  function ready(i: number) {
    const el = videos.current[i];
    if (!el || el.seeking || el.readyState < 2) return;
    if (i === index) setDisplay(i);
  }

  useEffect(() => {
    if (phase !== 'finale') {
      finalePlayArmed.current = false;
      setVideo4Ended(false);
    }
  }, [phase]);

  useEffect(() => {
    if (!inAmbience && ambienceEnded) {
      ambiencePlayArmed.current = false;
      setAmbienceEnded(false);
    }
  }, [inAmbience, ambienceEnded]);

  const wasAutoplay = useRef(false);
  useEffect(() => {
    if (inAutoplay && !wasAutoplay.current) {
      breathPlayArmed.current = false;
      breathDoneNotified.current = false;
      setBreathEnded(false);
      setBreathPlaying(false);
      setManual(false);
    }
    wasAutoplay.current = inAutoplay;
  }, [inAutoplay]);

  useEffect(() => {
    const el = rotateRef.current;
    if (!el || !inRotateScene) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    el.pause();
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    if (reduced || holdingRotateEnd || rotateRatio >= 0.999) {
      if (!el.seeking && Math.abs(el.currentTime - last) > config.playback.seekTolerance) {
        el.currentTime = last;
      }
      setRotateReady(true);
      return;
    }
    const target = clamp(rotateRatio * el.duration, 0, last);
    if (!el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
    setRotateReady(el.readyState >= 2);
  });

  useEffect(() => {
    const el = ambienceRef.current;
    if (!el) return;

    const keepPlayingToEnd = ambiencePlayArmed.current && !ambienceEnded && !reduced;
    if (!ambiencePlayingPhase && !keepPlayingToEnd) {
      if (!inAmbience) el.pause();
      return;
    }

    if (el.preload !== 'auto') el.preload = 'auto';
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    setAmbienceReady(true);

    if (reduced) {
      el.pause();
      el.currentTime = Math.max(0, el.duration - 1 / 24);
      setAmbienceEnded(true);
      return;
    }

    if (ambiencePlayingPhase && !ambiencePlayArmed.current) {
      el.pause();
      el.currentTime = 0;
      ambiencePlayArmed.current = true;
      setAmbienceEnded(false);
    }

    if (ambienceEnded) {
      el.pause();
      el.currentTime = Math.max(0, el.duration - 1 / 24);
      return;
    }

    if (document.hidden) {
      el.pause();
      return;
    }
    if (!ambiencePlayArmed.current) {
      el.pause();
      return;
    }
    if (!el.paused || playPending.current.has('ambience')) return;
    playPending.current.add('ambience');
    el.play().then(() => setAutoplayBlocked(false)).catch(err => {
      if (err.name !== 'AbortError') setAutoplayBlocked(true);
    }).finally(() => playPending.current.delete('ambience'));
  });

  useEffect(() => {
    if (phase !== 'finale') return;
    const el = videos.current[3];
    if (!el) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;

    if (!finalePlayArmed.current) {
      if (!reduced) {
        try { if (el.currentTime !== 0) el.currentTime = 0; } catch { /* ignore */ }
      } else {
        el.pause();
        el.currentTime = Math.max(0, el.duration - 1 / 24);
        setVideo4Ended(true);
      }
      finalePlayArmed.current = true;
      setDisplay(3);
    }

    if (video4Ended || reduced) {
      el.pause();
      setDisplay(3);
      return;
    }

    if (!active || document.hidden) {
      el.pause();
      return;
    }
    if (!playingFinale) return;
    if (!el.paused || playPending.current.has(3)) return;
    playPending.current.add(3);
    el.play().then(() => setAutoplayBlocked(false)).catch(err => {
      if (err.name !== 'AbortError') setAutoplayBlocked(true);
    }).finally(() => playPending.current.delete(3));
  });

  // Four-state breath control — one source + one driver per state.
  useEffect(() => {
    if (inRotateScene || phase === 'finale' || inAmbience) {
      if (inRotateScene || inAmbience) {
        videos.current.forEach((el, i) => { if (!(holdSoundStill && i === 3)) el?.pause(); });
      }
      return;
    }

    if (!inBreathFlow) {
      videos.current.forEach(el => el?.pause());
      return;
    }

    [1, 2].forEach(i => {
      const el = videos.current[i];
      if (el && el.preload !== 'auto') el.preload = 'auto';
    });

    // SCROLL_APPROACH — scroll-scrub video-2 only (no autoplay, no CSS zoom).
    if (inApproach) {
      const v2 = videos.current[1];
      if (!v2 || errors[1]) return;
      v2.playbackRate = config.playback.breathRate;
      const sec = reduced ? timebase.approachEndSec : approachSec;
      seekPaused(v2, sec);
      setDisplay(1);
      ready(1);
      videos.current[0]?.pause();
      videos.current[2]?.pause();
      return;
    }

    // SCROLL_OUTRO — scrub video-3 0→end (full; no 2.5s cap). Scrub only.
    if (inOutro) {
      videos.current[0]?.pause();
      videos.current[1]?.pause();
      const v3 = videos.current[2];
      if (!v3 || errors[2]) return;
      const last = Number.isFinite(v3.duration) && v3.duration > 0
        ? Math.max(0, v3.duration - 1 / 24)
        : timebase.video3Sec;
      const sec = reduced ? last : clamp(outroSec, 0, last);
      seekPaused(v3, sec);
      setDisplay(2);
      ready(2);
      return;
    }

    // HOLD_RIDER — freeze last shown AUTO_PLAY frame (video-2 end until continuous file).
    if (inHold) {
      videos.current[0]?.pause();
      videos.current[2]?.pause();
      const v2 = videos.current[1];
      if (v2 && !errors[1]) {
        parkClipEnd(v2);
        setDisplay(1);
        ready(1);
      }
      return;
    }

    // AUTO_PLAY — continue same video-2 from approachEnd→end @1× (no source jump / no poster swap).
    const v2 = videos.current[1];
    if (!v2 || errors[1]) return;
    v2.playbackRate = config.playback.breathRate;
    videos.current[0]?.pause();
    videos.current[2]?.pause();

    if (reduced) {
      parkClipEnd(v2);
      setDisplay(1);
      notifyBreathDone();
      return;
    }

    if (!active && !breathPlayArmed.current) {
      seekPaused(v2, timebase.approachEndSec);
      setDisplay(1);
      return;
    }

    if (document.hidden && breathPlayArmed.current && !breathEnded) {
      v2.pause();
      return;
    }

    if (!breathPlayArmed.current) {
      if (!active) return;
      // Resume from approach end on the SAME clip — never seek to 0 / swap source.
      seekPaused(v2, timebase.approachEndSec);
      breathPlayArmed.current = true;
      setDisplay(1);
    }

    if (document.hidden) {
      v2.pause();
      return;
    }

    if (!breathPlayArmed.current || breathEnded) return;
    if (!v2.paused || playPending.current.has('breath')) return;
    if (!Number.isFinite(v2.duration) || v2.duration <= 0) return;

    if (v2.currentTime + 0.05 < timebase.approachEndSec) {
      seekPaused(v2, timebase.approachEndSec);
    }

    playPending.current.add('breath');
    v2.playbackRate = config.playback.breathRate;
    v2.play().then(() => {
      setAutoplayBlocked(false);
      setBreathPlaying(true);
      setDisplay(1);
    }).catch(err => {
      if (err.name !== 'AbortError') setAutoplayBlocked(true);
    }).finally(() => playPending.current.delete('breath'));
  });

  useEffect(() => {
    if (!holdSoundStill) return;
    const el = videos.current[3];
    if (!el || !Number.isFinite(el.duration)) return;
    el.pause();
    el.currentTime = Math.max(0, el.duration - 1 / 24);
    setDisplay(3);
  });

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        videos.current.forEach(el => el?.pause());
        rotateRef.current?.pause();
        ambienceRef.current?.pause();
      }
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      videos.current.forEach(el => el?.pause());
      rotateRef.current?.pause();
      ambienceRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    setManual(false);
  }, [index, active, inAmbience, inRotateScene, phase]);

  const still = reduced && !manual;
  const showVideoPlane = !still && display >= 0 && !errors[display];
  // Stable fallback per state — no mid-AUTO_PLAY poster swap.
  const fallback = inApproach || inAutoplay || inHold
    ? (inApproach && approachSec / Math.max(0.001, timebase.approachEndSec) < 0.85
      ? config.media[1].poster
      : config.media[1].end)
    : inOutro
      ? (outroSec >= timebase.video3Sec - 0.08 ? config.media[2].end : config.media[2].poster)
      : inRotateScene
        ? (reduced || rotateRatio > 0.95 || holdingRotateEnd ? config.rotateMedia.end : config.rotateMedia.poster)
        : inAmbience
          ? (ambienceEnded || reduced ? config.ambienceMedia.end : config.ambienceMedia.poster)
          : config.media[holdSoundStill || phase === 'finale' ? 3 : index][
            holdSoundStill || (phase === 'finale' && video4Ended) ? 'end' : 'poster'
          ];
  const showRotate = inRotateScene && !rotateError && !(reduced && still);
  const showAmbience = ambiencePlayingPhase && ambienceFade > 0.01 && !ambienceError && !(reduced && still);
  const showSound = (phase === 'finale' || holdSoundStill) && soundFade > 0.01 && !inBreathFlow && !inRotateScene;
  const showBreathOrUtp = inBreathFlow && !inAmbience && !inRotateScene;

  const needsManual =
    active
    && (
      (inAutoplay && !breathEnded && !playingBreath)
      || (phase === 'finale' && !playingFinale)
      || (ambiencePlayingPhase && !playingAmbience)
    )
    && (reduced || autoplayBlocked);

  return <div
    className={`media-stage${inRotateScene ? ' media-stage--rotate' : ''}${inBreathFlow ? ' media-stage--breath' : ''}`}
    style={{
      '--media-crossfade': `${breathCrossfade}ms`,
      '--breath-scale': String(breathScale),
      '--crop-scale': String(inRotateScene || inBreathFlow ? 1 : config.cropScale),
    } as CSSProperties}
    data-media-index={inRotateScene ? 'rotate' : inAmbience ? 'ambience' : (phase === 'finale' || holdSoundStill ? 4 : index + 1)}
    data-breath-state={inBreathFlow ? breathState : undefined}
    data-mode={
      inApproach ? 'scroll-approach'
        : inAutoplay && !breathEnded ? (playingBreath ? 'play-breath' : 'still-breath')
          : inHold ? 'hold-rider'
            : inOutro ? 'scroll-outro'
              : inRotateScene ? (scrubbingRotate ? 'scroll-rotate' : 'still-rotate')
                : ambiencePlayingPhase ? (playingAmbience ? 'play-ambience' : 'still-ambience')
                  : phase === 'finale' ? (playingFinale ? 'play' : 'still')
                    : 'still'
    }
    data-testid="tv-drive"
    data-breath-ended={inHold || (inOutro) ? '1' : '0'}
    data-breath-scale={breathScale.toFixed(3)}
    data-approach-sec={inApproach ? approachSec.toFixed(3) : undefined}
    data-outro-sec={inOutro ? outroSec.toFixed(3) : undefined}
    data-rotate-ratio={inRotateScene ? rotateRatio.toFixed(3) : undefined}
    data-rotate-ready={inRotateScene ? (rotateReady ? '1' : '0') : undefined}
  >
    <img
      className="media-fallback"
      src={fallback}
      alt="Телевизор Sber TV"
      style={{ opacity: showVideoPlane || showRotate || showAmbience || showSound ? 0 : 1 }}
      aria-hidden="true"
    />
    <video
      ref={ambienceRef}
      data-testid="video-ambience"
      src={config.ambienceMedia.src}
      poster={config.ambienceMedia.poster}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      style={{ opacity: ambienceFade }}
      className={showAmbience && ambienceReady && !still ? 'visible' : ''}
      onLoadedData={() => setAmbienceReady(true)}
      onCanPlay={() => setAmbienceReady(true)}
      onEnded={() => {
        const el = ambienceRef.current;
        if (el && Number.isFinite(el.duration)) el.currentTime = Math.max(0, el.duration - 1 / 24);
        el?.pause();
        setAmbienceEnded(true);
        setAmbienceReady(true);
      }}
      onError={() => setAmbienceError(true)}
    />
    <video
      ref={rotateRef}
      data-testid="video-rotate"
      src={config.rotateMedia.src}
      poster={config.rotateMedia.poster}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      className={showRotate && !still ? 'visible' : ''}
      onLoadedData={() => setRotateReady(true)}
      onCanPlay={() => setRotateReady(true)}
      onSeeked={() => setRotateReady(true)}
      onError={() => setRotateError(true)}
    />
    {config.media.map((media, i) => <video key={media.src} ref={el => { videos.current[i] = el; }}
      data-testid={`video-${i + 1}`} src={media.src} poster={media.poster} muted playsInline
      preload={i === 1 || i === 2 || i === 3 ? 'auto' : 'metadata'}
      loop={false}
      aria-hidden="true"
      style={i === 3 && showSound ? { opacity: soundFade } : undefined}
      className={
        ((showBreathOrUtp && display === i) || (showSound && i === 3 && display === 3))
        && !still && !errors[i] ? 'visible' : ''
      }
      onLoadedData={() => ready(i)} onCanPlay={() => ready(i)}
      onLoadedMetadata={() => setErrors(old => ({ ...old }))}
      onSeeked={() => { ready(i); setErrors(old => ({ ...old })); }}
      onEnded={() => {
        // AUTO_PLAY ends on same video-2 source — freeze shown frame; no fake jump to video-3.
        if (i === 1 && breathPlayArmed.current && !breathDoneNotified.current) {
          const v2 = videos.current[1];
          if (v2) parkClipEnd(v2);
          setDisplay(1);
          notifyBreathDone();
          return;
        }
        if (i === 3) {
          videos.current[3]?.pause();
          setVideo4Ended(true);
          setDisplay(3);
        }
      }}
      onError={() => setErrors(old => ({ ...old, [i]: true }))} />)}
    {(still || (inRotateScene ? rotateError : inAmbience ? ambienceError : errors[phase === 'finale' || holdSoundStill ? 3 : index])) && (
      <img className="media-still" src={fallback} alt="Телевизор Sber TV" />
    )}
    {!inAmbience && !inRotateScene && phase !== 'finale' && errors[index] && <div role="alert" className="media-message">Не удалось загрузить видео. Показан статичный кадр.<button onClick={() => { setErrors(old => ({ ...old, [index]: false })); videos.current[index]?.load(); }}>Повторить</button></div>}
    {needsManual && (
      <button className="manual-play" aria-pressed={manual}
        onClick={() => {
          if (inAutoplay && !breathEnded) {
            const el = videos.current[1];
            setManual(true);
            breathPlayArmed.current = true;
            if (el) {
              el.playbackRate = config.playback.breathRate;
              el.currentTime = timebase.approachEndSec;
              el.play().then(() => { setAutoplayBlocked(false); setBreathPlaying(true); setDisplay(1); }).catch(() => setAutoplayBlocked(true));
            }
            return;
          }
          if (phase === 'finale') {
            const el = videos.current[3];
            setManual(true);
            setVideo4Ended(false);
            finalePlayArmed.current = true;
            if (el) { el.currentTime = 0; el.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true)); }
            return;
          }
          if (ambiencePlayingPhase) {
            const el = ambienceRef.current;
            setManual(true);
            setAmbienceEnded(false);
            ambiencePlayArmed.current = true;
            if (el) { el.currentTime = 0; el.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true)); }
          }
        }}>{manual ? 'Пауза' : 'Воспроизвести видео'}<span aria-hidden="true">{manual ? 'Ⅱ' : '▷'}</span></button>
    )}
  </div>;
}
