import { useEffect, useRef, useState } from 'react';
import { asset } from './base';

/**
 * Screen 1 — Figma 34:547 Video 1 (1920×1080 ~4.04s).
 * Full 16:9 composition via contain (no crop/zoom). Copy unlocks only when
 * currentTime >= 4.0 or native `ended`. No «серия 9000».
 */
export function IntroStage({ reduced }: { reduced: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [metaDuration, setMetaDuration] = useState<number | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced) {
      setShowCopy(true);
      setEnded(true);
      return;
    }
    let cancelled = false;

    const startFromZero = () => {
      if (cancelled || !el) return;
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setMetaDuration(el.duration);
      }
      try {
        if (el.currentTime !== 0) el.currentTime = 0;
      } catch { /* ignore seek before metadata */ }
      el.play().catch(() => {
        // Autoplay blocked: keep video visible; do NOT fake copy unlock.
      });
    };

    const onLoadedMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setMetaDuration(el.duration);
      startFromZero();
    };

    const onTimeUpdate = () => {
      if (cancelled) return;
      if (el.currentTime >= 4.0) setShowCopy(true);
    };

    if (el.readyState >= 1) onLoadedMeta();
    else el.addEventListener('loadedmetadata', onLoadedMeta, { once: true });
    el.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      cancelled = true;
      el.pause();
      el.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [reduced]);

  const copyIn = showCopy || reduced;

  return (
    <section id="scene-1" className="intro" aria-label="Экран 1" data-node-id="17:529">
      <div className="intro-stage">
        {/* 16:9 media plane — text coords are % of this box, not the viewport */}
        <div className="intro-media" data-testid="intro-media">
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
              onEnded={() => {
                setEnded(true);
                setShowCopy(true);
              }}
              onError={() => { setFailed(true); setEnded(true); setShowCopy(true); }}
            />
          )}
          <img
            className={`intro-still${ended || failed || reduced ? ' is-visible' : ''}`}
            src={asset('media/intro-end.jpg')}
            alt=""
            draggable={false}
          />
          <div
            className={`intro-copy${copyIn ? ' is-in' : ''}`}
            data-node-id="17:467"
            aria-hidden={!copyIn || undefined}
          >
            <p className="intro-copy__left-top">огромный</p>
            <p className="intro-copy__left-bottom">Первый</p>
            <h1 className="intro-copy__title">кинотеатр</h1>
            <p className="intro-copy__right">с интеллектом</p>
          </div>
        </div>
      </div>
    </section>
  );
}
