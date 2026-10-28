import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { config, clamp, smooth } from './config';
import type { Phase } from './config';

type Props = {
  phase: Phase;
  progress: number;
  active: boolean;
  reduced: boolean;
  /** Fired once when video-2→video-3 stitch parks on horse+sitting-cat close-up. */
  onAutoplayDone?: () => void;
};

export function MediaStage({ phase, progress, active, reduced, onAutoplayDone }: Props) {
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

  // STV-43: autoplay video-2 once → stitch/hold video-3; no currentTime↔scroll.
  const inAutoplay = phase === 'autoplay';
  const holdingBreathStill =
    phase === 'waitClose'
    || phase === 'retreat'
    || phase === 'utpMini'
    || phase === 'comparison'
    || phase === 'utpDlg';
  const inBreathFlow = inAutoplay || holdingBreathStill;
  const inAmbience = phase === 'ambience';
  const scrubbingRotate = phase === 'rotate';
  const holdingRotateEnd = phase === 'obsolete';
  const inRotateScene = scrubbingRotate || holdingRotateEnd;
  const ambienceBlack = inAmbience && progress < config.ambience.blackEnd;
  const ambiencePlayingPhase = inAmbience && progress >= config.ambience.blackEnd;
  const holdSoundStill = ambienceBlack;

  const holdingCloseStill = holdingBreathStill || (inAutoplay && breathEnded);
  const index = inRotateScene
    ? 0
    : holdSoundStill ? 3
      : inAutoplay && !breathEnded ? 1
        : holdingCloseStill ? 2
          : phase === 'finale' ? 3
            : inAmbience ? 0
              : 0;

  const rotateRatio = scrubbingRotate ? smooth(progress) : holdingRotateEnd ? 1 : 0;

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
  const [breathPlaying, setBreathPlaying] = useState(false);
  const playingBreath = Boolean(
    inAutoplay && breathPlaying && !breathEnded && (!reduced || manual),
  );

  function parkUtpHold(el: HTMLVideoElement) {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);
    const target = clamp(config.utpHoldRatio * el.duration, 0, last);
    el.pause();
    if (!el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
  }

  function notifyBreathDone() {
    if (breathDoneNotified.current) return;
    breathDoneNotified.current = true;
    setBreathEnded(true);
    onDoneRef.current?.();
  }

  function ready(i: number) {
    const el = videos.current[i];
    if (!el || el.seeking || el.readyState < 2) return;
    if (i === index || (breathEnded && i === 2) || (holdingBreathStill && i === 2)) {
      setDisplay(i);
    }
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

  // Re-arm breath autoplay only when the story re-enters the autoplay phase.
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

  // Scroll-scrub Figma 54:751 rotate.mp4 (~4s) — no autoplay/loop; true last frame at phase end.
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

  // Ambience (Figma 34:547 Video 2): on scroll enter after black, play start→end once (not scrubbed).
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

  // Finale (spatial sound): play video-4 for its full duration — no early seek/timeout.
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

  // STV-43 breath: autoplay video-2 once (ignore scroll), stitch to video-3 hold, then freeze.
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

    // Prefetch breath clips.
    [1, 2].forEach(i => {
      const el = videos.current[i];
      if (el && el.preload !== 'auto') el.preload = 'auto';
    });

    // Hold still across wait / retreat / UTPs (and after autoplay stitch).
    if (holdingCloseStill) {
      const v2 = videos.current[1];
      v2?.pause();
      const v3 = videos.current[2];
      if (v3 && !errors[2]) {
        parkUtpHold(v3);
        setDisplay(2);
        ready(2);
      }
      return;
    }

    // Autoplay phase — play video-2 once; continues even if user stops scrolling.
    const v2 = videos.current[1];
    const v3 = videos.current[2];
    if (!v2 || errors[1]) return;

    if (reduced) {
      v2.pause();
      if (v3) parkUtpHold(v3);
      setDisplay(2);
      notifyBreathDone();
      return;
    }

    if (!breathPlayArmed.current) {
      try { if (v2.currentTime !== 0) v2.currentTime = 0; } catch { /* ignore */ }
      breathPlayArmed.current = true;
      setDisplay(1);
      // Warm video-3 for continuous stitch (horse frame ≈ start of next file).
      if (v3) {
        if (v3.preload !== 'auto') v3.preload = 'auto';
        try { parkUtpHold(v3); } catch { /* ignore */ }
      }
    }

    if (document.hidden) {
      v2.pause();
      return;
    }

    // Keep playing to end once armed — scroll stop / brief leave must not abort.
    if (!breathPlayArmed.current || breathEnded) return;
    if (!v2.paused || playPending.current.has('breath')) return;
    if (!Number.isFinite(v2.duration) || v2.duration <= 0) return;

    playPending.current.add('breath');
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
  const fallback = inBreathFlow
    ? (holdingCloseStill || reduced
      ? (config.media[2].poster)
      : config.media[1].poster)
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
    className={`media-stage${inRotateScene ? ' media-stage--rotate' : ''}`}
    style={{ '--media-crossfade': `${config.playback.crossfadeMs}ms` } as CSSProperties}
    data-media-index={inRotateScene ? 'rotate' : inAmbience ? 'ambience' : (phase === 'finale' || holdSoundStill ? 4 : index + 1)}
    data-mode={
      inAutoplay && !breathEnded ? (playingBreath ? 'play-breath' : 'still-breath')
        : holdingCloseStill ? 'still-utp'
          : inRotateScene ? (scrubbingRotate ? 'scroll-rotate' : 'still-rotate')
            : ambiencePlayingPhase ? (playingAmbience ? 'play-ambience' : 'still-ambience')
              : phase === 'finale' ? (playingFinale ? 'play' : 'still')
                : 'still'
    }
    data-testid="tv-drive"
    data-breath-ended={holdingCloseStill ? '1' : '0'}
    data-rotate-ratio={inRotateScene ? rotateRatio.toFixed(3) : undefined}
    data-rotate-ready={inRotateScene ? (rotateReady ? '1' : '0') : undefined}
  >
    <img className="media-fallback" src={fallback} alt="Телевизор Sber TV" />
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
        if (i === 1 && breathPlayArmed.current && !breathDoneNotified.current) {
          // Continuous stitch: horse frame is start of video-3 — park & unlock wait.
          const v2 = videos.current[1];
          const v3 = videos.current[2];
          v2?.pause();
          if (v3) {
            parkUtpHold(v3);
            setDisplay(2);
          }
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
              el.currentTime = 0;
              el.play().then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
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
