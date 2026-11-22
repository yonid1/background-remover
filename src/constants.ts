import type { BgSettings, GradientDir } from './types';

/**
 * The model used by @imgly/background-removal. 'isnet_fp16' (~88 MB) is the library default.
 * In testing, 'isnet_quint8' was much slower (about 30 s per image) and the full 'isnet'
 * doubled the download without a visible gain.
 */
export const MODEL = 'isnet_fp16';

/** Larger photos are scaled down so the browser doesn't run out of memory. */
export const MAX_SIDE = 5000;

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

/** Crop shapes: value is width / height, 0 means free. */
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
