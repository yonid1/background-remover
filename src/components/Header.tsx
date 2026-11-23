import type { ReactNode } from 'react';
import type { Theme } from '../types';
import { AutoThemeIcon, MoonIcon, RedoIcon, SunIcon, UndoIcon } from './icons';

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? '⌘' : 'Ctrl+';

const THEMES: Record<Theme, { label: string; icon: ReactNode }> = {
  auto: { label: 'מצב תצוגה: לפי הגדרות המערכת', icon: <AutoThemeIcon /> },
  light: { label: 'מצב תצוגה: בהיר', icon: <SunIcon /> },
  dark: { label: 'מצב תצוגה: כהה', icon: <MoonIcon /> },
};

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  theme: Theme;
  onTheme: () => void;
}

export function Header(p: Props) {
  return (
    <header className="app-header">
      <h1>מסיר רקע</h1>
      <p>מסירים את הרקע מתמונה ומחליפים אותו בצבע, מעבר צבעים, טשטוש או תמונה אחרת.</p>
      <div className="header-actions">
        <button
          className="btn icon-only flip-rtl"
          type="button"
          title={`ביטול הפעולה האחרונה (${mod}Z)`}
          aria-label="ביטול הפעולה האחרונה"
          disabled={!p.canUndo}
          onClick={p.onUndo}
        >
          <UndoIcon />
        </button>
        <button
          className="btn icon-only flip-rtl"
          type="button"
          title={`ביצוע מחדש (${mod}${isMac ? '⇧Z' : 'Y'})`}
          aria-label="ביצוע מחדש"
          disabled={!p.canRedo}
          onClick={p.onRedo}
        >
          <RedoIcon />
        </button>
        <button
          className="btn icon-only"
          type="button"
          title={`${THEMES[p.theme].label}. לחיצה מחליפה.`}
          aria-label={THEMES[p.theme].label}
          onClick={p.onTheme}
        >
          {THEMES[p.theme].icon}
        </button>
      </div>
    </header>
  );
}
