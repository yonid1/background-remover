import { GRADIENT_DIRS } from '../constants';
import type { BgSettings, Rect } from '../types';

export interface ComposeParams {
  original: HTMLCanvasElement;
  /** The subject on a transparent background; null while it's still being made. */
  cutout: HTMLCanvasElement | null;
  bg: BgSettings;
  /** The part of the image to draw (the crop, or the whole image). */
  region: Rect;
  /** Draw the untouched original instead of the result. */
  showOriginal: boolean;
}

const supportsCanvasFilter = 'filter' in CanvasRenderingContext2D.prototype;

/** True when the result keeps a transparent background (so it can't be saved as JPG). */
export function isTransparent(bg: BgSettings): boolean {
  return bg.type === 'transparent' || (bg.type === 'image' && !bg.image);
}

/** Draws the final picture into `canvas`, resizing it to the region. */
export function composeInto(canvas: HTMLCanvasElement, p: ComposeParams) {
  const w = Math.round(p.region.w);
  const h = Math.round(p.region.h);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  if (!p.cutout || p.showOriginal) {
    ctx.drawImage(p.original, -p.region.x, -p.region.y);
    return;
  }
  drawBackground(ctx, p);
  ctx.drawImage(p.cutout, -p.region.x, -p.region.y, p.original.width, p.original.height);
}

// Colors, gradients and background photos fill the output frame (the crop, if any).
// The blurred background is the original photo, so it's drawn in full-image coordinates.
function drawBackground(ctx: CanvasRenderingContext2D, { bg, region, original }: ComposeParams) {
  const w = region.w;
  const h = region.h;
  switch (bg.type) {
    case 'color':
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, w, h);
      break;
    case 'gradient': {
      const vec = GRADIENT_DIRS.find((d) => d.id === bg.gDir)?.vec ?? null;
      let g: CanvasGradient;
      if (!vec) {
        g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
      } else {
        // From one edge (or corner) to the opposite one, through the center.
        const [dx, dy] = vec;
        g = ctx.createLinearGradient(w / 2 - (dx * w) / 2, h / 2 - (dy * h) / 2, w / 2 + (dx * w) / 2, h / 2 + (dy * h) / 2);
      }
      g.addColorStop(0, bg.g1);
      g.addColorStop(1, bg.g2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case 'blur':
      drawBlurred(ctx, original, region, bg.blur);
      break;
    case 'image':
      if (bg.image) drawCover(ctx, bg.image.el, w, h);
      break;
    case 'transparent':
      break;
  }
}

function drawBlurred(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, region: Rect, strength: number) {
  const W = src.width;
  const H = src.height;
  const r = Math.max(1, Math.round((Math.max(W, H) * strength) / 1500));
  if (supportsCanvasFilter) {
    // Draw slightly larger than the image so the blurred edges don't fade out.
    const m = r * 2;
    ctx.filter = `blur(${r}px)`;
    ctx.drawImage(src, -region.x - m, -region.y - m, W + 2 * m, H + 2 * m);
    ctx.filter = 'none';
  } else {
    // Fallback for browsers without canvas filters: shrink and scale back up.
    const k = Math.max(1, r / 2);
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(W / k));
    small.height = Math.max(1, Math.round(H / k));
    const sc = small.getContext('2d')!;
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(src, 0, 0, small.width, small.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, -region.x, -region.y, W, H);
  }
}

/** Draws `img` to cover a w×h area, cropping the overflow evenly (like CSS object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
