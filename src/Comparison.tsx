import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Design } from './config';

// Map a unit square to an arbitrary screen quadrilateral with a projective matrix.
export function perspective(c: NonNullable<Design['comparison']>['corners']) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = c;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = det === 0 ? 0 : (dx3 * dy2 - dx2 * dy3) / det;
  const h = det === 0 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  // A 1000px source plane prevents subpixel clip-path rasterization rounding
  // before the perspective transform (a 1px plane loses the split entirely).
  const units = 1000;
  return `matrix3d(${(x1 - x0 + g * x1) / units},${(y1 - y0 + g * y1) / units},0,${g / units},${(x3 - x0 + h * x3) / units},${(y3 - y0 + h * y3) / units},0,${h / units},0,0,1,0,${x0},${y0},0,1)`;
}

export function Comparison({ design, width, height, interactive }: { design: Design; width: number; height: number; interactive: boolean }) {
  const [value, setValue] = useState(50);
  const [failed, setFailed] = useState(false);
  const hintId = useId();
  const sources = design.comparison;
  const labels = design.comparisonLabels ?? { mini: 'Miniled', rgb: 'RGB-miniled' };
  const valid = Boolean(sources) && !failed;
  // Project the entire comparison plane (both aligned images + divider), so that
  // the bezel, cat, stand and environment are never recoloured or masked.
  const corners = sources?.corners.map(([x, y]) => [x * width, y * height]) as NonNullable<Design['comparison']>['corners'] | undefined;
  const planeStyle: CSSProperties = corners ? { width: 1000, height: 1000, transform: perspective(corners) } : {};

  function moveLine(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !corners) return;
    const origin = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
    const matrix = new DOMMatrix(perspective(corners));
    const point = new DOMPoint(e.clientX - origin.left, e.clientY - origin.top).matrixTransform(matrix.inverse());
    setValue(Math.round(Math.min(100, Math.max(0, point.x / point.w / 1000 * 100))));
  }

  return <div className="comparison" data-testid="comparison" style={{ '--split': `${value}%` } as CSSProperties}>
    {valid && sources && <div className="comparison-plane" style={planeStyle} inert={!interactive || undefined}
      onDragStart={e => e.preventDefault()}
      onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); moveLine(e); }}
      onPointerMove={moveLine} onPointerUp={e => { e.currentTarget.releasePointerCapture(e.pointerId); }}>
      <img draggable={false} src={sources.rgb} alt={labels.rgb} onError={() => setFailed(true)} />
      <img draggable={false} className="mini-image" src={sources.mini} alt={labels.mini} onError={() => setFailed(true)} />
      <div className="image-divider" aria-hidden="true" />
      <span className="screen-label screen-label--mini">{labels.mini}</span>
      <span className="screen-label screen-label--rgb">{labels.rgb}</span>
    </div>}
    <div className="comparison-ui" inert={!interactive || undefined}>
      <div className="comparison-labels"><span>{labels.mini}</span><span>{labels.rgb}</span></div>
      <div className="range-wrap">
        <div className="range-track" /><div className="range-handle" aria-hidden="true">‹<span />›</div>
        <input type="range" min="0" max="100" step="1" value={value}
          aria-label={`Граница сравнения ${labels.mini} и ${labels.rgb}`}
          aria-valuetext={`${value}% ${labels.mini}`}
          aria-describedby={valid ? undefined : hintId}
          onChange={e => setValue(Number(e.target.value))}
          onPointerDown={e => e.stopPropagation()} />
      </div>
      {!valid && <p className="material-note" id={hintId} role="status">{failed ? 'Не удалось загрузить изображения сравнения.' : 'Сравнение недоступно: нужны два исходных изображения.'}</p>}
    </div>
  </div>;
}
