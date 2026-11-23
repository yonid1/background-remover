import type { BrushMode } from '../types';
import { Range } from './Range';

interface Props {
  /** The background has been removed, so there's something to touch up. */
  ready: boolean;
  active: boolean;
  mode: BrushMode;
  size: number;
  onStart: () => void;
  onDone: () => void;
  onMode: (mode: BrushMode) => void;
  onSize: (size: number) => void;
}

export function BrushSection(p: Props) {
  return (
    <section>
      <h2>תיקון ידני</h2>
      {!p.active ? (
        <>
          <button className="btn block" type="button" disabled={!p.ready} onClick={p.onStart}>
            תיקון עם מברשת
          </button>
          <p className="hint">למחוק שאריות של רקע, או להחזיר חלקים שהמודל הוריד בטעות.</p>
        </>
      ) : (
        <>
          <div className="chips two" role="group" aria-label="סוג המברשת">
            <button type="button" aria-pressed={p.mode === 'erase'} onClick={() => p.onMode('erase')}>
              מחיקה
            </button>
            <button type="button" aria-pressed={p.mode === 'restore'} onClick={() => p.onMode('restore')}>
              שחזור
            </button>
          </div>
          <Range label="גודל המברשת" min={1} max={100} value={p.size} onChange={p.onSize} />
          <p className="hint">
            מורחים על התמונה. התמונה המקורית מוצגת בשקיפות, כדי שיהיה קל לראות מה להחזיר. כל משיכה אפשר לבטל עם
            כפתור הביטול למעלה.
          </p>
          <button className="btn primary block mt-10" type="button" onClick={p.onDone}>
            סיום התיקון
          </button>
        </>
      )}
    </section>
  );
}
