import type { BgSettings, Effects, ExportSettings, Framing, GradientDir, ModelId } from './types';

/** How a Transformers.js model is fed and read (from each model card). */
export interface TransformersSetup {
  repo: string;
  /** 'fp16' falls back to 'fp32' on GPUs without half-precision support. */
  dtype: 'fp16' | 'fp32';
  /**
   * 'square': the photo is stretched to size×size (the model's fixed input).
   * 'fit': the photo is shrunk to fit size×size, keeping its shape; the model's own
   * processor then picks the exact input size.
   */
  input: 'square' | 'fit';
  size: number;
  /** The output is raw scores that still need a sigmoid (otherwise it's already 0–1). */
  sigmoid: boolean;
  modelConfig?: Record<string, unknown>;
  processorConfig?: Record<string, unknown>;
}

export interface ModelInfo {
  id: ModelId;
  label: string;
  /** Download size, shown to the user. */
  size: string;
  description: string;
  /** Which library runs it. */
  engine: 'imgly' | 'transformers';
  transformers?: TransformersSetup;
  /** Too slow without a GPU, so only offered when WebGPU is available. */
  needsWebGPU: boolean;
  /**
   * Fails on Apple GPUs (Mac, iPhone): in testing (Chrome 156, M-series Mac) BiRefNet's
   * WebGPU kernels need 11 storage buffers per shader but Apple GPUs allow 10, with both
   * Transformers.js 3.8 and 4.3; on the CPU it runs out of WebAssembly memory.
   */
  failsOnApple?: boolean;
}

/**
 * The background-removal models to choose from.
 * - ISNet runs through @imgly/background-removal ('isnet_fp16'). In testing, its smaller
 *   'isnet_quint8' was much slower (about 30 s per image) and the full 'isnet' doubled the
 *   download without a visible gain.
 * - The others run through Transformers.js on WebGPU. RMBG-1.4 and MODNet were tested
 *   working on an M-series Mac; BiRefNet Lite could not be tested on a GPU where it runs.
 */
export const MODELS: ModelInfo[] = [
  {
    id: 'isnet',
    label: 'ISNet: מהיר',
    size: '88MB',
    description: 'ברירת המחדל. מהיר ומתאים לרוב התמונות.',
    engine: 'imgly',
    needsWebGPU: false,
  },
  {
    id: 'rmbg',
    label: 'RMBG 1.4: איכותי יותר',
    size: '88MB',
    description:
      'קצוות נקיים יותר ברוב התמונות: אנשים, מוצרים וחיות. של חברת BRIA, ומותר לשימוש לא מסחרי בלבד.',
    engine: 'transformers',
    transformers: {
      repo: 'briaai/RMBG-1.4',
      dtype: 'fp16',
      input: 'square',
      size: 1024,
      sigmoid: false,
      modelConfig: { model_type: 'custom' },
      processorConfig: {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        feature_extractor_type: 'ImageFeatureExtractor',
        image_std: [1, 1, 1],
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: 1024, height: 1024 },
      },
    },
    needsWebGPU: true,
  },
  {
    id: 'modnet',
    label: 'MODNet: לתמונות של אנשים',
    size: '26MB',
    description: 'מתמחה בפורטרטים: שיער וקצוות עדינים של אנשים. פחות מתאים לחפצים ולבעלי חיים.',
    engine: 'transformers',
    transformers: { repo: 'Xenova/modnet', dtype: 'fp32', input: 'fit', size: 1024, sigmoid: false },
    needsWebGPU: true,
  },
  {
    id: 'birefnet-lite',
    label: 'BiRefNet Lite: ניסיוני',
    size: '115MB',
    description:
      'מודל מתקדם עם קצוות מדויקים מאוד. ניסיוני: לא רץ על מק ואייפון, ועל מחשבים אחרים תלוי בכרטיס המסך.',
    engine: 'transformers',
    transformers: { repo: 'onnx-community/BiRefNet_lite-ONNX', dtype: 'fp16', input: 'square', size: 1024, sigmoid: true },
    needsWebGPU: true,
    failsOnApple: true,
  },
];

export const DEFAULT_MODEL: ModelId = 'isnet';

/** Larger photos are scaled down so the browser doesn't run out of memory. */
export const MAX_SIDE = 5000;

