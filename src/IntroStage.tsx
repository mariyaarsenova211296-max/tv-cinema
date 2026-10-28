import { useEffect, useRef, useState } from 'react';
import { asset } from './base';

/**
 * Screen 1 — Figma 17:529 video (play once) + 17:467 text overlay on end frame.
 * Soft Shopify-like text entrance; placement/sizes from Figma 17:467 (1440×810).
 */
export function IntroStage({ reduced }: { reduced: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced) {
      setEnded(true);
      return;
    }
    el.play().catch(() => setEnded(true));
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
            onEnded={() => {
              const el = videoRef.current;
              if (el && Number.isFinite(el.duration)) {
                el.currentTime = Math.max(0, el.duration - 1 / 24);
                el.pause();
              }
              setEnded(true);
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
