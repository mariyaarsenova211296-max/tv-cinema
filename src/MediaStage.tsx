import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { config, clamp, zoomProgress, smooth } from './config';
import type { Phase } from './config';

export function MediaStage({ phase, progress, active, reduced }: { phase: Phase; progress: number; active: boolean; reduced: boolean }) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const zoomRef = useRef<HTMLVideoElement | null>(null);
  const ambienceRef = useRef<HTMLVideoElement | null>(null);
  const desired = useRef({ index: 0, timeSec: 0, scrubbing: false });
  const playPending = useRef(new Set<number | 'ambience'>());
  const featureSeekDone = useRef(false);
  const finalePlayArmed = useRef(false);
  const ambiencePlayArmed = useRef(false);
  const [display, setDisplay] = useState(-1);
  const [zoomReady, setZoomReady] = useState(false);
  const [ambienceReady, setAmbienceReady] = useState(false);
  const [ambienceEnded, setAmbienceEnded] = useState(false);
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [zoomError, setZoomError] = useState(false);
  const [ambienceError, setAmbienceError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [video1Ended, setVideo1Ended] = useState(false);
  const [video4Ended, setVideo4Ended] = useState(false);

  const fadingComparison = phase === 'orbit' && progress <= config.text.leaveEnd;
  const scrubbingZoom = phase === 'reveal' || phase === 'zoom';
  const inAmbience = phase === 'ambience';
  const ambienceBlack = inAmbience && progress < config.ambience.blackEnd;
  const ambiencePlayingPhase = inAmbience && progress >= config.ambience.blackEnd;
  // Hold faded spatial-sound still only during the black beat into ambience.
  const holdSoundStill = ambienceBlack;
  const index = scrubbingZoom
    ? 0
    : holdSoundStill ? 3
      : phase === 'retreat' || phase === 'comparison' || fadingComparison ? 1
        : phase === 'orbit' ? 2
          : phase === 'finale' ? 3
            : inAmbience ? 0
              : 0;
  const holdVideo2End = phase === 'comparison' || fadingComparison;
  const scrubbing = scrubbingZoom || phase === 'retreat' || phase === 'orbit' || phase === 'comparison';
  const zoomRatio = zoomProgress(phase, progress);

  // Spatial-sound (video-4): stay fully visible while playing the full file.
  // Only fade after native `ended` (or during the ambience black beat).
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
  const playing = Boolean(
    active && visible && !scrubbing && !scrubbingZoom && !inAmbience && phase !== 'finale'
    && !(index === 0 && video1Ended)
    && (!reduced || manual),
  );
  desired.current = { index, timeSec: 0, scrubbing: scrubbing && !holdVideo2End && !scrubbingZoom };

  function ready(i: number) {
    const el = videos.current[i];
    const target = desired.current;
    if (!el || target.index !== i || el.seeking || el.readyState < 2) return;
    setDisplay(i);
  }

  useEffect(() => {
    if (phase !== 'feature') featureSeekDone.current = false;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'finale') {
      finalePlayArmed.current = false;
      setVideo4Ended(false);
    }
  }, [phase]);

  useEffect(() => {
    // Only clear arm after the play-through finished (or never started).
    // Leaving the sticky mid-play must not interrupt the ~5s file.
    if (!inAmbience && ambienceEnded) {
      ambiencePlayArmed.current = false;
      setAmbienceEnded(false);
    }
  }, [inAmbience, ambienceEnded]);

  // Scroll-scrub Figma 12:464 zoom.mp4 during reveal→zoom.
  useEffect(() => {
    const el = zoomRef.current;
    if (!el || !scrubbingZoom) return;
    if (el.preload !== 'auto') el.preload = 'auto';
    el.pause();
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    if (reduced) {
      el.currentTime = Math.max(0, el.duration - 1 / 24);
      setZoomReady(true);
      return;
    }
    const target = clamp(zoomRatio * el.duration, 0, Math.max(0, el.duration - 1 / 24));
    if (!el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
    setZoomReady(el.readyState >= 2);
  });

  // Ambience (Figma 34:547 Video 2): on scroll enter after black, play start→end once (not scrubbed).
  // After arm, continues to native `ended` without needing more scroll.
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
      // Arm once from t=0; never jump to the end before `ended`.
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
      // Stay in-view sticky: if briefly inactive, pause but do not seek forward.
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

  useEffect(() => {
    if (!active || document.hidden) {
      videos.current.forEach(el => el?.pause());
      zoomRef.current?.pause();
      // Do not pause an armed ambience play-through when sticky unpins.
      if (!ambiencePlayArmed.current || ambienceEnded) ambienceRef.current?.pause();
      else if (document.hidden) ambienceRef.current?.pause();
      return;
    }
    if (scrubbingZoom || phase === 'finale' || inAmbience) {
      if (scrubbingZoom || inAmbience) videos.current.forEach((el, i) => { if (!(holdSoundStill && i === 3)) el?.pause(); });
      return;
    }
    videos.current.forEach((el, i) => {
      if (!el) return;
      if ((Math.abs(i - index) <= 1 || i === 3) && el.preload !== 'auto') el.preload = 'auto';
      el.playbackRate = i === 0 ? config.playback.video1Rate : 1;
      if (i !== index || !playing) el.pause();
    });
    const el = videos.current[index];
    if (!el || errors[index]) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;

    let target = el.currentTime;
    if (holdVideo2End) {
      target = Math.max(0, el.duration - 1 / 24);
    } else if (phase === 'feature' && index === 0 && !featureSeekDone.current) {
      target = config.driveEndRatio * el.duration;
      featureSeekDone.current = true;
    } else if (phase === 'retreat' || phase === 'orbit') {
      const normalized = holdVideo2End ? 1 : phase === 'orbit'
        ? clamp((progress - config.text.leaveEnd) / (1 - config.text.leaveEnd))
        : progress;
      target = clamp(normalized * el.duration, 0, Math.max(0, el.duration - 1 / 24));
    }

    const needsSeek = holdVideo2End
      || ((phase === 'retreat' || phase === 'orbit') && !reduced)
      || (phase === 'feature' && index === 0 && Math.abs(el.currentTime - target) > 0.2 && el.currentTime < config.driveEndRatio * el.duration);
    if (needsSeek && !el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
    if (holdVideo2End) {
      el.pause();
      setDisplay(index);
    }
    if (playing && el.paused && !playPending.current.has(index)) {
      playPending.current.add(index);
      el.play().then(() => setAutoplayBlocked(false)).catch(err => {
        if (err.name !== 'AbortError') setAutoplayBlocked(true);
      }).finally(() => playPending.current.delete(index));
    }
    ready(index);
  });

  // Keep faded sound still parked on end during black beat.
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
        zoomRef.current?.pause();
        ambienceRef.current?.pause();
      }
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      videos.current.forEach(el => el?.pause());
      zoomRef.current?.pause();
      ambienceRef.current?.pause();
    };
  }, []);
  useEffect(() => { setManual(false); }, [index, active, scrubbingZoom, inAmbience, phase]);
  useEffect(() => {
    if (!active) setVideo1Ended(false);
  }, [active]);

  const still = reduced && !manual;
  const fallback = scrubbingZoom
    ? (reduced || zoomRatio > 0.95 ? config.zoomMedia.end : config.zoomMedia.poster)
    : inAmbience
      ? (ambienceEnded || reduced ? config.ambienceMedia.end : config.ambienceMedia.poster)
      : config.media[holdSoundStill || phase === 'finale' ? 3 : index][holdVideo2End || holdSoundStill || (phase === 'finale' && video4Ended) ? 'end' : 'poster'];
  const showZoom = scrubbingZoom && !zoomError && !(reduced && still);
  const showAmbience = ambiencePlayingPhase && ambienceFade > 0.01 && !ambienceError && !(reduced && still);
  const showSound = (phase === 'finale' || holdSoundStill) && soundFade > 0.01 && !scrubbingZoom;
  const showFeature = !scrubbingZoom && !inAmbience && phase !== 'finale';

  return <div
    className="media-stage"
    style={{ '--media-crossfade': `${config.playback.crossfadeMs}ms` } as CSSProperties}
    data-media-index={scrubbingZoom ? 'zoom' : inAmbience ? 'ambience' : (phase === 'finale' || holdSoundStill ? 4 : index + 1)}
    data-mode={
      scrubbingZoom ? 'scroll-zoom'
        : ambiencePlayingPhase ? (playingAmbience ? 'play-ambience' : 'still-ambience')
          : phase === 'finale' ? (playingFinale ? 'play' : 'still')
            : scrubbing ? 'scroll'
              : playing ? 'play'
                : 'still'
    }
    data-testid="tv-drive"
    data-zoom-ratio={scrubbingZoom ? zoomRatio.toFixed(3) : undefined}
  >
    <img className="media-fallback" src={fallback} alt="Телевизор Sber TV" />
    <video
      ref={zoomRef}
      data-testid="video-zoom"
      src={config.zoomMedia.src}
      poster={config.zoomMedia.poster}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      className={showZoom && zoomReady && !still ? 'visible' : ''}
      onLoadedData={() => setZoomReady(true)}
      onCanPlay={() => setZoomReady(true)}
      onSeeked={() => setZoomReady(true)}
      onError={() => setZoomError(true)}
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
    {config.media.map((media, i) => <video key={media.src} ref={el => { videos.current[i] = el; }}
      data-testid={`video-${i + 1}`} src={media.src} poster={media.poster} muted playsInline
      preload={i === 0 || i === 3 ? 'auto' : 'metadata'}
      loop={i === 0 ? config.playback.loopVideo1 : false}
      aria-hidden="true"
      style={i === 3 && showSound ? { opacity: soundFade } : undefined}
      className={
        ((showFeature && display === i) || (showSound && i === 3 && display === 3))
        && !still && !errors[i] ? 'visible' : ''
      }
      onLoadedData={() => ready(i)} onCanPlay={() => ready(i)}
      onLoadedMetadata={() => setErrors(old => ({ ...old }))}
      onSeeked={() => { ready(i); setErrors(old => ({ ...old })); }}
      onEnded={() => {
        if (i === 3) {
          // Full file finished — only now mark ended (no preemptive seek).
          videos.current[3]?.pause();
          setVideo4Ended(true);
          setDisplay(3);
          return;
        }
        if (i !== 0) return;
        const el = videos.current[0];
        if (el && Number.isFinite(el.duration)) el.currentTime = Math.max(0, el.duration - 1 / 24);
        el?.pause();
        setVideo1Ended(true);
        setDisplay(0);
      }}
      onError={() => setErrors(old => ({ ...old, [i]: true }))} />)}
    {(still || (scrubbingZoom ? zoomError : inAmbience ? ambienceError : errors[phase === 'finale' || holdSoundStill ? 3 : index])) && (
      <img className="media-still" src={fallback} alt="Телевизор Sber TV" />
    )}
    {!scrubbingZoom && !inAmbience && phase !== 'finale' && errors[index] && <div role="alert" className="media-message">Не удалось загрузить видео. Показан статичный кадр.<button onClick={() => { setErrors(old => ({ ...old, [index]: false })); videos.current[index]?.load(); }}>Повторить</button></div>}
    {active && ((showFeature && !scrubbing) || (phase === 'finale' && !playingFinale) || (ambiencePlayingPhase && !playingAmbience)) && (reduced || autoplayBlocked) && (
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
            return;
          }
          const el = videos.current[index];
          if (manual) { el?.pause(); setManual(false); }
          else {
            setManual(true);
            el?.play().then(() => { setAutoplayBlocked(false); ready(index); }).catch(() => setAutoplayBlocked(true));
          }
        }}>{manual ? 'Пауза' : 'Воспроизвести видео'}<span aria-hidden="true">{manual ? 'Ⅱ' : '▷'}</span></button>
    )}
  </div>;
}