/**
 * Safari on iPhone can't draw canvases bigger than 16,777,216 pixels (4096×4096), and the
 * iPhone 15 Pro and later take 24-megapixel photos by default, so the area is capped too.
 */
export const MAX_PIXELS = 16_000_000;

export const SWATCHES = [
  '#ffffff', '#000000', '#f3f4f6', '#9ca3af', '#ef4444', '#f97316', '#facc15', '#22c55e',
  '#14b8a6', '#3b82f6', '#1e3a8a', '#8b5cf6', '#ec4899', '#fde2e4', '#dbeafe', '#dcfce7',
];

export const GRADIENT_PRESETS: [string, string][] = [
  ['#a1c4fd', '#c2e9fb'],
  ['#fbc2eb', '#a6c1ee'],
  ['#f6d365', '#fda085'],
  ['#84fab0', '#8fd3f4'],
  ['#ff9a9e', '#fecfef'],
  ['#434343', '#000000'],
];

/**
 * Gradient directions. `vec` points from the first color to the second in screen
 * coordinates (y grows downward). Listed row by row as they appear in the 3×3 picker.
 */
export const GRADIENT_DIRS: { id: GradientDir; vec: [number, number] | null; name: string }[] = [
  { id: 'nw', vec: [-1, -1], name: 'באלכסון, אל הפינה השמאלית העליונה' },
  { id: 'n', vec: [0, -1], name: 'מלמטה למעלה' },
  { id: 'ne', vec: [1, -1], name: 'באלכסון, אל הפינה הימנית העליונה' },
  { id: 'w', vec: [-1, 0], name: 'מצד ימין לצד שמאל' },
  { id: 'radial', vec: null, name: 'עגול, מהמרכז החוצה' },
  { id: 'e', vec: [1, 0], name: 'מצד שמאל לצד ימין' },
  { id: 'sw', vec: [-1, 1], name: 'באלכסון, אל הפינה השמאלית התחתונה' },
  { id: 's', vec: [0, 1], name: 'מלמעלה למטה' },
  { id: 'se', vec: [1, 1], name: 'באלכסון, אל הפינה הימנית התחתונה' },
];

/** Crop and frame shapes: value is width / height, 0 means free. */
export const CROP_RATIOS: { label: string; value: number; title?: string }[] = [
  { label: 'חופשי', value: 0 },
  { label: '1:1', value: 1, title: 'ריבוע' },
  { label: '4:5', value: 4 / 5, title: 'פוסט לאינסטגרם' },
  { label: '3:4', value: 3 / 4, title: 'לאורך' },
  { label: '4:3', value: 4 / 3, title: 'לרוחב' },
  { label: '9:16', value: 9 / 16, title: 'סטורי' },
  { label: '16:9', value: 16 / 9, title: 'מסך רחב' },
];

export const DEFAULT_BG: BgSettings = {
  type: 'transparent',
  color: '#ffffff',
  g1: GRADIENT_PRESETS[0][0],
  g2: GRADIENT_PRESETS[0][1],
  gDir: 's',
  blur: 30,
  image: null,
};

export const OUTLINE_SWATCHES = ['#ffffff', '#000000', '#facc15', '#4f46e5', '#ec4899'];

export const DEFAULT_EFFECTS: Effects = {
  shadow: false,
  shadowSize: 30,
  shadowOpacity: 45,
  outline: false,
  outlineColor: '#ffffff',
  outlineWidth: 10,
};

export const DEFAULT_FRAMING: Framing = { on: false, padding: 12, ratio: 1 };

export const EXPORT_FORMATS: { id: ExportSettings['format']; label: string }[] = [
  { id: 'png', label: 'PNG' },
  { id: 'jpeg', label: 'JPG' },
  { id: 'webp', label: 'WEBP' },
];

export const EXPORT_SIZES: { value: number; label: string }[] = [
  { value: 0, label: 'גודל מקורי' },
  { value: 2048, label: 'עד 2048 פיקסלים' },
  { value: 1080, label: 'עד 1080 פיקסלים (רשתות חברתיות)' },
];

export const DEFAULT_EXPORT: ExportSettings = { format: 'png', maxSide: 0 };

/** Touch-up brush size: 1–100, as a fraction of the image's longest side (see BrushOverlay). */
export const DEFAULT_BRUSH_SIZE = 25;

/** How many undo steps are kept. */
export const HISTORY_LIMIT = 40;
