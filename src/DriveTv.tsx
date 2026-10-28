import { asset } from './base';

/**
 * Figma 12:429 — discrete TV object.
 * Scaled as a unit during reveal→zoom (not a cover-cropped video plane).
 * Asset is the layered glow/body/screen/bar composition from the node.
 */
export function DriveTv({
  scale,
  opacity,
}: {
  scale: number;
  opacity: number;
}) {
  return (
    <div
      className="drive-tv"
      data-testid="tv-drive"
      data-node-id="12:429"
      style={{
        opacity,
        visibility: opacity > 0.01 ? 'visible' : 'hidden',
        transform: `translate(-50%, -50%) scale(${scale})`,
        pointerEvents: 'none',
      }}
      aria-hidden={opacity < 0.05 || undefined}
    >
      <img
        className="drive-tv__image"
        src={asset('assets/drive/tv-composed.png')}
        alt=""
        width={1440}
        height={1081}
        draggable={false}
      />
    </div>
  );
}
