import { useEffect, useState } from 'react';
import type { Theme } from '../types';

const KEY = 'background-remover:theme';
const ORDER: Theme[] = ['auto', 'light', 'dark'];

/**
 * Light, dark, or following the system setting. The choice is remembered and applied as
 * <html data-theme="...">, which index.css uses to pick its colors.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY) as Theme | null;
    return saved && ORDER.includes(saved) ? saved : 'auto';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // Not remembered in private browsing; that's fine.
    }
  }, [theme]);

  const cycle = () => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]);
  return [theme, cycle];
}
