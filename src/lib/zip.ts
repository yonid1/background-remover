import { zipSync } from 'fflate';

/**
 * Packs files into one ZIP. Images are already compressed, so they're stored as-is
 * (level 0), which is much faster and barely bigger.
 */
export async function makeZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const { name, blob } of files) {
    // Two photos with the same name get "name (2).png", "name (3).png", ...
    let unique = name;
    for (let n = 2; used.has(unique); n++) unique = name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    used.add(unique);
    entries[unique] = new Uint8Array(await blob.arrayBuffer());
  }
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped], { type: 'application/zip' });
}
