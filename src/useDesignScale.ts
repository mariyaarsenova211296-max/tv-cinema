import { useEffect } from 'react';

const DESIGN_WIDTH = 1440;

/**
 * Lock the composition to the 1440 design width inside the shell iframe.
 * Outer shell (index.html) width-fills ≤1440 and adapts iframe height when short;
 * inner layout uses svh clamps — do not whole-scene min(w,h) zoom here.
 */
export function useDesignScale() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--design-scale', '1');
    // Keep unit so max-width: var(--design-width) resolves (never set bare "1440").
    root.style.setProperty('--design-width', `${DESIGN_WIDTH}px`);
    root.style.removeProperty('zoom');
    return () => {
      root.style.setProperty('--design-scale', '1');
      root.style.setProperty('--design-width', `${DESIGN_WIDTH}px`);
      root.style.removeProperty('zoom');
    };
  }, []);
}

export { DESIGN_WIDTH };
