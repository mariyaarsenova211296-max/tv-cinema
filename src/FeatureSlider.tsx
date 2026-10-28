import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Design } from './config';

/** Figma Component 554 (12:457) — 1440×854 frame over walking-cat video. */
const DESIGN_W = 1440;
const DESIGN_H = 854;

/**
 * Screen 4 overlay — Miniled / RGB-miniled labels + divider with end-caps.
 * Video keeps playing underneath; no dual-image mask.
 */
export function FeatureSlider({
  design,
  interactive,
}: {
  design: Design;
  interactive: boolean;
}) {
  const [value, setValue] = useState(50);
  const [coverScale, setCoverScale] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const labels = design.comparisonLabels ?? { mini: 'Miniled', rgb: 'RGB-miniled' };

  useEffect(() => {
    const apply = () => {
      const sticky = rootRef.current?.closest('.stage-sticky') as HTMLElement | null
        ?? document.querySelector('.stage-sticky');
      const sw = sticky?.clientWidth || window.innerWidth;
      const sh = sticky?.clientHeight || window.innerHeight;
      const widthFit = sw / DESIGN_W;
      const heightFit = sh / DESIGN_H;
      setCoverScale(sw >= DESIGN_W ? Math.max(widthFit, heightFit) : widthFit);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  function moveLine(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    setValue(Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))));
  }

  return (
    <div
      ref={rootRef}
      className="feature-slider"
      data-testid="feature-slider"
      data-node-id="12:457"
      style={{ '--split': `${value}%`, '--fs-scale': String(coverScale) } as CSSProperties}
    >
      <div className="feature-slider__stage">
        <div
          className="feature-slider__hit"
          data-testid="feature-slider-hit"
          inert={!interactive || undefined}
          onDragStart={e => e.preventDefault()}
          onPointerDown={e => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            moveLine(e);
          }}
          onPointerMove={moveLine}
          onPointerUp={e => { e.currentTarget.releasePointerCapture(e.pointerId); }}
        >
          <div className="feature-slider__divider" aria-hidden="true" />
          <span className="feature-slider__label feature-slider__label--mini">{labels.mini}</span>
          <span className="feature-slider__label feature-slider__label--rgb">{labels.rgb}</span>
        </div>
      </div>

      <div className="comparison-a11y">
        <label className="sr-only" htmlFor={hintId}>Граница сравнения {labels.mini} и {labels.rgb}</label>
        <input
          id={hintId}
          type="range"
          min="0"
          max="100"
          step="1"
          value={value}
          disabled={!interactive}
          aria-label={`Граница сравнения ${labels.mini} и ${labels.rgb}`}
          aria-valuetext={`${value}% ${labels.mini}`}
          onChange={e => setValue(Number(e.target.value))}
          onPointerDown={e => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
