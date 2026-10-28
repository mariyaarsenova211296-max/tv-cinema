import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { config, clamp, breathVideoProgress, smooth } from './config';
import type { Phase } from './config';

export function MediaStage({ phase, progress, active, reduced }: { phase: Phase; progress: number; active: boolean; reduced: boolean }) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const ambienceRef = useRef<HTMLVideoElement | null>(null);
  const rotateRef = useRef<HTMLVideoElement | null>(null);
  const desired = useRef({ index: 0, timeSec: 0, scrubbing: false });
  const playPending = useRef(new Set<number | 'ambience'>());
  const finalePlayArmed = useRef(false);
  const ambiencePlayArmed = useRef(false);
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

  const inBreathFlow = phase === 'reveal' || phase === 'zoom' || phase === 'feature' || phase === 'retreat';
  const holdingUtp = phase === 'comparison' || phase === 'utpDlg';
  const fadingUtp = phase === 'orbit' && progress <= config.text.leaveEnd;
  const inAmbience = phase === 'ambience';
  const scrubbingRotate = phase === 'rotate';
  const holdingRotateEnd = phase === 'obsolete';
  const inRotateScene = scrubbingRotate || holdingRotateEnd;
  const ambienceBlack = inAmbience && progress < config.ambience.blackEnd;
  const ambiencePlayingPhase = inAmbience && progress >= config.ambience.blackEnd;
  const holdSoundStill = ambienceBlack;

  // STV-41: breath = full video-2 scrub; UTPs hold video-3 early frame; orbit scrubs video-3.
  const index = inRotateScene
    ? 0
    : holdSoundStill ? 3
      : inBreathFlow ? 1
        : holdingUtp || fadingUtp || phase === 'orbit' ? 2
          : phase === 'finale' ? 3
            : inAmbience ? 0
              : 0;

  const holdUtpFrame = holdingUtp || fadingUtp;
  const scrubbingOrbit = phase === 'orbit' && !fadingUtp;
  const scrubbing = inBreathFlow || scrubbingOrbit || scrubbingRotate;
  const breathRatio = breathVideoProgress(phase, progress);
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
  // Breath + orbit are scrub-only; no autoplay on video-2/3.
  desired.current = { index, timeSec: 0, scrubbing: scrubbing && !holdUtpFrame };

  function ready(i: number) {
    const el = videos.current[i];
    const target = desired.current;
    if (!el || target.index !== i || el.seeking || el.readyState < 2) return;
    setDisplay(i);
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

  // Breath video-2 scrub + UTP hold / orbit scrub on video-3.
  useEffect(() => {
    if (!active || document.hidden) {
      videos.current.forEach(el => el?.pause());
      rotateRef.current?.pause();
      if (!ambiencePlayArmed.current || ambienceEnded) ambienceRef.current?.pause();
      else if (document.hidden) ambienceRef.current?.pause();
      return;
    }
    if (inRotateScene || phase === 'finale' || inAmbience) {
      if (inRotateScene || inAmbience) {
        videos.current.forEach((el, i) => { if (!(holdSoundStill && i === 3)) el?.pause(); });
      }
      return;
    }

    videos.current.forEach((el, i) => {
      if (!el) return;
      if ((Math.abs(i - index) <= 1 || i === 3 || i === 1 || i === 2) && el.preload !== 'auto') el.preload = 'auto';
      el.playbackRate = 1;
      el.pause();
    });

    const el = videos.current[index];
    if (!el || errors[index]) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const last = Math.max(0, el.duration - 1 / 24);

    let target = el.currentTime;
    if (holdUtpFrame) {
      target = clamp(config.utpHoldRatio * el.duration, 0, last);
    } else if (inBreathFlow) {
      target = reduced ? last : clamp(breathRatio * el.duration, 0, last);
    } else if (scrubbingOrbit) {
      const normalized = clamp((progress - config.text.leaveEnd) / Math.max(0.001, 1 - config.text.leaveEnd));
      target = reduced ? last : clamp(smooth(normalized) * el.duration, 0, last);
    }

    if (!el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
    setDisplay(index);
    ready(index);
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
  useEffect(() => { setManual(false); }, [index, active, inBreathFlow, inAmbience, inRotateScene, phase]);

  const still = reduced && !manual;
  const fallback = inBreathFlow
    ? (reduced || breathRatio > 0.95 ? config.media[1].end : config.media[1].poster)
    : inRotateScene
      ? (reduced || rotateRatio > 0.95 || holdingRotateEnd ? config.rotateMedia.end : config.rotateMedia.poster)
      : inAmbience
        ? (ambienceEnded || reduced ? config.ambienceMedia.end : config.ambienceMedia.poster)
        : holdUtpFrame
          ? config.media[2].poster
          : config.media[holdSoundStill || phase === 'finale' ? 3 : index][
            holdSoundStill || (phase === 'finale' && video4Ended) || (phase === 'orbit' && !holdUtpFrame && progress > 0.95)
              ? 'end'
              : 'poster'
          ];
  const showRotate = inRotateScene && !rotateError && !(reduced && still);
  const showAmbience = ambiencePlayingPhase && ambienceFade > 0.01 && !ambienceError && !(reduced && still);
  const showSound = (phase === 'finale' || holdSoundStill) && soundFade > 0.01 && !inBreathFlow && !inRotateScene;
  const showBreathOrUtp = (inBreathFlow || holdingUtp || phase === 'orbit') && !inAmbience && !inRotateScene;

  return <div
    className={`media-stage${inRotateScene ? ' media-stage--rotate' : ''}`}
    style={{ '--media-crossfade': `${config.playback.crossfadeMs}ms` } as CSSProperties}
    data-media-index={inRotateScene ? 'rotate' : inAmbience ? 'ambience' : (phase === 'finale' || holdSoundStill ? 4 : index + 1)}
    data-mode={
      inBreathFlow ? 'scroll-breath'
        : inRotateScene ? (scrubbingRotate ? 'scroll-rotate' : 'still-rotate')
          : ambiencePlayingPhase ? (playingAmbience ? 'play-ambience' : 'still-ambience')
            : phase === 'finale' ? (playingFinale ? 'play' : 'still')
              : holdUtpFrame ? 'still-utp'
                : scrubbing ? 'scroll'
                  : 'still'
    }
    data-testid="tv-drive"
    data-breath-ratio={inBreathFlow ? breathRatio.toFixed(3) : undefined}
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
    {active && ((phase === 'finale' && !playingFinale) || (ambiencePlayingPhase && !playingAmbience)) && (reduced || autoplayBlocked) && (
      <button className="manual-play" aria-pressed={manual}
        onClick={() => {
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
