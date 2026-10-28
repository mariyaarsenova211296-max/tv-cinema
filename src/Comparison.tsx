import type { Design } from './config';

/**
 * Screen 5 — no still overlay.
 * MediaStage parks video-2 on its last decoded frame underneath for a
 * continuous handoff; env/cat stills previously mismatched that frame.
 * Feature copy lives outside this layer (comparison-features).
 */
export function Comparison({ design }: { design: Design; width?: number; height?: number; interactive?: boolean }) {
  void design;
  return (
    <div
      className="comparison comparison--hold"
      data-testid="comparison"
      data-node-id="2:321"
      aria-hidden="true"
    />
  );
}
