import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { config, clamp, zoomProgress, ambienceVideoProgress, smooth } from './config';
import type { Phase } from './config';

export function MediaStage({ phase, progress, active, reduced }: { phase: Phase; progress: number; active: boolean; reduced: boolean }) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const zoomRef = useRef<HTMLVideoElement | null>(null);
  const ambienceRef = useRef<HTMLVideoElement | null>(null);
  const desired = useRef({ index: 0, timeSec: 0, scrubbing: false });
  const playPending = useRef(new Set<number>());
  const featureSeekDone = useRef(false);
  const [display, setDisplay] = useState(-1);
  const [zoomReady, setZoomReady] = useState(false);
  const [ambienceReady, setAmbienceReady] = useState(false);
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [zoomError, setZoomError] = useState(false);
  const [ambienceError, setAmbienceError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [video1Ended, setVideo1Ended] = useState(false);

  const fadingComparison = phase === 'orbit' && progress <= config.text.leaveEnd;
  const scrubbingZoom = phase === 'reveal' || phase === 'zoom';
  const scrubbingAmbience = phase === 'ambience';
  const holdFinaleEnd = phase === 'finale' || (phase === 'ambience' && progress < config.ambience.blackEnd);
  const index = scrubbingZoom || scrubbingAmbience
    ? 0
    : phase === 'retreat' || phase === 'comparison' || fadingComparison ? 1
      : phase === 'orbit' ? 2
        : phase === 'finale' ? 3
          : 0;
  const holdVideo2End = phase === 'comparison' || fadingComparison;
  const scrubbing = scrubbingZoom || scrubbingAmbience || phase === 'retreat' || phase === 'orbit' || phase === 'comparison' || holdFinaleEnd;
  const zoomRatio = zoomProgress(phase, progress);
  const ambienceRatio = ambienceVideoProgress(progress);

  // Spatial-sound (video-4) fades to black at end of finale / start of ambience.
  const soundFade =
    phase === 'finale'
      ? (progress > 0.72 ? 1 - smooth((progress - 0.72) / 0.28) : 1)
      : phase === 'ambience' && progress < config.ambience.blackEnd
        ? 1 - smooth(progress / config.ambience.blackEnd)
        : 0;
  const ambienceFade =
    phase === 'ambience'
      ? (progress <= config.ambience.blackEnd
        ? 0
        : smooth((progress - config.ambience.blackEnd) / Math.max(0.001, config.ambience.videoIn - config.ambience.blackEnd)))
      : 0;

  const playing = Boolean(
    active && visible && !scrubbing && !scrubbingZoom && !scrubbingAmbience && !holdFinaleEnd
    && !(index === 0 && video1Ended)
    && (!reduced || manual),
  );
  desired.current = { index, timeSec: 0, scrubbing: scrubbing && !holdVideo2End && !scrubbingZoom && !scrubbingAmbience && !holdFinaleEnd };

  function ready(i: number) {
    const el = videos.current[i];
    const target = desired.current;
    if (!el || target.index !== i || el.seeking || el.readyState < 2) return;
    setDisplay(i);
  }

  useEffect(() => {
    if (phase !== 'feature') featureSeekDone.current = false;
  }, [phase]);

  // Scroll-scrub Figma 12:464 zoom.mp4 during reveal→zoom.
  useEffect(() => {
    const el = zoomRef.current;
    if (!el || !scrubbingZoom) return;
    if (el.preload !== 'auto') {
      el.preload = 'auto';
      el.load();
    }
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

  // Scroll-scrub Figma 28:540 ambience after black beat.
  useEffect(() => {
    const el = ambienceRef.current;
    if (!el || !scrubbingAmbience) return;
    if (el.preload !== 'auto') {
      el.preload = 'auto';
      el.load();
    }
    el.pause();
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    if (reduced || progress <= config.ambience.blackEnd) {
      el.currentTime = 0;
      setAmbienceReady(true);
      return;
    }
    const target = clamp(ambienceRatio * el.duration, 0, Math.max(0, el.duration - 1 / 24));
    if (!el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
    setAmbienceReady(el.readyState >= 2);
  });

  useEffect(() => {
    if (!active || document.hidden) {
      videos.current.forEach(el => el?.pause());
      zoomRef.current?.pause();
      ambienceRef.current?.pause();
      return;
    }
    if (scrubbingZoom || scrubbingAmbience) {
      videos.current.forEach(el => el?.pause());
      return;
    }
    videos.current.forEach((el, i) => {
      if (!el) return;
      if ((Math.abs(i - index) <= 1 || i === 3) && el.preload !== 'auto') {
        el.preload = 'auto';
        // Avoid el.load() — aborts in-flight buffers.
      }
      el.playbackRate = i === 0 ? config.playback.video1Rate : 1;
      if (i !== index || !playing) el.pause();
    });
    const el = videos.current[index];
    if (!el || errors[index]) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;

    let target = el.currentTime;
    if (holdVideo2End || holdFinaleEnd) {
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

    const needsSeek = holdVideo2End || holdFinaleEnd
      || ((phase === 'retreat' || phase === 'orbit') && !reduced)
      || (phase === 'feature' && index === 0 && Math.abs(el.currentTime - target) > 0.2 && el.currentTime < config.driveEndRatio * el.duration);
    if (needsSeek && !el.seeking && Math.abs(el.currentTime - target) > config.playback.seekTolerance) {
      el.currentTime = target;
    }
    if (holdVideo2End || holdFinaleEnd) {
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
  useEffect(() => { setManual(false); }, [index, active, scrubbingZoom, scrubbingAmbience]);
  useEffect(() => {
    if (!active) setVideo1Ended(false);
  }, [active]);

  const finaleArmed = useRef(false);
  useEffect(() => {
    if (phase !== 'finale' && !(phase === 'ambience' && progress < config.ambience.blackEnd)) {
      finaleArmed.current = false;
      return;
    }
    if (finaleArmed.current) return;
    const el = videos.current[3];
    if (!el) return;
    const arm = () => {
      if (!Number.isFinite(el.duration)) return;
      el.pause();
      el.currentTime = Math.max(0, el.duration - 1 / 24);
      finaleArmed.current = true;
      setDisplay(3);
    };
    if (el.readyState >= 2) arm();
    else el.addEventListener('loadeddata', arm, { once: true });
  }, [phase, progress]);

  const still = reduced && !manual;
  const fallback = scrubbingZoom
    ? (reduced || zoomRatio > 0.95 ? config.zoomMedia.end : config.zoomMedia.poster)
    : scrubbingAmbience
      ? (ambienceRatio > 0.7 ? config.ambienceMedia.end : config.ambienceMedia.poster)
      : config.media[holdFinaleEnd ? 3 : index][holdVideo2End || holdFinaleEnd ? 'end' : 'poster'];
  const showZoom = scrubbingZoom && !zoomError && !(reduced && still);
  const showAmbience = scrubbingAmbience && ambienceFade > 0.01 && !ambienceError && !(reduced && still);
  const showSoundHold = (phase === 'finale' || (phase === 'ambience' && soundFade > 0.01)) && !scrubbingZoom;
  const showFeature = !scrubbingZoom && !scrubbingAmbience && !holdFinaleEnd;

  return <div
    className="media-stage"
    style={{ '--media-crossfade': `${config.playback.crossfadeMs}ms` } as CSSProperties}
    data-media-index={scrubbingZoom ? 'zoom' : scrubbingAmbience ? 'ambience' : (holdFinaleEnd ? 4 : index + 1)}
    data-mode={scrubbingZoom ? 'scroll-zoom' : scrubbingAmbience ? 'scroll-ambience' : scrubbing ? 'scroll' : playing ? 'play' : 'still'}
    data-testid="tv-drive"
    data-zoom-ratio={scrubbingZoom ? zoomRatio.toFixed(3) : undefined}
    data-ambience-ratio={scrubbingAmbience ? ambienceRatio.toFixed(3) : undefined}
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
      onSeeked={() => setAmbienceReady(true)}
      onError={() => setAmbienceError(true)}
    />
    {config.media.map((media, i) => <video key={media.src} ref={el => { videos.current[i] = el; }}
      data-testid={`video-${i + 1}`} src={media.src} poster={media.poster} muted playsInline
      preload={i === 0 || i === 3 ? 'auto' : 'metadata'}
      loop={i === 0 ? config.playback.loopVideo1 : false}
      aria-hidden="true"
      style={i === 3 && showSoundHold ? { opacity: soundFade } : undefined}
      className={
        ((showFeature && display === i) || (showSoundHold && i === 3 && display === 3))
        && !still && !errors[i] ? 'visible' : ''
      }
      onLoadedData={() => ready(i)} onCanPlay={() => ready(i)}
      onLoadedMetadata={() => setErrors(old => ({ ...old }))}
      onSeeked={() => { ready(i); setErrors(old => ({ ...old })); }}
      onEnded={() => {
        if (i === 3) {
          const el = videos.current[3];
          if (el && Number.isFinite(el.duration)) el.currentTime = Math.max(0, el.duration - 1 / 24);
          el?.pause();
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
    {(still || (scrubbingZoom ? zoomError : scrubbingAmbience ? ambienceError : errors[holdFinaleEnd ? 3 : index])) && (
      <img className="media-still" src={fallback} alt="Телевизор Sber TV" />
    )}
    {!scrubbingZoom && !scrubbingAmbience && errors[index] && <div role="alert" className="media-message">Не удалось загрузить видео. Показан статичный кадр.<button onClick={() => { setErrors(old => ({ ...old, [index]: false })); videos.current[index]?.load(); }}>Повторить</button></div>}
    {active && showFeature && !scrubbing && (reduced || autoplayBlocked) && <button className="manual-play" aria-pressed={manual}
      onClick={() => {
        const el = videos.current[index];
        if (manual) { el?.pause(); setManual(false); }
        else {
          setManual(true);
          el?.play().then(() => { setAutoplayBlocked(false); ready(index); }).catch(() => setAutoplayBlocked(true));
        }
      }}>{manual ? 'Пауза' : 'Воспроизвести видео'}<span aria-hidden="true">{manual ? 'Ⅱ' : '▷'}</span></button>}
  </div>;
}
