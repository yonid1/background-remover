import type { BrushMode } from '../types';

/**
 * The touch-up brush. It edits the cutout (the subject on a transparent background) in place:
 * "erase" makes pixels transparent, "restore" paints the original photo back in.
 * The brush has a soft edge, so repeated passes build up gradually.
 */

/** How much of the radius is fully opaque before the edge starts to fade. */
const HARDNESS = 0.55;

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Copies part of a canvas into a new canvas. */
function crop(src: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const c = canvasOf(w, h);
  c.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}

/** A patch for undo/redo: what one stroke changed, before and after. */
export interface StrokePatch {
  x: number;
  y: number;
  before: HTMLCanvasElement;
  after: HTMLCanvasElement;
}

export class Stroke {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly snapshot: HTMLCanvasElement;
  private readonly stamp: HTMLCanvasElement;
  private last: { x: number; y: number } | null = null;
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  constructor(
    private readonly cutout: HTMLCanvasElement,
    private readonly original: HTMLCanvasElement,
    private readonly mode: BrushMode,
    /** In image pixels. */
    private readonly radius: number,
  ) {
    this.ctx = cutout.getContext('2d', { willReadFrequently: true })!;
    // Keep a copy of how the cutout looked before, to build the undo patch at the end.
    this.snapshot = crop(cutout, 0, 0, cutout.width, cutout.height);
    this.stamp = canvasOf(radius * 2, radius * 2);
  }

  /** Paints a line from the previous point (or a dot, for the first point). */
  to(x: number, y: number) {
    const from = this.last ?? { x, y };
    const dist = Math.hypot(x - from.x, y - from.y);
    const step = Math.max(1, this.radius / 4);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = this.last ? 1 : 0; i <= n; i++) {
      this.dab(from.x + ((x - from.x) * i) / n, from.y + ((y - from.y) * i) / n);
    }
    this.last = { x, y };
  }

  private dab(x: number, y: number) {
    const r = this.radius;
    this.minX = Math.min(this.minX, x - r);
    this.minY = Math.min(this.minY, y - r);
    this.maxX = Math.max(this.maxX, x + r);
    this.maxY = Math.max(this.maxY, y + r);

    if (this.mode === 'erase') {
      const g = this.ctx.createRadialGradient(x, y, r * HARDNESS, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.fillStyle = g;
      this.ctx.beginPath();
      this.ctx.arc(x, y, r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      return;
    }

    // Restore: take the original under the brush, fade its edge, and paint it over the cutout.
    const s = this.stamp.getContext('2d')!;
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, this.stamp.width, this.stamp.height);
    s.drawImage(this.original, x - r, y - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    const g = s.createRadialGradient(r, r, r * HARDNESS, r, r, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    s.globalCompositeOperation = 'destination-in';
    s.fillStyle = g;
    s.fillRect(0, 0, r * 2, r * 2);
    this.ctx.drawImage(this.stamp, x - r, y - r);
  }

  /** Ends the stroke. Returns the changed area before and after, or null if nothing changed. */
  finish(): StrokePatch | null {
    const x = Math.max(0, Math.floor(this.minX));
    const y = Math.max(0, Math.floor(this.minY));
    const w = Math.min(this.cutout.width, Math.ceil(this.maxX)) - x;
    const h = Math.min(this.cutout.height, Math.ceil(this.maxY)) - y;
    if (w <= 0 || h <= 0) return null;
    return { x, y, before: crop(this.snapshot, x, y, w, h), after: crop(this.cutout, x, y, w, h) };
  }
}

/** Puts a saved patch back into the cutout (for undo and redo). */
export function applyPatch(cutout: HTMLCanvasElement, x: number, y: number, patch: HTMLCanvasElement) {
  const ctx = cutout.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(x, y, patch.width, patch.height);
  ctx.drawImage(patch, x, y);
}
