import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { asset } from './base';
import type { Design } from './config';

/** Figma Component 551 (2:321) design width. */
const DESIGN_W = 1440;

/**
 * Screen 5 — Figma Component 551 (2:321), 1440×854.
 * Dual-image mask lives only inside the clipped TV screen rect so the divider
 * never covers the cat or bezel.
 */
export function Comparison({ design, interactive }: { design: Design; width?: number; height?: number; interactive: boolean }) {
  const [value, setValue] = useState(50);
  const [failed, setFailed] = useState(false);
  const [coverScale, setCoverScale] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const sources = design.comparison;
  const labels = design.comparisonLabels ?? { mini: 'Miniled', rgb: 'RGB-miniled' };
  const valid = Boolean(sources) && !failed;
  const env = asset('assets/comparison/tv-env.png');
  const envWide = asset('assets/comparison/tv-env-wide.png');
  const cat = asset('assets/comparison/cat.png');
  const divider = asset('assets/comparison/divider.svg');

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = () => {
      // Prefer layout box (offset*) so html zoom from useDesignScale is not applied twice.
      // Scale from width so the 1440 composition is full-bleed horizontally (no side bars);
      // short/tall viewports crop or letterbox vertically while keeping Figma proportions.
      const width = el.offsetWidth || el.getBoundingClientRect().width;
      if (!width) return;
      setCoverScale(width / DESIGN_W);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); };
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
      className="comparison comparison--figma"
      data-testid="comparison"
      data-node-id="2:321"
      style={{ '--split': `${value}%`, '--cmp-scale': String(coverScale) } as CSSProperties}
    >
      <div className="comparison-stage" data-testid="comparison-stage">
        <div className="comparison-env" aria-hidden="true">
          <img className="comparison-env__wide" src={envWide} alt="" draggable={false} />
          <img className="comparison-env__main" src={env} alt="" draggable={false} />
          <div className="comparison-env__glow comparison-env__glow--left" />
          <div className="comparison-env__glow comparison-env__glow--right" />
        </div>

        {valid && sources && (
          <div
            className="comparison-screen"
            data-testid="comparison-screen"
            inert={!interactive || undefined}
            onDragStart={e => e.preventDefault()}
            onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); moveLine(e); }}
            onPointerMove={moveLine}
            onPointerUp={e => { e.currentTarget.releasePointerCapture(e.pointerId); }}
          >
            <div className="comparison-plane" data-testid="comparison-plane">
              <img
                className="comparison-plane__rgb"
                draggable={false}
                src={sources.rgb}
                alt=""
                onError={() => setFailed(true)}
              />
              <img
                className="mini-image"
                draggable={false}
                src={sources.mini}
                alt=""
                onError={() => setFailed(true)}
              />
              <div className="image-divider" aria-hidden="true">
                <img src={divider} alt="" draggable={false} />
              </div>
              <span className="screen-label screen-label--mini">{labels.mini}</span>
              <span className="screen-label screen-label--rgb">{labels.rgb}</span>
            </div>
          </div>
        )}

        <img className="comparison-cat" src={cat} alt="" draggable={false} aria-hidden="true" />
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
          disabled={!interactive || !valid}
          aria-label={`Граница сравнения ${labels.mini} и ${labels.rgb}`}
          aria-valuetext={`${value}% ${labels.mini}`}
          onChange={e => setValue(Number(e.target.value))}
          onPointerDown={e => e.stopPropagation()}
        />
        {!valid && (
          <p className="material-note" role="status">
            {failed ? 'Не удалось загрузить изображения сравнения.' : 'Сравнение недоступно: нужны два исходных изображения.'}
          </p>
        )}
      </div>
    </div>
  );
}
