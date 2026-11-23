import { useLayoutEffect, useRef } from 'react';
import { composeInto, PREVIEW_MAX_SIDE } from '../lib/compose';
import type { BgSettings, Effects, Item, Rect } from '../types';
import { BrushOverlay } from './BrushOverlay';
import { CropOverlay } from './CropOverlay';
import { PhotoIcon } from './icons';
import { StatusOverlay } from './StatusOverlay';

interface Point {
  x: number;
  y: number;
}

interface Props {
  item: Item | null;
  bg: BgSettings;
  effects: Effects;
  /** The part of the image to show (crop, whole image, or a frame around the subject). */
  region: Rect | null;
  showOriginal: boolean;
  cropEdit: Rect | null;
  cropRatio: number;
  onCropChange: (rect: Rect) => void;
  /** Brush radius in image pixels while the touch-up brush is on, otherwise null. */
  brushRadius: number | null;
  onStrokeStart: (p: Point) => void;
  onStrokeMove: (p: Point) => void;
  onStrokeEnd: () => void;
  onRetry: () => void;
  onPick: () => void;
  dragging: boolean;
  toast: string | null;
}

/** The preview area: empty drop zone, the result canvas, crop frame, brush, and status messages. */
export function Stage(p: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { item, bg, effects, region, showOriginal } = p;
  const ghost = p.brushRadius !== null;

  useLayoutEffect(() => {
    if (item && region && canvasRef.current) {
      // The preview doesn't need more pixels than a screen can show; saving uses full size.
      const scale = Math.min(1, PREVIEW_MAX_SIDE / Math.max(region.w, region.h));
      composeInto(
        canvasRef.current,
        { original: item.original, cutout: item.cutout, version: item.version, bg, effects, region, showOriginal, ghost },
        scale,
      );
    }
  }, [item, bg, effects, region, showOriginal, ghost]);

  return (
    <div ref={stageRef} className={p.dragging ? 'stage dragging' : 'stage'}>
      {!item && (
        <div
          className="empty"
          role="button"
          tabIndex={0}
          onClick={p.onPick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              p.onPick();
            }
          }}
        >
          <PhotoIcon />
          <strong>גררו תמונות לכאן או לחצו כדי לבחור</strong>
          <span>אפשר כמה תמונות בבת אחת. JPG, PNG, WEBP ועוד</span>
        </div>
      )}

      <canvas ref={canvasRef} className="preview" hidden={!item} />

      {item && p.cropEdit && (
        <CropOverlay
          stageRef={stageRef}
          canvasRef={canvasRef}
          imageSize={{ w: item.original.width, h: item.original.height }}
          rect={p.cropEdit}
          ratio={p.cropRatio}
          onChange={p.onCropChange}
        />
      )}

      {item && region && p.brushRadius !== null && item.status === 'done' && (
        <BrushOverlay
          stageRef={stageRef}
          canvasRef={canvasRef}
          region={region}
          radius={p.brushRadius}
          onStrokeStart={p.onStrokeStart}
          onStrokeMove={p.onStrokeMove}
          onStrokeEnd={p.onStrokeEnd}
        />
      )}

      {item && <StatusOverlay item={item} onRetry={p.onRetry} />}

      {p.toast && (
        <div className="toast" role="status">
          {p.toast}
        </div>
      )}
    </div>
  );
}
