import { useLayoutEffect, useState, type RefObject } from 'react';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where the preview canvas sits inside the stage, in CSS pixels, kept up to date when the
 * window or the canvas changes size. Overlays (crop frame, brush) use it to line up.
 */
export function useCanvasBox(
  stageRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): Box | null {
  const [box, setBox] = useState<Box | null>(null);

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

  return box;
}
