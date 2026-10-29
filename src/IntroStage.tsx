import { useEffect, useRef, useState } from 'react';
import { config } from './config';

/**
 * Hero — Figma 102:14254 / video 102:19080.
 * PLAY full clip; copy unlocks near end. Exact type from Figma:
 *   «Первый» Regular 36 / «кинотеатр» Medium 100 / «с интеллектом» Regular 36
 *   tracking −5% / −1.8px side lines.
 */
export function IntroStage({ reduced }: { reduced: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced) {
      setShowCopy(true);
      setEnded(true);
      return;
    }
    let cancelled = false;

    const start = () => {
      if (cancelled || !el) return;
      try {
        if (el.currentTime !== 0) el.currentTime = 0;
      } catch { /* ignore */ }
      el.play().catch(() => { /* autoplay blocked — keep video visible */ });
    };

    const onTime = () => {
      if (cancelled) return;
      // Unlock copy in last ~0.3s or after 3.7s of ~4s hero.
      if (el.currentTime >= 3.7) setShowCopy(true);
    };

    if (el.readyState >= 1) start();
    else el.addEventListener('loadedmetadata', start, { once: true });
    el.addEventListener('timeupdate', onTime);

    return () => {
      cancelled = true;
      el.pause();
      el.removeEventListener('timeupdate', onTime);
    };
  }, [reduced]);

  const copyIn = showCopy || reduced;

  return (
    <section
      id="scene-1"
      className="intro"
      aria-label="Экран 1"
      data-node-id="102:14254"
      data-video-node="102:19080"
      data-mode="PLAY"
    >
      <div className="intro-stage">
        <div className="intro-media" data-testid="intro-media">
          {!failed && !reduced && (
            <video
              ref={videoRef}
              className={`intro-video${ended ? ' is-ended' : ''}`}
              src={config.heroMedia.src}
              poster={config.heroMedia.poster}
              muted
              playsInline
              preload="auto"
              data-testid="intro-video"
              onEnded={() => {
                setEnded(true);
                setShowCopy(true);
              }}
              onError={() => {
                setFailed(true);
                setEnded(true);
                setShowCopy(true);
              }}
            />
          )}
          <img
            className={`intro-still${ended || failed || reduced ? ' is-visible' : ''}`}
            src={config.heroMedia.end}
            alt=""
            draggable={false}
          />
          <div
            className={`intro-copy${copyIn ? ' is-in' : ''}`}
            data-node-id="102:14257"
            aria-hidden={!copyIn || undefined}
          >
            <p className="intro-copy__left">Первый</p>
            <h1 className="intro-copy__title">кинотеатр</h1>
            <p className="intro-copy__right">с интеллектом</p>
          </div>
        </div>
      </div>
    </section>
  );
}
