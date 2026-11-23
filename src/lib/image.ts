import { MAX_PIXELS, MAX_SIDE } from '../constants';
import type { BackgroundImage, LoadedImage } from '../types';

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
    ? 'הדפדפן הזה לא יודע לפתוח קבצי HEIC (הפורמט של תמונות אייפון). אפשר לפתוח את הדף בספארי, או להמיר את התמונה ל-JPG.'
    : 'לא הצלחנו לפתוח את הקובץ. כדאי לנסות תמונה מסוג JPG, PNG או WEBP.';
}

/** Opens the photo to process. Throws if the browser can't decode it. */
export async function loadImageFile(file: File): Promise<LoadedImage> {
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

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  // Handing the model raw pixels (instead of the file) means it sees exactly what we draw:
  // same orientation, same size, and any format the browser can open.
  const { data } = ctx.getImageData(0, 0, w, h);
  return {
    canvas,
    pixels: new Blob([data], { type: `image/x-rgba8;width=${w};height=${h}` }),
    name: file.name.replace(/\.[^.]+$/, '') || 'image',
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
