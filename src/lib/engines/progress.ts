import type { RemovalProgress } from '../../types';

/**
 * Adds up download progress reported per file, and turns it into one progress value:
 * "download" while bytes are still coming in, "preparing" once everything is here.
 */
export function downloadTracker(onProgress: (p: RemovalProgress) => void) {
  const files = new Map<string, [number, number]>();
  return (file: string, loaded: number, total: number) => {
    files.set(file, [loaded, total]);
    let done = 0;
    let all = 0;
    for (const [l, t] of files.values()) {
      done += l;
      all += t;
    }
    onProgress(done < all ? { phase: 'download', done, total: all } : { phase: 'preparing' });
  };
}
