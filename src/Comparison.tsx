import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { asset } from './base';
import type { Design } from './config';

/** Figma Component 551 (2:321) — 1440×833 design frame. */
const DESIGN_W = 1440;
const DESIGN_H = 833;

/**
 * Screen 5 — TV environment + sitting cat only.
 * Divider / Miniled / RGB labels moved to screen 4 (FeatureSlider).
 */
export function Comparison({ design }: { design: Design; width?: number; height?: number; interactive?: boolean }) {
  const [coverScale, setCoverScale] = useState(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const env = asset('assets/comparison/tv-env.png');
  const envWide = asset('assets/comparison/tv-env-wide.png');
  const cat = asset('assets/comparison/cat.png');
  void design;

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

  return (
    <div
      ref={rootRef}
      className="comparison comparison--figma comparison--still"
      data-testid="comparison"
      data-node-id="2:321"
      style={{ '--cmp-scale': String(coverScale) } as CSSProperties}
    >
      <div className="comparison-stage" data-testid="comparison-stage">
        <div className="comparison-env" aria-hidden="true">
          <img className="comparison-env__wide" src={envWide} alt="" draggable={false} />
          <img className="comparison-env__main" src={env} alt="" draggable={false} />
        </div>
        <img className="comparison-cat" src={cat} alt="" draggable={false} aria-hidden="true" />
      </div>
    </div>
  );
}
