/** A rectangle in image pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

export type BgType = 'transparent' | 'color' | 'gradient' | 'blur' | 'image';

/** Compass direction from the first gradient color to the second, or a radial gradient. */
export type GradientDir = 'nw' | 'n' | 'ne' | 'w' | 'radial' | 'e' | 'sw' | 's' | 'se';

export interface BackgroundImage {
  el: HTMLImageElement;
  /** Object URL of the file, also used for the thumbnail. Revoke it when the image is replaced. */
  url: string;
}

export interface BgSettings {
  type: BgType;
  color: string;
  g1: string;
  g2: string;
  gDir: GradientDir;
  /** 1–100 */
  blur: number;
  image: BackgroundImage | null;
}

/** Effects applied to the cut-out subject. Sizes are relative to the image (see compose.ts). */
export interface Effects {
  shadow: boolean;
  /** 1–100: how big and soft the shadow is. */
  shadowSize: number;
  /** 0–100: how dark the shadow is. */
  shadowOpacity: number;
  outline: boolean;
  outlineColor: string;
  /** 1–40: outline thickness. */
  outlineWidth: number;
}

/** "Center with padding": the output frame is built around the subject instead of cropped. */
export interface Framing {
  on: boolean;
  /** 0–60: space around the subject, as a percentage of its longest side. */
  padding: number;
  /** width / height, or 0 to follow the subject's own shape. */
  ratio: number;
}

/** Settings shared by all images. Undo/redo tracks changes to these. */
export interface DocSettings {
  bg: BgSettings;
  effects: Effects;
  framing: Framing;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface ExportSettings {
  format: ExportFormat;
  /** Longest side of the saved image in pixels, or 0 for the original size. */
  maxSide: number;
}

export type ModelId = 'isnet' | 'rmbg' | 'modnet' | 'birefnet-lite';

export type Theme = 'auto' | 'light' | 'dark';

export type BrushMode = 'erase' | 'restore';

export type RemovalProgress =
  | { phase: 'queued' }
  | { phase: 'loading' }
  | { phase: 'download'; done: number; total: number }
  | { phase: 'preparing' }
  | { phase: 'removing' };

/** One opened photo and everything done to it. */
export interface Item {
  id: string;
  /** File name without the extension, used for the saved file. */
  name: string;
  /** The photo at its working size (large photos are scaled down). */
  original: HTMLCanvasElement;
  /** Small preview for the list of photos. */
  thumb: string;
  scaledDown: boolean;
  status: 'pending' | 'working' | 'done' | 'error';
  progress: RemovalProgress;
  error: { offline: boolean; detail: string } | null;
  /** The subject on a transparent background. The touch-up brush edits it in place. */
  cutout: HTMLCanvasElement | null;
  /** Bumped whenever `cutout` is edited in place, so the preview redraws. */
  version: number;
  /** Bounding box of the subject, or null if nothing was found. */
  subjectBox: Rect | null;
  /** Applied crop, or null for the whole image. */
  crop: Rect | null;
}

export type HistoryEntry =
  | { kind: 'settings'; before: DocSettings; after: DocSettings }
  | { kind: 'crop'; itemId: string; before: Rect | null; after: Rect | null }
  | {
      kind: 'mask';
      itemId: string;
      /** Where the patches go in the cutout. */
      x: number;
      y: number;
      before: HTMLCanvasElement;
      after: HTMLCanvasElement;
    };
