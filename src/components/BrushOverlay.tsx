import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import { useCanvasBox } from '../hooks/useCanvasBox';
import type { Rect } from '../types';

interface Point {
  x: number;
  y: number;
}

interface Props {
  stageRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** The part of the image the canvas shows, in image pixels. */
  region: Rect;
  /** Brush radius in image pixels. */
  radius: number;
  onStrokeStart: (p: Point) => void;
  onStrokeMove: (p: Point) => void;
  onStrokeEnd: () => void;
}

/** Captures painting over the preview for the touch-up brush, and shows the brush outline. */
export function BrushOverlay({ stageRef, canvasRef, region, radius, onStrokeStart, onStrokeMove, onStrokeEnd }: Props) {
  const box = useCanvasBox(stageRef, canvasRef);
  const [cursor, setCursor] = useState<Point | null>(null);
  const drawing = useRef(false);

  if (!box) return null;
  const k = box.width / region.w; // screen px per image px

  // Pointer position on the layer, and the matching point in the image.
  const locate = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
    return { screen, image: { x: region.x + screen.x / k, y: region.y + screen.y / k } };
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onStrokeEnd();
  };

  return (
    <div
      className="brush-layer"
      style={box}
      onPointerDown={(e) => {
        if (e.button > 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const { screen, image } = locate(e);
        setCursor(screen);
        onStrokeStart(image);
      }}
      onPointerMove={(e) => {
        const { screen, image } = locate(e);
        setCursor(screen);
        if (drawing.current) onStrokeMove(image);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => {
        if (!drawing.current) setCursor(null);
      }}
    >
      {cursor && (
        <div
          className="brush-cursor"
          style={{ left: cursor.x, top: cursor.y, width: radius * 2 * k, height: radius * 2 * k }}
        />
      )}
    </div>
  );
}
