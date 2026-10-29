import { useEffect } from 'react';

const DESIGN_WIDTH = 1440;

/**
 * Lock the composition to the 1440 design width.
 * Wider viewports keep image+text at 1440 and show white side bars (no html zoom).
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
