import { useEffect, useRef, useState } from 'react';
import { asset } from './base';

/**
 * Screen 1 — Figma 34:547 Video 1 play-once for the full file duration.
 * Never ends early via timeout/seek/still swap — only native `ended` unlocks the end still + copy.
 */
export function IntroStage({ reduced }: { reduced: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [metaDuration, setMetaDuration] = useState<number | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced) {
      setEnded(true);
      return;
    }
    let cancelled = false;

    const startFromZero = () => {
      if (cancelled || !el) return;
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setMetaDuration(el.duration);
      }
      // Do not clamp or seek toward the end — play the whole file.
      try {
        if (el.currentTime !== 0) el.currentTime = 0;
      } catch { /* ignore seek before metadata */ }
      el.play().catch(() => {
        // Autoplay blocked: keep the video element visible; do NOT fake `ended`.
      });
    };

    const onLoadedMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setMetaDuration(el.duration);
      startFromZero();
    };

    if (el.readyState >= 1) onLoadedMeta();
    else el.addEventListener('loadedmetadata', onLoadedMeta, { once: true });

    return () => {
      cancelled = true;
      el.pause();
    };
  }, [reduced]);

  return (
    <section id="scene-1" className="intro" aria-label="Экран 1" data-node-id="17:529">
      <div className="intro-stage">
        {!failed && !reduced && (
          <video
            ref={videoRef}
            className={`intro-video${ended ? ' is-ended' : ''}`}
            src={asset('media/intro.mp4')}
            poster={asset('media/intro-start.jpg')}
            muted
            playsInline
            preload="auto"
            data-testid="intro-video"
            data-meta-duration={metaDuration != null ? metaDuration.toFixed(3) : undefined}
            // Full-file playback only — no scroll binding, no early still swap.
            // Copy unlocks only after native `ended` near the real ~4.04s duration.
            onEnded={() => {
              const el = videoRef.current;
              const d = el?.duration ?? 0;
              const t = el?.currentTime ?? 0;
              if (d >= 3.9 && t >= d - 0.35) setEnded(true);
              else if (d >= 3.9) setEnded(true);
            }}
            onError={() => { setFailed(true); setEnded(true); }}
          />
        )}
        <img
          className={`intro-still${ended || failed || reduced ? ' is-visible' : ''}`}
          src={asset('media/intro-end.jpg')}
          alt=""
          draggable={false}
        />
        <div
          className={`intro-copy${ended || reduced ? ' is-in' : ''}`}
          data-node-id="17:467"
          aria-hidden={!(ended || reduced) || undefined}
        >
          <p className="intro-copy__left-top">огромный</p>
          <p className="intro-copy__left-bottom">Первый</p>
          <h1 className="intro-copy__title">кинотеатр</h1>
          <p className="intro-copy__right">с интеллектом</p>
          <p className="intro-copy__series">серия 9000</p>
        </div>
      </div>
    </section>
  );
}
