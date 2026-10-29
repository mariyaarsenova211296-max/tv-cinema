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

/**
 * Single-clip breath (TZ): SCRUB 0→1 · PLAY 1→7 · HOLD @7 · SCRUB 7→end.
 * Then SCRUB 5→6 transition · sound PLAY · ambience PLAY · rotate SCRUB.
 */
export function MediaStage({
  phase,
  progress,
  active,
  reduced,
  breathScale,
  autoplayDone,
  onAutoplayDone,
}: Props) {
  const breathRef = useRef<HTMLVideoElement | null>(null);
  const toSoundRef = useRef<HTMLVideoElement | null>(null);
  const soundRef = useRef<HTMLVideoElement | null>(null);
  const ambienceRef = useRef<HTMLVideoElement | null>(null);
  const rotateRef = useRef<HTMLVideoElement | null>(null);
  const playPending = useRef(new Set<string>());
  const breathPlayArmed = useRef(false);
  const breathDoneNotified = useRef(false);
  const soundArmed = useRef(false);
  const ambienceArmed = useRef(false);
  const onDoneRef = useRef(onAutoplayDone);
  onDoneRef.current = onAutoplayDone;

  const [breathReady, setBreathReady] = useState(false);
  const [breathEnded, setBreathEnded] = useState(false);
  const [breathPlaying, setBreathPlaying] = useState(false);
  const [breathError, setBreathError] = useState(false);
  const [soundEnded, setSoundEnded] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [ambienceEnded, setAmbienceEnded] = useState(false);
  const [ambienceReady, setAmbienceReady] = useState(false);
  const [ambienceError, setAmbienceError] = useState(false);
  const [, setRotateReady] = useState(false);
  const [rotateError, setRotateError] = useState(false);
  const [, setToSoundReady] = useState(false);
  const [toSoundError, setToSoundError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [breathDuration, setBreathDuration] = useState<number>(timebase.breathSec);

  const breathState: BreathState | null = resolveBreathState(
    phase,
    autoplayDone || breathEnded,
  );
  const inApproach = breathState === 'SCROLL_APPROACH';
  const inAutoplay = breathState === 'AUTO_PLAY';
  const inHold = breathState === 'HOLD_RIDER';
  const inOutro = breathState === 'SCROLL_OUTRO';
  const inBreathFlow = breathState !== null;
  const inToSound = phase === 'toSound';
  const inAmbience = phase === 'ambience';
  const scrubbingRotate = phase === 'rotate';
  const holdingRotateEnd = phase === 'obsolete';
  const inRotateScene = scrubbingRotate || holdingRotateEnd;
  const ambienceBlack = inAmbience && progress < config.ambience.blackEnd;
  const ambiencePlayingPhase = inAmbience && progress >= config.ambience.blackEnd;
  const holdSoundStill = ambienceBlack;
  const inFinale = phase === 'finale';
  const toSoundRatio = inToSound ? smooth(progress) : 0;

  const approachSec = inApproach ? approachScrubSec(progress) : timebase.approachEndSec;
  const outroSec = inOutro
    ? outroScrubSec(
        (phase === 'comparison' || phase === 'utpDlg') ? 1 : progress,
        breathDuration,
      )
    : timebase.holdSec;

  const soundFade =
    inFinale
      ? (soundEnded && progress > 0.85 ? 1 - smooth((progress - 0.85) / 0.15) : 1)
      : ambienceBlack
        ? 1 - smooth(progress / config.ambience.blackEnd)
        : 0;
  const ambienceFade = ambiencePlayingPhase
    ? smooth(
        (progress - config.ambience.blackEnd)
          / Math.max(0.001, config.ambience.videoIn - config.ambience.blackEnd),
      )
    : 0;

  const rotateRatio = scrubbingRotate ? smooth(progress) : holdingRotateEnd ? 1 : 0;

  const playingBreath = Boolean(
    inAutoplay && breathPlaying && !breathEnded && (!reduced || manual),
  );
  const playingSound = Boolean(
    active && visible && inFinale && !soundEnded && (!reduced || manual),
  );
  const playingAmbience = Boolean(
    active
      && visible
      && ambiencePlayingPhase
      && !ambienceEnded
      && !ambienceError
      && (!reduced || manual),
  );

  function seekPaused(el: HTMLVideoElement, sec: number) {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    const target = clamp(sec, 0, last);
    if (!el.paused) el.pause();
    // Skip while a seek is in flight or we're already on-target — prevents
    // seek thrashing that freezes sticky stages mid-scroll.
    if (el.seeking || Math.abs(el.currentTime - target) <= config.playback.seekTolerance) {
      return;
    }
    el.currentTime = target;
  }

  function notifyBreathDone() {
    if (breathDoneNotified.current) return;
    breathDoneNotified.current = true;
    setBreathEnded(true);
    setBreathPlaying(false);
    onDoneRef.current?.();
  }

  function parkHold(el: HTMLVideoElement) {
    seekPaused(el, Math.min(timebase.holdSec, Math.max(0, el.duration - 1 / 24)));
  }

  function noteDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    setBreathDuration(prev => (Math.abs(prev - seconds) > 0.001 ? seconds : prev));
  }

  useEffect(() => {
    if (phase !== 'finale') {
      soundArmed.current = false;
      setSoundEnded(false);
    }
  }, [phase]);

  useEffect(() => {
    if (!inAmbience && ambienceEnded) {
      ambienceArmed.current = false;
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

  // Screen 5→6 transition SCRUB — single paused timeline, no PLAY competition
  useEffect(() => {
    const el = toSoundRef.current;
    if (!el || !inToSound) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    const target = reduced || toSoundRatio >= 0.999
      ? last
      : clamp(toSoundRatio * el.duration, 0, last);
    seekPaused(el, target);
    if (el.readyState >= 2) setToSoundReady(true);
  });

  // Rotate scrub
  useEffect(() => {
    const el = rotateRef.current;
    if (!el || !inRotateScene) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    const target = reduced || holdingRotateEnd || rotateRatio >= 0.999
      ? last
      : clamp(rotateRatio * el.duration, 0, last);
    seekPaused(el, target);
    if (el.readyState >= 2) setRotateReady(true);
  });

  // Ambience PLAY
  useEffect(() => {
    const el = ambienceRef.current;
    if (!el) return;
    const keepPlaying = ambienceArmed.current && !ambienceEnded && !reduced;
    if (!ambiencePlayingPhase && !keepPlaying) {
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
    if (ambiencePlayingPhase && !ambienceArmed.current) {
      el.pause();
      el.currentTime = 0;
      ambienceArmed.current = true;
      setAmbienceEnded(false);
    }
    if (ambienceEnded) {
      el.pause();
      el.currentTime = Math.max(0, el.duration - 1 / 24);
      return;
    }
    if (document.hidden || !ambienceArmed.current) {
      el.pause();
      return;
    }
    if (!el.paused || playPending.current.has('ambience')) return;
    playPending.current.add('ambience');
    el.play()
      .then(() => setAutoplayBlocked(false))
      .catch(err => {
        if (err.name !== 'AbortError') setAutoplayBlocked(true);
      })
      .finally(() => playPending.current.delete('ambience'));
  });

  // Sound PLAY (v4)
  useEffect(() => {
    if (!inFinale && !holdSoundStill) return;
    const el = soundRef.current;
    if (!el) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;

    if (holdSoundStill) {
      el.pause();
      el.currentTime = Math.max(0, el.duration - 1 / 24);
      return;
    }

    if (!soundArmed.current) {
      if (!reduced) {
        try {
          if (el.currentTime !== 0) el.currentTime = 0;
        } catch { /* ignore */ }
      } else {
        el.pause();
        el.currentTime = Math.max(0, el.duration - 1 / 24);
        setSoundEnded(true);
      }
      soundArmed.current = true;
    }

    if (soundEnded || reduced) {
      el.pause();
      return;
    }
    if (!active || document.hidden || !playingSound) {
      el.pause();
      return;
    }
    if (!el.paused || playPending.current.has('sound')) return;
    playPending.current.add('sound');
    el.play()
      .then(() => setAutoplayBlocked(false))
      .catch(err => {
        if (err.name !== 'AbortError') setAutoplayBlocked(true);
      })
      .finally(() => playPending.current.delete('sound'));
  });

  // Single continuous breath-s3to5 controller (one timeline, no double-bind):
  // SCRUB 0→1 · PLAY 1→7 · HOLD @7 · SCRUB 7→end (UTPs hold end frame).
  useEffect(() => {
    if (inRotateScene || inFinale || inAmbience || inToSound || !inBreathFlow) {
      breathRef.current?.pause();
      return;
    }

    const el = breathRef.current;
    if (!el || breathError) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    el.playbackRate = config.playback.breathRate;

    if (Number.isFinite(el.duration) && el.duration > 0) {
      noteDuration(el.duration);
    }

    if (inApproach) {
      const sec = reduced ? timebase.approachEndSec : approachSec;
      seekPaused(el, sec);
      if (el.readyState >= 2) setBreathReady(true);
      return;
    }

    if (inHold) {
      parkHold(el);
      if (el.readyState >= 2) setBreathReady(true);
      return;
    }

    if (inOutro) {
      // One outro scrub across retreat; RGB/DLG hold the end frame (no re-scrub).
      const sec = (phase === 'comparison' || phase === 'utpDlg')
        ? outroScrubSec(1, breathDuration)
        : outroSec;
      seekPaused(el, sec);
      if (el.readyState >= 2) setBreathReady(true);
      return;
    }

    // AUTO_PLAY 1 → 7 — time-driven only; never seek while playing.
    if (reduced) {
      parkHold(el);
      notifyBreathDone();
      return;
    }

    if (!active && !breathPlayArmed.current) {
      seekPaused(el, timebase.approachEndSec);
      return;
    }

    if (document.hidden && breathPlayArmed.current && !breathEnded) {
      el.pause();
      return;
    }

    if (!breathPlayArmed.current) {
      if (!active) return;
      seekPaused(el, timebase.approachEndSec);
      breathPlayArmed.current = true;
    }

    if (document.hidden || !breathPlayArmed.current || breathEnded) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;

    if (el.currentTime + 0.04 >= timebase.holdSec) {
      parkHold(el);
      notifyBreathDone();
      return;
    }

    if (!el.paused || playPending.current.has('breath')) return;

    playPending.current.add('breath');
    el.play()
      .then(() => {
        setAutoplayBlocked(false);
        setBreathPlaying(true);
        setBreathReady(true);
      })
      .catch(err => {
        if (err.name !== 'AbortError') setAutoplayBlocked(true);
      })
      .finally(() => playPending.current.delete('breath'));
  });

  useEffect(() => {
    if (!inAutoplay || breathEnded || reduced) return;
    const el = breathRef.current;
    if (!el) return;
    const onTime = () => {
      if (breathDoneNotified.current) return;
      if (el.currentTime + 0.04 >= timebase.holdSec) {
        parkHold(el);
        notifyBreathDone();
      }
    };
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, [inAutoplay, breathEnded, reduced]);

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        breathRef.current?.pause();
        soundRef.current?.pause();
        ambienceRef.current?.pause();
        rotateRef.current?.pause();
      }
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      breathRef.current?.pause();
      soundRef.current?.pause();
      ambienceRef.current?.pause();
      rotateRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    setManual(false);
  }, [phase, active]);

  const still = reduced && !manual;
  const showBreath = inBreathFlow && !inAmbience && !inRotateScene && !inFinale && !inToSound;
  const showToSound = inToSound && !toSoundError && !(reduced && still);
  const showSound = (inFinale || holdSoundStill) && soundFade > 0.01 && !inBreathFlow && !inRotateScene && !inToSound;
  const showAmbience = ambiencePlayingPhase && ambienceFade > 0.01 && !ambienceError && !(reduced && still);
  const showRotate = inRotateScene && !rotateError && !(reduced && still);

  const fallback = inApproach
    ? (approachSec / timebase.approachEndSec < 0.85
      ? config.breathMedia.poster
      : config.breathMedia.end)
    : inAutoplay || inHold || inOutro
      ? config.breathMedia.end
      : inToSound
        ? (toSoundRatio > 0.95 ? config.toSoundMedia.end : config.toSoundMedia.poster)
        : inRotateScene
          ? (reduced || rotateRatio > 0.95 || holdingRotateEnd
            ? config.rotateMedia.end
            : config.rotateMedia.poster)
          : inAmbience
            ? (ambienceEnded || reduced ? config.ambienceMedia.end : config.ambienceMedia.poster)
            : (soundEnded || holdSoundStill ? config.soundMedia.end : config.soundMedia.poster);

  const showVideoPlane = !still && showBreath && breathReady && !breathError;

  const needsManual =
    active
    && (
      (inAutoplay && !breathEnded && !playingBreath)
      || (inFinale && !playingSound)
      || (ambiencePlayingPhase && !playingAmbience)
    )
    && (reduced || autoplayBlocked);

  return (
    <div
      className={`media-stage${inRotateScene ? ' media-stage--rotate' : ''}${inBreathFlow ? ' media-stage--breath' : ''}`}
      style={{
        '--media-crossfade': `${config.playback.breathCrossfadeMs}ms`,
        '--breath-scale': String(breathScale),
        '--crop-scale': '1',
      } as CSSProperties}
      data-media-index={
        inRotateScene
          ? 'rotate'
          : inAmbience
            ? 'ambience'
            : inFinale || holdSoundStill
              ? 'sound'
              : inToSound
                ? 'to-sound'
                : 'breath'
      }
      data-breath-state={inBreathFlow ? breathState : undefined}
      data-mode={
        inApproach
          ? 'scroll-approach'
          : inAutoplay && !breathEnded
            ? (playingBreath ? 'play-breath' : 'still-breath')
            : inHold
              ? 'hold-rider'
              : inOutro
                ? 'scroll-outro'
                : inToSound
                  ? 'scroll-to-sound'
                  : inRotateScene
                    ? (scrubbingRotate ? 'scroll-rotate' : 'still-rotate')
                    : ambiencePlayingPhase
                      ? (playingAmbience ? 'play-ambience' : 'still-ambience')
                      : inFinale
                        ? (playingSound ? 'play' : 'still')
                        : 'still'
      }
      data-testid="tv-drive"
      data-breath-ended={inHold || inOutro ? '1' : '0'}
      data-breath-scale={breathScale.toFixed(3)}
      data-approach-sec={inApproach ? approachSec.toFixed(3) : undefined}
      data-hold-sec={inHold ? timebase.holdSec.toFixed(3) : undefined}
      data-outro-sec={inOutro ? outroSec.toFixed(3) : undefined}
      data-breath-t={
        showBreath && breathRef.current
          ? breathRef.current.currentTime.toFixed(3)
          : undefined
      }
    >
      <img
        className="media-fallback"
        src={fallback}
        alt="Телевизор Sber TV"
        style={{ opacity: showVideoPlane || showRotate || showAmbience || showSound || showToSound ? 0 : 1 }}
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
        className={showVideoPlane ? 'visible' : ''}
        onLoadedData={() => setBreathReady(true)}
        onCanPlay={() => setBreathReady(true)}
        onLoadedMetadata={() => {
          const el = breathRef.current;
          if (el && Number.isFinite(el.duration)) setBreathDuration(el.duration);
        }}
        onSeeked={() => setBreathReady(true)}
        onEnded={() => {
          if (breathPlayArmed.current && !breathDoneNotified.current) {
            const el = breathRef.current;
            if (el) parkHold(el);
            notifyBreathDone();
          }
        }}
        onError={() => setBreathError(true)}
      />

      <video
        ref={toSoundRef}
        data-testid="video-to-sound"
        src={config.toSoundMedia.src}
        poster={config.toSoundMedia.poster}
        muted
        playsInline
        preload={inToSound ? 'auto' : 'metadata'}
        aria-hidden="true"
        className={showToSound && !still ? 'visible' : ''}
        onLoadedData={() => setToSoundReady(true)}
        onCanPlay={() => setToSoundReady(true)}
        onSeeked={() => setToSoundReady(true)}
        onError={() => setToSoundError(true)}
      />

      <video
        ref={soundRef}
        data-testid="video-sound"
        src={config.soundMedia.src}
        poster={config.soundMedia.poster}
        muted
        playsInline
        preload={inFinale || holdSoundStill ? 'auto' : 'metadata'}
        aria-hidden="true"
        style={{ opacity: soundFade }}
        className={showSound && soundReady && !still && !soundError ? 'visible' : ''}
        onLoadedData={() => setSoundReady(true)}
        onCanPlay={() => setSoundReady(true)}
        onEnded={() => {
          const el = soundRef.current;
          if (el && Number.isFinite(el.duration)) el.currentTime = Math.max(0, el.duration - 1 / 24);
          el?.pause();
          setSoundEnded(true);
        }}
        onError={() => setSoundError(true)}
      />

      <video
        ref={ambienceRef}
        data-testid="video-ambience"
        src={config.ambienceMedia.src}
        poster={config.ambienceMedia.poster}
        muted
        playsInline
        preload={inAmbience ? 'auto' : 'metadata'}
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
        preload={inRotateScene ? 'auto' : 'metadata'}
        aria-hidden="true"
        className={showRotate && !still ? 'visible' : ''}
        onLoadedData={() => setRotateReady(true)}
        onCanPlay={() => setRotateReady(true)}
        onSeeked={() => setRotateReady(true)}
        onError={() => setRotateError(true)}
      />

      {(still || breathError || soundError) && (
        <img className="media-still" src={fallback} alt="Телевизор Sber TV" />
      )}

      {needsManual && (
        <button
          className="manual-play"
          aria-pressed={manual}
          onClick={() => {
            if (inAutoplay && !breathEnded) {
              const el = breathRef.current;
              setManual(true);
              breathPlayArmed.current = true;
              if (el) {
                el.playbackRate = config.playback.breathRate;
                el.currentTime = timebase.approachEndSec;
                el.play()
                  .then(() => {
                    setAutoplayBlocked(false);
                    setBreathPlaying(true);
                  })
                  .catch(() => setAutoplayBlocked(true));
              }
              return;
            }
            if (inFinale) {
              const el = soundRef.current;
              setManual(true);
              setSoundEnded(false);
              soundArmed.current = true;
              if (el) {
                el.currentTime = 0;
                el.play()
                  .then(() => setAutoplayBlocked(false))
                  .catch(() => setAutoplayBlocked(true));
              }
              return;
            }
            if (ambiencePlayingPhase) {
              const el = ambienceRef.current;
              setManual(true);
              setAmbienceEnded(false);
              ambienceArmed.current = true;
              if (el) {
                el.currentTime = 0;
                el.play()
                  .then(() => setAutoplayBlocked(false))
                  .catch(() => setAutoplayBlocked(true));
              }
            }
          }}
        >
          {manual ? 'Пауза' : 'Воспроизвести видео'}
          <span aria-hidden="true">{manual ? 'Ⅱ' : '▷'}</span>
        </button>
      )}
    </div>
  );
}
