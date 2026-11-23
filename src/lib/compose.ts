import { GRADIENT_DIRS } from '../constants';
import type { BgSettings, Effects, ExportFormat, Rect } from '../types';

export interface ComposeParams {
  original: HTMLCanvasElement;
  /** The subject on a transparent background; null while it's still being made. */
  cutout: HTMLCanvasElement | null;
  bg: BgSettings;
  effects: Effects;
  /** The part of the image to draw (the crop, or the whole image), in image pixels. */
  region: Rect;
  /** Draw the untouched original instead of the result. */
  showOriginal: boolean;
}

/** The on-screen preview is drawn at most this big; saved files use the full size. */
export const PREVIEW_MAX_SIDE = 2048;

const supportsCanvasFilter = 'filter' in CanvasRenderingContext2D.prototype;

/** True when the result keeps a transparent background (so it can't be saved as JPG). */
export function isTransparent(bg: BgSettings): boolean {
  return bg.type === 'transparent' || (bg.type === 'image' && !bg.image);
}

/**
 * Draws the final picture into `canvas`, resizing the canvas to the region times `scale`.
 * Everything is drawn in image pixels through a scaling transform; blur and shadow sizes,
 * which the canvas doesn't scale, are multiplied by `scale` where they're set.
 */
export function composeInto(canvas: HTMLCanvasElement, p: ComposeParams, scale = 1) {
  const w = Math.max(1, Math.round(p.region.w * scale));
  const h = Math.max(1, Math.round(p.region.h * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  if (!p.cutout || p.showOriginal) {
    ctx.drawImage(p.original, -p.region.x, -p.region.y);
  } else {
    drawBackground(ctx, p, scale);
    drawSubject(ctx, p.cutout, p.effects, p.region, scale);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Draws the final picture and encodes it, optionally scaled down so its longest side is `maxSide`. */
export async function renderToBlob(p: ComposeParams, format: ExportFormat, maxSide: number): Promise<Blob> {
  // Draw at full size, then shrink in one high-quality step (sharper than drawing small).
  const full = document.createElement('canvas');
  composeInto(full, p);
  let out = full;
  const longest = Math.max(full.width, full.height);
  if (maxSide && longest > maxSide) {
    const s = maxSide / longest;
    out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(full.width * s));
    out.height = Math.max(1, Math.round(full.height * s));
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, 0, 0, out.width, out.height);
  }
  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), `image/${format}`, 0.92),
  );
}

/** File extension for an encoded image (browsers that can't write WebP fall back to PNG). */
export function extensionFor(blob: Blob): string {
  return { 'image/jpeg': 'jpg', 'image/webp': 'webp' }[blob.type] ?? 'png';
}

// ---------- Background ----------

// Colors, gradients and background photos fill the output frame (the crop, if any).
// The blurred background is the original photo, so it's drawn in full-image coordinates.
function drawBackground(ctx: CanvasRenderingContext2D, { bg, region, original }: ComposeParams, scale: number) {
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
      drawBlurred(ctx, original, region, bg.blur, scale);
      break;
    case 'image':
      if (bg.image) drawCover(ctx, bg.image.el, w, h);
      break;
    case 'transparent':
      break;
  }
}

function drawBlurred(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, region: Rect, strength: number, scale: number) {
  const W = src.width;
  const H = src.height;
  const r = Math.max(1, Math.round((Math.max(W, H) * strength) / 1500)); // in image pixels
  if (supportsCanvasFilter) {
    // Draw slightly larger than the image so the blurred edges don't fade out.
    const m = r * 2;
    ctx.filter = `blur(${Math.max(1, r * scale)}px)`;
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

// ---------- Subject and its effects ----------

/** The subject, with its outline and shadow if those are on. */
function drawSubject(ctx: CanvasRenderingContext2D, cutout: HTMLCanvasElement, effects: Effects, region: Rect, scale: number) {
  const W = cutout.width;
  const H = cutout.height;
  const outline = effects.outline ? outlineLayer(cutout, effects.outlineColor, effects.outlineWidth) : null;

  ctx.save();
  if (effects.shadow) {
    // The canvas draws the shadow from the shape of what's drawn next (its alpha).
    const size = Math.max(W, H) * scale;
    ctx.shadowColor = `rgba(0, 0, 0, ${effects.shadowOpacity / 100})`;
    ctx.shadowBlur = (size * effects.shadowSize) / 1000;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = (size * effects.shadowSize) / 3000;
  }
  if (outline) {
    // The outline is bigger than the subject, so it alone casts the shadow.
    ctx.drawImage(outline, -region.x, -region.y, W, H);
    ctx.shadowColor = 'transparent';
  }
  ctx.drawImage(cutout, -region.x, -region.y, W, H);
  ctx.restore();
}

// Building an outline takes a few dozen draws, so it's built at a reduced size (it's a
// solid color, so that doesn't show) and the last one is kept per cutout.
const OUTLINE_MAX_SIDE = 2048;
const outlineCache = new WeakMap<HTMLCanvasElement, { key: string; canvas: HTMLCanvasElement }>();

/**
 * The subject's shape grown by `width` (1–40, up to 4% of the image) and filled with
 * `color`, like a sticker border. The subject itself is drawn on top of it separately.
 */
function outlineLayer(cutout: HTMLCanvasElement, color: string, width: number): HTMLCanvasElement {
  const key = `${color}|${width}`;
  const cached = outlineCache.get(cutout);
  if (cached?.key === key) return cached.canvas;

  const s = Math.min(1, OUTLINE_MAX_SIDE / Math.max(cutout.width, cutout.height));
  const W = Math.max(1, Math.round(cutout.width * s));
  const H = Math.max(1, Math.round(cutout.height * s));
  const px = Math.max(1, (Math.max(W, H) * width) / 1000);

  // The subject's shape, filled with the outline color.
  const shape = document.createElement('canvas');
  shape.width = W;
  shape.height = H;
  const sc = shape.getContext('2d')!;
  sc.drawImage(cutout, 0, 0, W, H);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = color;
  sc.fillRect(0, 0, W, H);

  // Grow the shape by stamping it around two circles.
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const oc = out.getContext('2d')!;
  const steps = 32;
  for (const r of [px, px / 2]) {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      oc.drawImage(shape, Math.cos(a) * r, Math.sin(a) * r);
    }
  }
  oc.drawImage(shape, 0, 0);

  outlineCache.set(cutout, { key, canvas: out });
  return out;
}
