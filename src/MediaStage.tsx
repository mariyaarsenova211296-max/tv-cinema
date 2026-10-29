import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  approachScrubSec,
  config,
  clamp,
  outroBlockProgress,
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
  const breathRef = useRef<HTMLVideoElement | null>(null);
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
  const [breathError, setBreathError] = useState(false);
  const [breathReady, setBreathReady] = useState(false);
  const [ambienceError, setAmbienceError] = useState(false);
  const [rotateError, setRotateError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [video4Ended, setVideo4Ended] = useState(false);
  const [breathEnded, setBreathEnded] = useState(false);
  const [breathPlaying, setBreathPlaying] = useState(false);
  const [breathDuration, setBreathDuration] = useState<number>(timebase.video1Sec);

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

  // Non-breath planes: finale/ambience black use video-4; rotate/ambience separate.
  const index = inRotateScene
    ? 0
    : holdSoundStill || phase === 'finale'
      ? 3
      : 0;

  const rotateRatio = scrubbingRotate ? smooth(progress) : holdingRotateEnd ? 1 : 0;
  const approachSec = inApproach ? approachScrubSec(progress) : timebase.approachEndSec;
  const outroProg = inOutro ? outroBlockProgress(phase, progress) : 0;
  const outroSec = inOutro
    ? outroScrubSec(outroProg, breathDuration)
    : timebase.holdSec;

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

  function seekPaused(el: HTMLVideoElement, sec: number) {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    const target = clamp(sec, 0, last);
    el.pause();
    if (!el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
  }

  function parkHold(el: HTMLVideoElement) {
    seekPaused(el, timebase.holdSec);
  }

  function notifyBreathDone() {
    if (breathDoneNotified.current) return;
    breathDoneNotified.current = true;
    setBreathEnded(true);
    setBreathPlaying(false);
    onDoneRef.current?.();
  }

  function finishAutoplayAtHold() {
    if (breathDoneNotified.current) return;
    const el = breathRef.current;
    if (el) parkHold(el);
    notifyBreathDone();
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

  // STV-51 — ONE continuous breath source; no video-1↔video-3 swap.
  useEffect(() => {
    if (inRotateScene || phase === 'finale' || inAmbience) {
      breathRef.current?.pause();
      if (inRotateScene || inAmbience) {
        videos.current.forEach((el, i) => { if (!(holdSoundStill && i === 3)) el?.pause(); });
      }
      return;
    }

    if (!inBreathFlow) {
      breathRef.current?.pause();
      videos.current.forEach(el => el?.pause());
      return;
    }

    const el = breathRef.current;
    if (!el || breathError) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    el.playbackRate = config.playback.breathRate;
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setBreathDuration(el.duration);
      setBreathReady(el.readyState >= 2);
    }

    // SCROLL_APPROACH — scrub 0→1.0s only (paused; no scroll-driven play).
    if (inApproach) {
      const sec = reduced ? timebase.approachEndSec : approachSec;
      seekPaused(el, sec);
      setDisplay(-1);
      return;
    }

    // HOLD_RIDER — freeze @7.0; no currentTime from further scroll here.
    if (inHold) {
      parkHold(el);
      setDisplay(-1);
      return;
    }

    // SCROLL_OUTRO — pause + scrub 7+(duration-7)*progress (video-driven retreat).
    if (inOutro) {
      seekPaused(el, reduced ? Math.max(timebase.holdSec, el.duration - 1 / 24) : outroSec);
      setDisplay(-1);
      return;
    }

    // AUTO_PLAY — play 1.0→7.0 @1×; no scroll currentTime; no source swap.
    if (reduced) {
      parkHold(el);
      notifyBreathDone();
      return;
    }

    if (!active && !breathPlayArmed.current) {
      seekPaused(el, timebase.autoplayStartSec);
      return;
    }

    if (document.hidden && breathPlayArmed.current && !breathEnded) {
      el.pause();
      return;
    }

    if (!breathPlayArmed.current) {
      if (!active) return;
      seekPaused(el, timebase.autoplayStartSec);
      breathPlayArmed.current = true;
    }

    if (document.hidden) {
      el.pause();
      return;
    }

    if (!breathPlayArmed.current || breathEnded) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;

    if (el.currentTime + 0.04 >= timebase.holdSec) {
      finishAutoplayAtHold();
      return;
    }

    if (!el.paused || playPending.current.has('breath')) return;

    if (el.currentTime + 0.05 < timebase.autoplayStartSec) {
      seekPaused(el, timebase.autoplayStartSec);
    }

    playPending.current.add('breath');
    el.playbackRate = config.playback.breathRate;
    el.play().then(() => {
      setAutoplayBlocked(false);
      setBreathPlaying(true);
    }).catch(err => {
      if (err.name !== 'AbortError') setAutoplayBlocked(true);
    }).finally(() => playPending.current.delete('breath'));
  });

  // Poll hold threshold while AUTO_PLAY runs.
  useEffect(() => {
    if (!inAutoplay || breathEnded || reduced) return;
    const el = breathRef.current;
    if (!el) return;
    const onTime = () => {
      if (breathDoneNotified.current) return;
      if (el.currentTime + 0.04 >= timebase.holdSec) finishAutoplayAtHold();
    };
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, [inAutoplay, breathEnded, reduced]);

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
        breathRef.current?.pause();
        rotateRef.current?.pause();
        ambienceRef.current?.pause();
      }
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      videos.current.forEach(el => el?.pause());
      breathRef.current?.pause();
      rotateRef.current?.pause();
      ambienceRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    setManual(false);
  }, [index, active, inAmbience, inRotateScene, phase, breathState]);

  const still = reduced && !manual;
  const showBreath = inBreathFlow && !breathError && breathReady && !still;
  const showVideoPlane = !still && display >= 0 && !errors[display] && !inBreathFlow;
  const fallback = inBreathFlow
    ? (inApproach && approachSec / Math.max(0.001, timebase.approachEndSec) < 0.85
      ? config.breathMedia.poster
      : inOutro
        ? config.breathMedia.end
        : config.breathMedia.poster)
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
    data-media-index={inRotateScene ? 'rotate' : inAmbience ? 'ambience' : inBreathFlow ? 'breath' : (phase === 'finale' || holdSoundStill ? 4 : index + 1)}
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
    data-breath-ended={inHold || inOutro ? '1' : '0'}
    data-breath-scale={breathScale.toFixed(3)}
    data-approach-sec={inApproach ? approachSec.toFixed(3) : undefined}
    data-hold-sec={inHold ? timebase.holdSec.toFixed(3) : undefined}
    data-outro-sec={inOutro ? outroSec.toFixed(3) : undefined}
    data-outro-progress={inOutro ? outroProg.toFixed(3) : undefined}
    data-rotate-ratio={inRotateScene ? rotateRatio.toFixed(3) : undefined}
    data-rotate-ready={inRotateScene ? (rotateReady ? '1' : '0') : undefined}
  >
    <img
      className="media-fallback"
      src={fallback}
      alt="Телевизор Sber TV"
      style={{ opacity: showBreath || showVideoPlane || showRotate || showAmbience || showSound ? 0 : 1 }}
      aria-hidden="true"
    />
    <video
      ref={breathRef}
      data-testid="video-breath"
      src={config.breathMedia.src}
      poster={config.breathMedia.poster}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      className={showBreath ? 'visible' : ''}
      onLoadedData={() => {
        const el = breathRef.current;
        if (el && Number.isFinite(el.duration)) setBreathDuration(el.duration);
        setBreathReady(true);
      }}
      onCanPlay={() => setBreathReady(true)}
      onLoadedMetadata={() => {
        const el = breathRef.current;
        if (el && Number.isFinite(el.duration)) setBreathDuration(el.duration);
      }}
      onSeeked={() => setBreathReady(true)}
      onEnded={() => {
        if (breathPlayArmed.current && !breathDoneNotified.current) finishAutoplayAtHold();
      }}
      onError={() => setBreathError(true)}
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
      preload={i === 3 ? 'auto' : 'metadata'}
      loop={false}
      aria-hidden="true"
      style={i === 3 && showSound ? { opacity: soundFade } : undefined}
      className={
        (showSound && i === 3 && display === 3) && !still && !errors[i] ? 'visible' : ''
      }
      onLoadedData={() => ready(i)} onCanPlay={() => ready(i)}
      onLoadedMetadata={() => setErrors(old => ({ ...old }))}
      onSeeked={() => { ready(i); setErrors(old => ({ ...old })); }}
      onEnded={() => {
        if (i === 3) {
          videos.current[3]?.pause();
          setVideo4Ended(true);
          setDisplay(3);
        }
      }}
      onError={() => setErrors(old => ({ ...old, [i]: true }))} />)}
    {(still || (inBreathFlow ? breathError : inRotateScene ? rotateError : inAmbience ? ambienceError : errors[phase === 'finale' || holdSoundStill ? 3 : index])) && (
      <img className="media-still" src={fallback} alt="Телевизор Sber TV" />
    )}
    {!inAmbience && !inRotateScene && !inBreathFlow && phase !== 'finale' && errors[index] && <div role="alert" className="media-message">Не удалось загрузить видео. Показан статичный кадр.<button onClick={() => { setErrors(old => ({ ...old, [index]: false })); videos.current[index]?.load(); }}>Повторить</button></div>}
    {inBreathFlow && breathError && <div role="alert" className="media-message">Не удалось загрузить breath-story. Показан статичный кадр.<button onClick={() => { setBreathError(false); breathRef.current?.load(); }}>Повторить</button></div>}
    {needsManual && (
      <button className="manual-play" aria-pressed={manual}
        onClick={() => {
          if (inAutoplay && !breathEnded) {
            const el = breathRef.current;
            setManual(true);
            breathPlayArmed.current = true;
            if (el) {
              el.playbackRate = config.playback.breathRate;
              el.currentTime = timebase.autoplayStartSec;
              el.play().then(() => { setAutoplayBlocked(false); setBreathPlaying(true); }).catch(() => setAutoplayBlocked(true));
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
