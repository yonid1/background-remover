import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

const PREFIX = 'background-remover:';

/**
 * Like useState for a settings object, but remembered in localStorage between visits.
 * Keys in `skip` (things that can't be saved, like an image) are never stored.
 * Settings added in later versions fall back to their defaults.
 */
export function usePersistentState<T extends object>(
  key: string,
  defaults: T,
  skip: readonly (keyof T)[] = [],
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      // Storage blocked or bad data: just use the defaults.
    }
    return defaults;
  });

  const skipKey = skip.join(',');
  useEffect(() => {
    try {
      const copy = { ...value } as Record<string, unknown>;
      for (const k of skipKey ? skipKey.split(',') : []) delete copy[k];
      localStorage.setItem(PREFIX + key, JSON.stringify(copy));
    } catch {
      // Storage full or blocked (private browsing): settings just won't be remembered.
    }
  }, [key, value, skipKey]);

  return [value, setValue];
}
