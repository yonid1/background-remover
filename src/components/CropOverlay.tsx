import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
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
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const drag = useRef<Drag | null>(null);

  // Line the layer up with the canvas as it's shown on screen, and keep it lined up when
  // the window or the canvas changes size.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const update = () => {
      const s = stage.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      setBox({
        left: c.left - s.left - stage.clientLeft,
        top: c.top - s.top - stage.clientTop,
        width: c.width,
        height: c.height,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [stageRef, canvasRef]);

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
