import { MAX_PIXELS, MAX_SIDE } from '../constants';
import type { BackgroundImage } from '../types';

/** Decodes an image file with the browser's own decoder (so HEIC works in Safari, for example). */
function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}

/** A Hebrew message explaining why `file` couldn't be opened. */
export function decodeErrorMessage(file: File): string {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /hei[cf]/i.test(file.type);
  return isHeic
    ? `הדפדפן הזה לא יודע לפתוח קבצי HEIC (${file.name}). אפשר לפתוח את הדף בספארי, או להמיר את התמונה ל-JPG.`
    : `לא הצלחנו לפתוח את הקובץ ${file.name}. כדאי לנסות תמונה מסוג JPG, PNG או WEBP.`;
}

export interface OpenedImage {
  /** The photo drawn at its working size (large photos are scaled down). */
  original: HTMLCanvasElement;
  /** File name without the extension. */
  name: string;
  /** A small JPEG preview (data URL) for the list of photos. */
  thumb: string;
  scaledDown: boolean;
}

/** Opens a photo to process. Throws if the browser can't decode it. */
export async function loadImageFile(file: File): Promise<OpenedImage> {
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await decode(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  const scale = Math.min(
    1,
    MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight),
    Math.sqrt(MAX_PIXELS / (img.naturalWidth * img.naturalHeight)),
  );
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const original = document.createElement('canvas');
  original.width = w;
  original.height = h;
  original.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, w, h);

  const t = 160 / Math.max(w, h);
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = Math.max(1, Math.round(w * t));
  thumbCanvas.height = Math.max(1, Math.round(h * t));
  const tctx = thumbCanvas.getContext('2d')!;
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(original, 0, 0, thumbCanvas.width, thumbCanvas.height);

  return {
    original,
    name: file.name.replace(/\.[^.]+$/, '') || 'image',
    thumb: thumbCanvas.toDataURL('image/jpeg', 0.8),
    scaledDown: scale < 1,
  };
}

/** Opens a photo to use as the new background. The caller owns (and later revokes) `url`. */
export async function loadBackgroundImage(file: File): Promise<BackgroundImage> {
  const url = URL.createObjectURL(file);
  try {
    return { el: await decode(url), url };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Saves a blob through the browser's normal download flow. */
export function saveBlob(blob: Blob, fileName: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
