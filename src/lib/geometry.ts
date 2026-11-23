import type { Framing, Item, Rect, Size } from '../types';

/** Crop-frame math. All rectangles are in image pixels and stay inside the image. */

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export const fullRect = (size: Size): Rect => ({ x: 0, y: 0, w: size.w, h: size.h });

/**
 * Fits a w×h rectangle inside the image (shrinking it evenly if needed) and centers it
 * on (cx, cy) as closely as the image edges allow.
 */
export function placeRect(size: Size, cx: number, cy: number, w: number, h: number): Rect {
  const s = Math.min(1, size.w / w, size.h / h);
  w *= s;
  h *= s;
  return { x: clamp(cx - w / 2, 0, size.w - w), y: clamp(cy - h / 2, 0, size.h - h), w, h };
}

/** The biggest frame with the given shape (width / height), centered where `around` is centered. */
export function largestWithRatio(size: Size, ratio: number, around: Rect): Rect {
  const w = Math.min(size.w, size.h * ratio);
  return placeRect(size, around.x + around.w / 2, around.y + around.h / 2, w, w / ratio);
}

/** A frame around the subject with a small margin, in the chosen shape (0 = free). */
export function subjectRect(size: Size, subject: Rect, ratio: number): Rect {
  const pad = Math.round(Math.max(subject.w, subject.h) * 0.06);
  if (!ratio) {
    const x = Math.max(0, subject.x - pad);
    const y = Math.max(0, subject.y - pad);
    return {
      x,
      y,
      w: Math.min(size.w, subject.x + subject.w + pad) - x,
      h: Math.min(size.h, subject.y + subject.h + pad) - y,
    };
  }
  let w = subject.w + 2 * pad;
  let h = subject.h + 2 * pad;
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  return placeRect(size, subject.x + subject.w / 2, subject.y + subject.h / 2, w, h);
}

export function moveRect(size: Size, start: Rect, dx: number, dy: number): Rect {
  return {
    ...start,
    x: clamp(start.x + dx, 0, size.w - start.w),
    y: clamp(start.y + dy, 0, size.h - start.h),
  };
}

/** Handle names are compass directions: 'n', 'se', 'w', ... */
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export function resizeRect(size: Size, start: Rect, handle: Handle, dx: number, dy: number, ratio: number): Rect {
  const min = Math.max(8, Math.round(Math.min(size.w, size.h) * 0.04));
  let l = start.x;
  let t = start.y;
  let r = start.x + start.w;
  let b = start.y + start.h;
  if (handle.includes('w')) l = clamp(l + dx, 0, r - min);
  if (handle.includes('e')) r = clamp(r + dx, l + min, size.w);
  if (handle.includes('n')) t = clamp(t + dy, 0, b - min);
  if (handle.includes('s')) b = clamp(b + dy, t + min, size.h);
  if (!ratio) return { x: l, y: t, w: r - l, h: b - t };

  // Fixed shape (corner handles only): follow whichever side moved more,
  // keeping the opposite corner in place and the frame inside the image.
  let w = r - l;
  let h = b - t;
  if (Math.abs(w - start.w) >= Math.abs(h - start.h) * ratio) h = w / ratio;
  else w = h * ratio;
  const ax = handle.includes('w') ? start.x + start.w : start.x;
  const ay = handle.includes('n') ? start.y + start.h : start.y;
  const maxW = Math.min(handle.includes('w') ? ax : size.w - ax, (handle.includes('n') ? ay : size.h - ay) * ratio);
  w = clamp(w, Math.min(Math.max(min, min * ratio), maxW), maxW);
  h = w / ratio;
  return { x: handle.includes('w') ? ax - w : ax, y: handle.includes('n') ? ay - h : ay, w, h };
}

/**
 * "Center with padding": a frame centered on the subject with `padding` percent of its
 * longest side around it, widened to the given shape (0 = the subject's own shape).
 * Unlike a crop it may reach past the photo's edges; the background fills that area.
 */
export function centeredFrame(subject: Rect, padding: number, ratio: number): Rect {
  const pad = (Math.max(subject.w, subject.h) * padding) / 100;
  let w = subject.w + 2 * pad;
  let h = subject.h + 2 * pad;
  if (ratio) {
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
  }
  const cx = subject.x + subject.w / 2;
  const cy = subject.y + subject.h / 2;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) };
}

/**
 * The part of a photo that's shown and saved: the whole photo while its crop frame is being
 * edited, a frame around the subject when centering is on, otherwise its crop (if any).
 */
export function viewRegion(item: Item, framing: Framing, editingCrop: boolean): Rect {
  const full = { x: 0, y: 0, w: item.original.width, h: item.original.height };
  if (editingCrop) return full;
  if (framing.on && item.subjectBox) return centeredFrame(item.subjectBox, framing.padding, framing.ratio);
  return item.crop ?? full;
}

/** Rounds a frame to whole pixels. Returns null when it covers the whole image (no crop). */
export function finalizeCrop(size: Size, c: Rect): Rect | null {
  const x = clamp(Math.round(c.x), 0, size.w - 1);
  const y = clamp(Math.round(c.y), 0, size.h - 1);
  const w = clamp(Math.round(c.w), 1, size.w - x);
  const h = clamp(Math.round(c.h), 1, size.h - y);
  return x === 0 && y === 0 && w === size.w && h === size.h ? null : { x, y, w, h };
}
