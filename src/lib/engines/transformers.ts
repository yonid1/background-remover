import type { TransformersSetup } from '../../constants';
import type { RemovalProgress } from '../../types';
import { downloadTracker } from './progress';

/**
 * Models that run through Transformers.js on WebGPU (RMBG-1.4, MODNet, BiRefNet Lite).
 * Follows each model card's usage: processor → model → a 0–1 mask (after a sigmoid where
 * the model outputs raw scores). Transformers.js keeps downloaded files in Cache Storage.
 *
 * Pinned to Transformers.js 3.8: in testing on a Mac, 4.3's newer WebGPU runtime failed on
 * BiRefNet, and 3.8 ran RMBG-1.4 and MODNet fine.
 */

type TF = typeof import('@huggingface/transformers');
type Loaded = {
  model: Awaited<ReturnType<TF['AutoModel']['from_pretrained']>>;
  processor: Awaited<ReturnType<TF['AutoProcessor']['from_pretrained']>>;
};

let tfPromise: Promise<TF> | null = null;
function loadTransformers(): Promise<TF> {
  tfPromise ??= import('@huggingface/transformers')
    .then((tf) => {
      tf.env.allowLocalModels = false; // always fetch from the Hugging Face hub
      return tf;
    })
    .catch((err) => {
      tfPromise = null;
      throw err;
    });
  return tfPromise;
}

// Only one of these models is kept loaded; switching frees the previous one's GPU memory.
let loaded: { repo: string; promise: Promise<Loaded> } | null = null;
// Download progress goes to whichever removal is currently waiting for the model.
let onDownload: ((file: string, loaded: number, total: number) => void) | null = null;
// After a failed run on the GPU, the shared runtime stays broken until the page reloads.
let broken = false;

/**
 * Frees the loaded model's GPU memory (when switching to ISNet). In testing, ISNet's first
 * run after a Transformers.js model had used the GPU took over a minute instead of seconds.
 */
export function releaseTransformersModel() {
  if (!loaded) return;
  loaded.promise.then((m) => m.model.dispose()).catch(() => {});
  loaded = null;
}

async function supportsHalfPrecision(): Promise<boolean> {
  const adapter = await navigator.gpu?.requestAdapter();
  return !!adapter?.features.has('shader-f16');
}

function loadModel(tf: TF, setup: TransformersSetup): Promise<Loaded> {
  if (loaded?.repo === setup.repo) return loaded.promise;
  if (loaded) loaded.promise.then((m) => m.model.dispose()).catch(() => {});

  const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status === 'progress' && p.file && p.total) onDownload?.(p.file, p.loaded ?? 0, p.total);
  };
  const promise = (setup.dtype === 'fp16' ? supportsHalfPrecision() : Promise.resolve(false)).then(async (fp16) => {
    const [model, processor] = await Promise.all([
      tf.AutoModel.from_pretrained(setup.repo, {
        device: 'webgpu',
        dtype: fp16 ? 'fp16' : 'fp32',
        ...(setup.modelConfig ? { config: setup.modelConfig as never } : {}),
        progress_callback,
      }),
      tf.AutoProcessor.from_pretrained(setup.repo, {
        ...(setup.processorConfig ? { config: setup.processorConfig as never } : {}),
        progress_callback,
      }),
    ]);
    return { model, processor };
  });
  const entry = { repo: setup.repo, promise };
  loaded = entry;
  promise.catch(() => {
    if (loaded === entry) loaded = null;
  });
  return promise;
}

/** Returns the subject on a transparent background, the same size as `original`. */
export async function removeWithTransformers(
  setup: TransformersSetup,
  original: HTMLCanvasElement,
  onProgress: (p: RemovalProgress) => void,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  if (!('gpu' in navigator)) throw new Error('המודל הזה צריך דפדפן עם WebGPU, כמו כרום עדכני.');
  if (broken) throw new Error('אחרי השגיאה הקודמת צריך לרענן את הדף (⌘R או F5) לפני שמנסים שוב מודל כזה.');
  onProgress({ phase: 'loading' });
  const tf = await loadTransformers();
  signal.throwIfAborted();

  const track = downloadTracker(onProgress);
  onDownload = (file, l, t) => {
    if (!signal.aborted) track(file, l, t);
  };
  let model: Loaded['model'];
  let processor: Loaded['processor'];
  try {
    ({ model, processor } = await loadModel(tf, setup));
  } finally {
    onDownload = null;
  }
  signal.throwIfAborted();
  onProgress({ phase: 'removing' });

  // Resize on a canvas first: much faster than letting the processor resize a big photo.
  const s = setup.size;
  const fit = Math.min(1, s / Math.max(original.width, original.height));
  const input = document.createElement('canvas');
  input.width = setup.input === 'square' ? s : Math.max(1, Math.round(original.width * fit));
  input.height = setup.input === 'square' ? s : Math.max(1, Math.round(original.height * fit));
  const ictx = input.getContext('2d', { willReadFrequently: true })!;
  ictx.imageSmoothingQuality = 'high';
  ictx.drawImage(original, 0, 0, input.width, input.height);

  let maskData: Uint8Array;
  let mw: number;
  let mh: number;
  try {
    const { pixel_values } = await processor(tf.RawImage.fromCanvas(input));
    const session = Object.values(model.sessions as Record<string, { inputNames: string[]; outputNames: string[] }>)[0];
    const outputs = await model({ [session.inputNames[0]]: pixel_values });
    const out = outputs[session.outputNames[0]];
    const mask = (setup.sigmoid ? out[0].sigmoid() : out[0]).mul(255).to('uint8');
    [mh, mw] = mask.dims.slice(-2) as [number, number];
    maskData = mask.data as Uint8Array;
    pixel_values.dispose();
    out.dispose();
    mask.dispose();
  } catch (err) {
    console.error(err);
    broken = true;
    throw new Error('המודל הזה לא הצליח לרוץ על כרטיס המסך במחשב הזה. אפשר לבחור מודל אחר (ולרענן את הדף).');
  }
  signal.throwIfAborted();

  // The mask as an alpha-only image, stretched back over the photo.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mw;
  maskCanvas.height = mh;
  const mctx = maskCanvas.getContext('2d')!;
  const img = mctx.createImageData(mw, mh);
  for (let i = 0; i < mw * mh; i++) img.data[i * 4 + 3] = maskData[i];
  mctx.putImageData(img, 0, 0);

  const cutout = document.createElement('canvas');
  cutout.width = original.width;
  cutout.height = original.height;
  const cctx = cutout.getContext('2d', { willReadFrequently: true })!;
  cctx.drawImage(original, 0, 0);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.imageSmoothingQuality = 'high';
  cctx.drawImage(maskCanvas, 0, 0, cutout.width, cutout.height);
  cctx.globalCompositeOperation = 'source-over';
  return cutout;
}
