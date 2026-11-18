import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  breathScrubSec,
  config,
  clamp,
  isBreathPhase,
  smooth,
  timebase,
  toSoundLayers,
} from './config';
import type { Phase } from './config';

type Props = {
  phase: Phase;
  progress: number;
  active: boolean;
  reduced: boolean;
  breathScale: number;
};

/**
 * STV-78: continuous scroll-scrub of breath-space.mp4 (sole visual).
 * Scroll sets a target time; RAF lerps displayed currentTime toward it
 * (bidirectional; settles/holds when scroll stops). From ≥11s uses gentler
 * follow Hz; turn/end segments have more scroll H. toSound fades → sound poster.
 */
export function MediaStage({
  phase,
  progress,
  active,
  reduced,
  breathScale,
}: Props) {
  const breathRef = useRef<HTMLVideoElement | null>(null);
  const soundRef = useRef<HTMLVideoElement | null>(null);
  const ambienceRef = useRef<HTMLVideoElement | null>(null);
  const rotateRef = useRef<HTMLVideoElement | null>(null);
  const playPending = useRef(new Set<string>());
  const soundArmed = useRef(false);
  const ambienceArmed = useRef(false);
  /** Pending hard-seek destination while a seek is in flight. */
  const seekTarget = useRef<number | null>(null);
  const seeking = useRef(false);
  /** Scroll-driven scrub goal (seconds). */
  const scrubGoal = useRef(0);
  /** Lerped display time driven by RAF. */
  const scrubDisplay = useRef(0);
  const scrubGoalAt = useRef(0);
  const scrubRaf = useRef(0);
  const scrubLastTs = useRef(0);
  const scrubActive = useRef(false);

  const [breathReady, setBreathReady] = useState(false);
  const [breathError, setBreathError] = useState(false);
  const [soundEnded, setSoundEnded] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [ambienceEnded, setAmbienceEnded] = useState(false);
  const [ambienceReady, setAmbienceReady] = useState(false);
  const [ambienceError, setAmbienceError] = useState(false);
  const [, setRotateReady] = useState(false);
  const [rotateError, setRotateError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);

  const inBreath = isBreathPhase(phase);
  const inToSound = phase === 'toSound';
  const inAmbience = phase === 'ambience';
  const scrubbingRotate = phase === 'rotate';
  const holdingRotateEnd = phase === 'obsolete';
  const inRotateScene = scrubbingRotate || holdingRotateEnd;
  const ambienceBlack = inAmbience && progress < config.ambience.blackEnd;
  const ambiencePlayingPhase = inAmbience && progress >= config.ambience.blackEnd;
  const holdSoundStill = ambienceBlack;
  const inFinale = phase === 'finale';

  const scrubSec = inBreath
    ? (breathScrubSec(phase, progress) ?? 0)
    : inToSound
      ? timebase.lastFrameSec
      : null;

  const fade = inToSound ? toSoundLayers(progress) : null;

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

  function breathLastSec(el: HTMLVideoElement): number {
    return Math.min(
      timebase.lastFrameSec,
      Math.max(0, (Number.isFinite(el.duration) && el.duration > 0
        ? el.duration
        : timebase.breathSec) - 1 / timebase.fps),
    );
  }

  function applySeek(el: HTMLVideoElement, sec: number) {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const target = clamp(sec, 0, breathLastSec(el));
    if (!el.paused) el.pause();
    if (Math.abs(el.currentTime - target) <= config.playback.seekTolerance) {
      seeking.current = false;
      seekTarget.current = null;
      return;
    }
    if (seeking.current) {
      seekTarget.current = target;
      return;
    }
    seeking.current = true;
    seekTarget.current = target;
    el.currentTime = target;
  }

  function onBreathSeeked() {
    setBreathReady(true);
    const el = breathRef.current;
    const pending = seekTarget.current;
    seeking.current = false;
    if (!el || pending == null) return;
    if (Math.abs(el.currentTime - pending) > config.playback.seekTolerance) {
      seeking.current = true;
      el.currentTime = pending;
      return;
    }
    seekTarget.current = null;
  }

  function seekPaused(el: HTMLVideoElement, sec: number) {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    const target = clamp(sec, 0, last);
    if (!el.paused) el.pause();
    if (el.seeking || Math.abs(el.currentTime - target) <= config.playback.seekTolerance) {
      return;
    }
    el.currentTime = target;
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

  // Publish scroll → scrub goal (React render path; seek happens on RAF).
  useEffect(() => {
    if (inRotateScene || inFinale || inAmbience) {
      breathRef.current?.pause();
      scrubActive.current = false;
      return;
    }
    if (!inBreath && !inToSound) {
      scrubActive.current = false;
      return;
    }

    const el = breathRef.current;
    if (!el || breathError) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    if (!active && !breathReady && el.readyState < 2) el.load();

    if (scrubSec == null) return;
    const wasActive = scrubActive.current;
    scrubGoal.current = scrubSec;
    scrubGoalAt.current = performance.now();
    scrubActive.current = true;
    // Cold-enter: don't ease from a stale time across section transitions.
    if (!wasActive || Math.abs(scrubDisplay.current - scrubSec) > 1.5) {
      scrubDisplay.current = scrubSec;
    }

    if (reduced) {
      scrubDisplay.current = scrubSec;
      applySeek(el, scrubSec);
      if (el.readyState >= 2) setBreathReady(true);
    }
  });

  // STV-77: RAF lerp displayed time toward scroll goal; settle/hold when idle.
  useEffect(() => {
    if (reduced) return;

    const tick = (ts: number) => {
      scrubRaf.current = requestAnimationFrame(tick);
      if (!scrubActive.current) {
        scrubLastTs.current = ts;
        return;
      }
      const el = breathRef.current;
      if (!el || breathError) {
        scrubLastTs.current = ts;
        return;
      }

      const last = breathLastSec(el);
      const goal = clamp(scrubGoal.current, 0, last);
      const prev = scrubLastTs.current || ts;
      const dt = Math.min(0.05, Math.max(0, (ts - prev) / 1000));
      scrubLastTs.current = ts;

      const idleMs = performance.now() - scrubGoalAt.current;
      const settle = config.playback.scrubSettleSec;
      let display = scrubDisplay.current;

      if (
        Math.abs(goal - display) <= settle
        || idleMs >= config.playback.scrubIdleMs
      ) {
        display = goal;
      } else {
        const late = Math.max(goal, display) >= timebase.lateScrubSec;
        const followHz = late
          ? config.playback.scrubFollowHzLate
          : config.playback.scrubFollowHz;
        const alpha = 1 - Math.exp(-followHz * dt);
        display += (goal - display) * alpha;
        if (Math.abs(goal - display) <= settle) display = goal;
      }

      scrubDisplay.current = clamp(display, 0, last);
      applySeek(el, scrubDisplay.current);
    };

    scrubRaf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(scrubRaf.current);
      scrubRaf.current = 0;
      scrubLastTs.current = 0;
    };
  }, [reduced, breathError]);

  // Rotate scrub
  useEffect(() => {
    const el = rotateRef.current;
    if (!el || !inRotateScene) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const handoff = Math.min(
      config.rotateMedia.scrubEndSec,
      Math.max(0, el.duration - 1 / 24),
    );
    const target = reduced || holdingRotateEnd || rotateRatio >= 0.999
      ? handoff
      : clamp(rotateRatio * handoff, 0, handoff);
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

  // Sound PLAY
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
  const showBreath =
    (inBreath || inToSound)
    && !inAmbience
    && !inRotateScene
    && !inFinale;
  const breathOpacity = inToSound && fade
    ? fade.breath
    : showBreath
      ? 1
      : 0;
  const showSound =
    (inFinale || holdSoundStill)
    && soundFade > 0.01
    && !inBreath
    && !inRotateScene
    && !inToSound;
  const showAmbience =
    ambiencePlayingPhase && ambienceFade > 0.01 && !ambienceError && !(reduced && still);
  const showRotate = inRotateScene && !rotateError && !(reduced && still);
  const showPoster = inToSound && fade ? fade.poster > 0.01 : false;
  const showBlack = inToSound && fade ? fade.black > 0.01 : false;

  const fallback = inBreath
    ? (scrubSec != null && scrubSec < 1
      ? config.breathMedia.poster
      : config.breathMedia.end)
    : inToSound
      ? config.toSoundMedia.poster
      : inRotateScene
        ? (reduced || rotateRatio > 0.95 || holdingRotateEnd
          ? config.rotateMedia.end
          : config.rotateMedia.poster)
        : inAmbience
          ? (ambienceEnded || reduced ? config.ambienceMedia.end : config.ambienceMedia.poster)
          : (soundEnded || holdSoundStill ? config.soundMedia.end : config.soundMedia.poster);

  const showVideoPlane =
    !still && showBreath && breathReady && !breathError && breathOpacity > 0.01;

  const needsManual =
    active
    && (
      (inFinale && !playingSound)
      || (ambiencePlayingPhase && !playingAmbience)
    )
    && (reduced || autoplayBlocked);

  return (
    <div
      className={`media-stage${inRotateScene ? ' media-stage--rotate' : ''}${inBreath || inToSound ? ' media-stage--breath' : ''}`}
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
      data-mode={
        inBreath
          ? 'scroll-scrub'
          : inToSound
            ? 'fade-to-sound'
            : inRotateScene
              ? (scrubbingRotate ? 'scroll-rotate' : 'still-rotate')
              : ambiencePlayingPhase
                ? (playingAmbience ? 'play-ambience' : 'still-ambience')
                : inFinale
                  ? (playingSound ? 'play' : 'still')
                  : 'still'
      }
      data-testid="tv-drive"
      data-breath-t={
        showBreath && breathRef.current
          ? breathRef.current.currentTime.toFixed(3)
          : undefined
      }
      data-scrub-sec={scrubSec != null ? scrubSec.toFixed(3) : undefined}
    >
      <img
        className="media-fallback"
        src={fallback}
        alt="Телевизор Sber TV"
        style={{
          opacity: showVideoPlane || showRotate || showAmbience || showSound || showPoster
            ? 0
            : 1,
        }}
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
        style={{ opacity: showVideoPlane ? breathOpacity : 0 }}
        onLoadedData={() => setBreathReady(true)}
        onCanPlay={() => setBreathReady(true)}
        onSeeked={onBreathSeeked}
        onError={() => setBreathError(true)}
      />

      {showBlack && fade && (
        <div
          className="media-to-sound-black"
          style={{ opacity: fade.black }}
          aria-hidden="true"
        />
      )}

      {showPoster && fade && (
        <img
          className="media-to-sound-poster"
          src={config.toSoundMedia.poster}
          alt=""
          style={{ opacity: fade.poster }}
          aria-hidden="true"
        />
      )}

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
