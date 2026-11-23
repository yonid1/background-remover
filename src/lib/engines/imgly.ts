import type { RemovalProgress } from '../../types';
import { downloadTracker } from './progress';

/**
 * ISNet through @imgly/background-removal. The library and its ~88 MB model are only
 * downloaded the first time this engine runs.
 */

type Lib = typeof import('@imgly/background-removal');

let libPromise: Promise<Lib> | null = null;
function loadLib(): Promise<Lib> {
  libPromise ??= import('@imgly/background-removal').catch((err) => {
    libPromise = null;
    throw err;
  });
  return libPromise;
}

// The library uses the CPU by itself when WebGPU isn't available. This switches to the CPU
// only if the GPU path fails for some other reason.
let device: 'gpu' | 'cpu' = 'gpu';

// The library caches its model session by config, including a failed one. Changing
// fetchArgs after a failure gives "try again" a fresh attempt (fetch ignores the extra key).
let attempt = 0;

/** "Failed to fetch" (Chrome), "Load failed" (Safari), "NetworkError..." (Firefox). */
export function isNetworkError(err: unknown): boolean {
  return /fetch|network|load failed/i.test(String((err as Error | undefined)?.message ?? err));
}

/** Returns the subject on a transparent background, the same size as `original`. */
export async function removeWithImgly(
  original: HTMLCanvasElement,
  onProgress: (p: RemovalProgress) => void,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  onProgress({ phase: 'loading' });
  const { removeBackground } = await loadLib();
  signal.throwIfAborted();

  // Hand the model raw pixels, so it sees exactly what we draw (orientation, size, format).
  const w = original.width;
  const h = original.height;
  const { data } = original.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h);
  const pixels = new Blob([data], { type: `image/x-rgba8;width=${w};height=${h}` });

  const onDownload = downloadTracker(onProgress);
  const progress = (key: string, current: number, total: number) => {
    if (signal.aborted) return;
    if (key.startsWith('fetch:')) onDownload(key, current, total);
    else if (key.startsWith('compute:')) onProgress({ phase: 'removing' });
  };

  const attemptOn = (dev: 'gpu' | 'cpu') =>
    removeBackground(pixels, {
      model: 'isnet_fp16',
      device: dev,
      output: { format: 'image/x-rgba8' },
      fetchArgs: { attempt },
      progress,
    });

  let out: Blob;
  try {
    try {
      out = await attemptOn(device);
    } catch (err) {
      // Fall back to the (slower) CPU only for real GPU problems, not for a dropped connection.
      if (device !== 'gpu' || isNetworkError(err)) throw err;
      console.warn('GPU path failed, retrying on CPU', err);
      device = 'cpu';
      out = await attemptOn('cpu');
    }
  } catch (err) {
    attempt++;
    throw err;
  }
  signal.throwIfAborted();

  // Raw output: the type carries the size, e.g. "image/x-rgba8;width=512;height=512".
  const ow = Number(out.type.match(/width=(\d+)/)?.[1]) || w;
  const oh = Number(out.type.match(/height=(\d+)/)?.[1]) || h;
  const cutout = document.createElement('canvas');
  cutout.width = ow;
  cutout.height = oh;
  cutout
    .getContext('2d', { willReadFrequently: true })!
    .putImageData(new ImageData(new Uint8ClampedArray(await out.arrayBuffer()), ow, oh), 0, 0);
  return cutout;
}
