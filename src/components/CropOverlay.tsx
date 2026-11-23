import { useRef, type PointerEvent, type RefObject } from 'react';
import { useCanvasBox } from '../hooks/useCanvasBox';
import { moveRect, resizeRect, type Handle } from '../lib/geometry';
import type { Rect, Size } from '../types';

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Props {
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Size of the full image, in pixels. While cropping, the canvas shows the whole image. */
  imageSize: Size;
  rect: Rect;
  /** width / height, or 0 for free. */
  ratio: number;
  onChange: (rect: Rect) => void;
}

interface Drag {
  handle: Handle | 'move';
  x: number;
  y: number;
  start: Rect;
  /** Screen pixels per image pixel. */
  k: number;
}

/** The crop frame drawn over the preview: drag it to move, drag the handles to resize. */
export function CropOverlay({ stageRef, canvasRef, imageSize, rect, ratio, onChange }: Props) {
  const box = useCanvasBox(stageRef, canvasRef);
  const drag = useRef<Drag | null>(null);

  if (!box) return null;
  const k = box.width / imageSize.w;
  const frame = { left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    e.preventDefault();
    const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-h]')?.dataset.h as Handle | undefined;
    drag.current = { handle: handle ?? 'move', x: e.clientX, y: e.clientY, start: rect, k };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.k;
    const dy = (e.clientY - d.y) / d.k;
    onChange(
      d.handle === 'move'
        ? moveRect(imageSize, d.start, dx, dy)
        : resizeRect(imageSize, d.start, d.handle, dx, dy, ratio),
    );
  };

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div className="crop-layer" style={box}>
      <div className="crop-shade">
        <div className="crop-hole" style={frame} />
      </div>
      <div
        className={ratio ? 'crop-box locked' : 'crop-box'}
        style={frame}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="crop-size">
          {Math.round(rect.w)} × {Math.round(rect.h)}
        </span>
        {HANDLES.map((h) => (
          <i key={h} className="h" data-h={h} />
        ))}
      </div>
    </div>
  );
}
