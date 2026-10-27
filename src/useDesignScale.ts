import { useEffect } from 'react';

const DESIGN_WIDTH = 1440;

/**
 * Scale the whole page from the 1440 design width on viewports ≥1440.
 * Uses CSS `zoom` so image + fonts + fixed chrome grow together with no reflow
 * and no black side bars. Below 1440, zoom stays 1 (mobile/tablet CSS adapts).
 */
export function useDesignScale() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      // innerWidth is unaffected by zoom in Chromium — safe to recompute from.
      const scale = Math.max(1, window.innerWidth / DESIGN_WIDTH);
      root.style.setProperty('--design-scale', String(scale));
      root.style.zoom = String(scale);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      root.style.removeProperty('--design-scale');
      root.style.removeProperty('zoom');
    };
  }, []);
}

export { DESIGN_WIDTH };
