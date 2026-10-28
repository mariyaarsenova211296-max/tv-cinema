import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { config, clamp, driveHeadProgress } from './config';
import type { Phase } from './config';

export function MediaStage({ phase, progress, active, reduced }: { phase: Phase; progress: number; active: boolean; reduced: boolean }) {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const desired = useRef({ index: 0, timeSec: 0, scrubbing: false });
  const playPending = useRef(new Set<number>());
  const featureSeekDone = useRef(false);
  const [display, setDisplay] = useState(-1);
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [manual, setManual] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [video1Ended, setVideo1Ended] = useState(false);

  const fadingComparison = phase === 'orbit' && progress <= config.text.leaveEnd;
  const index = phase === 'retreat' || phase === 'comparison' || fadingComparison ? 1 : phase === 'orbit' ? 2 : phase === 'finale' ? 3 : 0;
  const holdVideo2End = phase === 'comparison' || fadingComparison;
  const scrubbingDrive = phase === 'reveal' || phase === 'zoom';
  const scrubbing = scrubbingDrive || phase === 'retreat' || phase === 'orbit' || phase === 'comparison';

  // Absolute time targets for video-1 drive head (ratio of full duration).
  const driveHeadRatio = config.driveEndRatio * driveHeadProgress(phase, progress);

  const playing = Boolean(
    active && visible && !scrubbing
    && !(index === 0 && video1Ended)
    && (!reduced || manual),
  );
  desired.current = { index, timeSec: 0, scrubbing: scrubbing && !holdVideo2End };

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
    if (!active || document.hidden) {
      videos.current.forEach(el => el?.pause());
      return;
    }
    videos.current.forEach((el, i) => {
      if (!el) return;
      if ((Math.abs(i - index) <= 1 || i === 3) && el.preload !== 'auto') {
        el.preload = 'auto';
        el.load();
      }
      el.playbackRate = i === 0 ? config.playback.video1Rate : 1;
      if (i !== index || !playing) el.pause();
    });
    const el = videos.current[index];
    if (!el || errors[index]) return;
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;

    let target = el.currentTime;
    if (holdVideo2End) {
      target = Math.max(0, el.duration - 1 / 24);
    } else if (scrubbingDrive && index === 0) {
      target = clamp(driveHeadRatio * el.duration, 0, Math.max(0, el.duration - 1 / 24));
    } else if (phase === 'feature' && index === 0 && !featureSeekDone.current) {
      target = config.driveEndRatio * el.duration;
      featureSeekDone.current = true;
    } else if (phase === 'retreat' || phase === 'orbit') {
      const normalized = holdVideo2End ? 1 : phase === 'orbit'
        ? clamp((progress - config.text.leaveEnd) / (1 - config.text.leaveEnd))
        : progress;
      target = clamp(normalized * el.duration, 0, Math.max(0, el.duration - 1 / 24));
    }

    const needsSeek = holdVideo2End || scrubbingDrive
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

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) videos.current.forEach(el => el?.pause());
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); videos.current.forEach(el => el?.pause()); };
  }, []);
  useEffect(() => { setManual(false); }, [index, active]);
  useEffect(() => {
    if (!active) setVideo1Ended(false);
  }, [active]);

  const finaleArmed = useRef(false);
  useEffect(() => {
    if (phase !== 'finale') {
      finaleArmed.current = false;
      return;
    }
    if (finaleArmed.current) return;
    const el = videos.current[3];
    if (!el) return;
    const arm = () => {
      if (!Number.isFinite(el.duration)) return;
      el.pause();
      el.currentTime = 0;
      finaleArmed.current = true;
      setDisplay(3);
    };
    if (el.readyState >= 2) arm();
    else el.addEventListener('loadeddata', arm, { once: true });
  }, [phase]);

  const still = reduced && !manual;
  const fallback = config.media[index][holdVideo2End ? 'end' : 'poster'];
  return <div
    className="media-stage"
    style={{ '--media-crossfade': `${config.playback.crossfadeMs}ms` } as CSSProperties}
    data-media-index={index + 1}
    data-mode={scrubbing ? 'scroll' : playing ? 'play' : 'still'}
    data-testid="tv-drive"
    data-drive-ratio={scrubbingDrive ? driveHeadRatio.toFixed(3) : undefined}
  >
    <img className="media-fallback" src={fallback} alt="Телевизор Sber TV" />
    {config.media.map((media, i) => <video key={media.src} ref={el => { videos.current[i] = el; }}
      data-testid={`video-${i + 1}`} src={media.src} poster={media.poster} muted playsInline
      preload={i === 0 || i === 3 ? 'auto' : 'metadata'}
      loop={i === 0 ? config.playback.loopVideo1 : i === 3 ? config.playback.loopVideo4 : false}
      aria-hidden="true" className={display === i && !still && !errors[i] ? 'visible' : ''}
      onLoadedData={() => ready(i)} onCanPlay={() => ready(i)}
      onLoadedMetadata={() => setErrors(old => ({ ...old }))}
      onSeeked={() => { ready(i); setErrors(old => ({ ...old })); }}
      onEnded={() => {
        if (i !== 0) return;
        const el = videos.current[0];
        if (el && Number.isFinite(el.duration)) el.currentTime = Math.max(0, el.duration - 1 / 24);
        el?.pause();
        setVideo1Ended(true);
        setDisplay(0);
      }}
      onError={() => setErrors(old => ({ ...old, [i]: true }))} />)}
    {(still || errors[index]) && <img className="media-still" src={fallback} alt="Телевизор Sber TV" />}
    {errors[index] && <div role="alert" className="media-message">Не удалось загрузить видео. Показан статичный кадр.<button onClick={() => { setErrors(old => ({ ...old, [index]: false })); videos.current[index]?.load(); }}>Повторить</button></div>}
    {active && !scrubbing && (reduced || autoplayBlocked) && <button className="manual-play" aria-pressed={manual}
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
