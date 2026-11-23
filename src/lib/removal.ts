import { MODELS } from '../constants';
import type { ModelId, Rect, RemovalProgress } from '../types';
import { isNetworkError, removeWithImgly } from './engines/imgly';
import { releaseTransformersModel, removeWithTransformers } from './engines/transformers';

export { isNetworkError };

/** WebGPU (needed for the Transformers.js models) is available in this browser. */
export const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

/** Resolves to true on Apple GPUs (Mac, iPhone), where some models can't run. */
export const appleGpu: Promise<boolean> = hasWebGPU
  ? navigator.gpu
      .requestAdapter()
      .then((a) => a?.info?.vendor === 'apple')
      .catch(() => false)
  : Promise.resolve(/Mac|iPhone|iPad/.test(navigator.userAgent));

export interface RemovalResult {
  /** The subject on a transparent background, same size as the input. */
  cutout: HTMLCanvasElement;
  /** Bounding box of the subject, or null if the model found nothing. */
  subjectBox: Rect | null;
}

// Only one removal runs at a time: two at once on the same model is very slow
// (about 60 s instead of 3 s in testing).
let running: Promise<unknown> | null = null;

/**
 * Removes the background from `original` with the chosen model.
 * If `signal` is aborted while waiting for an earlier removal, this one never starts.
 */
export async function removeBackgroundFrom(
  modelId: ModelId,
  original: HTMLCanvasElement,
  onProgress: (p: RemovalProgress) => void,
  signal: AbortSignal,
): Promise<RemovalResult> {
  while (running) {
    await running.catch(() => {});
    signal.throwIfAborted();
  }
  const task = run(modelId, original, onProgress, signal);
  running = task;
  try {
    return await task;
  } finally {
    if (running === task) running = null;
  }
}

async function run(
  modelId: ModelId,
  original: HTMLCanvasElement,
  onProgress: (p: RemovalProgress) => void,
  signal: AbortSignal,
): Promise<RemovalResult> {
  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0];
  if (model.engine === 'imgly') releaseTransformersModel();
  const cutout =
    model.engine === 'transformers' && model.transformers
      ? await removeWithTransformers(model.transformers, original, onProgress, signal)
      : await removeWithImgly(original, onProgress, signal);
  signal.throwIfAborted();
  return { cutout, subjectBox: findSubjectBox(cutout) };
}

/** Bounding box of the pixels that are part of the subject (alpha above a small threshold). */
export function findSubjectBox(cutout: HTMLCanvasElement): Rect | null {
  const w = cutout.width;
  const h = cutout.height;
  const { data } = cutout.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h);
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
