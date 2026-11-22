import { useLayoutEffect, useRef } from 'react';
import { composeInto } from '../lib/compose';
import type { BgSettings, LoadedImage, Rect, RemovalState } from '../types';
import { CropOverlay } from './CropOverlay';
import { PhotoIcon } from './icons';
import { StatusOverlay } from './StatusOverlay';

interface Props {
  image: LoadedImage | null;
  cutout: HTMLCanvasElement | null;
  bg: BgSettings;
  /** The part of the image to show. */
  region: Rect | null;
  showOriginal: boolean;
  cropEdit: Rect | null;
  cropRatio: number;
  onCropChange: (rect: Rect) => void;
  removal: RemovalState;
  onRetry: () => void;
  onPick: () => void;
  dragging: boolean;
  toast: string | null;
}

/** The preview area: empty drop zone, the result canvas, the crop frame and status messages. */
export function Stage(p: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { image, cutout, bg, region, showOriginal } = p;

  useLayoutEffect(() => {
    if (image && region && canvasRef.current) {
      composeInto(canvasRef.current, { original: image.canvas, cutout, bg, region, showOriginal });
    }
  }, [image, cutout, bg, region, showOriginal]);

  return (
    <div ref={stageRef} className={p.dragging ? 'stage dragging' : 'stage'}>
      {!image && (
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
          <strong>גררו תמונה לכאן או לחצו כדי לבחור</strong>
          <span>JPG, PNG, WEBP ועוד</span>
        </div>
      )}

      <canvas ref={canvasRef} className="preview" hidden={!image} />

      {image && p.cropEdit && (
        <CropOverlay
          stageRef={stageRef}
          canvasRef={canvasRef}
          imageSize={{ w: image.canvas.width, h: image.canvas.height }}
          rect={p.cropEdit}
          ratio={p.cropRatio}
          onChange={p.onCropChange}
        />
      )}

      <StatusOverlay removal={p.removal} onRetry={p.onRetry} />

      {p.toast && (
        <div className="toast" role="status">
          {p.toast}
        </div>
      )}
    </div>
  );
}
