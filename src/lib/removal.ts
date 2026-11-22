import { MODEL } from '../constants';
import type { Rect, RemovalProgress } from '../types';

type Lib = typeof import('@imgly/background-removal');

// The library (and its ~88 MB model) is only loaded when the first photo is opened.
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

// Only one removal runs at a time: two at once on the same model is very slow
// (about 60 s instead of 3 s in testing).
let running: Promise<unknown> | null = null;

/** "Failed to fetch" (Chrome), "Load failed" (Safari), "NetworkError..." (Firefox). */
export function isNetworkError(err: unknown): boolean {
  return /fetch|network|load failed/i.test(String((err as Error | undefined)?.message ?? err));
}

export interface RemovalResult {
  /** The subject on a transparent background, same size as the input. */
  cutout: HTMLCanvasElement;
  /** Bounding box of the subject, or null if the model found nothing. */
  subjectBox: Rect | null;
}

/**
 * Removes the background from raw RGBA pixels (see LoadedImage.pixels).
 * If `signal` is aborted while waiting for an earlier removal, this one never starts.
 */
export async function removeBackgroundFrom(
  pixels: Blob,
  onProgress: (p: RemovalProgress) => void,
  signal: AbortSignal,
): Promise<RemovalResult> {
  while (running) {
    await running.catch(() => {});
    signal.throwIfAborted();
  }
  const task = run(pixels, onProgress, signal);
  running = task;
  try {
    return await task;
  } finally {
    if (running === task) running = null;
  }
}

async function run(
  pixels: Blob,
  onProgress: (p: RemovalProgress) => void,
  signal: AbortSignal,
): Promise<RemovalResult> {
  onProgress({ phase: 'loading' });
  const { removeBackground } = await loadLib();
  // A newer photo may have arrived while the library loaded (this also skips the
  // duplicate run that React's StrictMode triggers in development).
  signal.throwIfAborted();

  const downloads = new Map<string, [number, number]>();
  const progress = (key: string, current: number, total: number) => {
    if (signal.aborted) return;
    if (key.startsWith('fetch:')) {
      downloads.set(key, [current, total]);
      let done = 0;
      let all = 0;
      for (const [c, t] of downloads.values()) {
        done += c;
        all += t;
      }
      onProgress(done < all ? { phase: 'download', done, total: all } : { phase: 'preparing' });
    } else if (key.startsWith('compute:')) {
      onProgress({ phase: 'removing' });
    }
  };

  const attemptOn = (dev: 'gpu' | 'cpu') =>
    removeBackground(pixels, {
      model: MODEL,
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
  const w = Number(out.type.match(/width=(\d+)/)?.[1]);
  const h = Number(out.type.match(/height=(\d+)/)?.[1]);
  const data = new Uint8ClampedArray(await out.arrayBuffer());
  const cutout = document.createElement('canvas');
  cutout.width = w;
  cutout.height = h;
  cutout.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0);

  return { cutout, subjectBox: findSubjectBox(data, w, h) };
}

/** Bounding box of the pixels the model kept (alpha above a small threshold). */
function findSubjectBox(data: Uint8ClampedArray, w: number, h: number): Rect | null {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
