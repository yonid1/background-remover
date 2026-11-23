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

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export interface ExportSettings {
  format: ExportFormat;
  /** Longest side of the saved image in pixels, or 0 for the original size. */
  maxSide: number;
}

/** A photo the user opened, ready to be processed. */
export interface LoadedImage {
  /** The photo drawn at its working size (large photos are scaled down). */
  canvas: HTMLCanvasElement;
  /** Raw RGBA pixels of `canvas`, in the format the model library accepts. */
  pixels: Blob;
  /** File name without the extension, used for the downloaded file. */
  name: string;
  scaledDown: boolean;
}

export type RemovalProgress =
  | { phase: 'loading' }
  | { phase: 'download'; done: number; total: number }
  | { phase: 'preparing' }
  | { phase: 'removing' };

export type RemovalState =
  | { status: 'idle' }
  | { status: 'working'; progress: RemovalProgress }
  | { status: 'done'; cutout: HTMLCanvasElement; subjectBox: Rect | null }
  | { status: 'error'; offline: boolean; detail: string };
