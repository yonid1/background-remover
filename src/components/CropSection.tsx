import { CROP_RATIOS } from '../constants';

interface Props {
  /** The background has been removed, so cropping is available. */
  ready: boolean;
  editing: boolean;
  hasCrop: boolean;
  ratio: number;
  canFit: boolean;
  onStart: () => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
  onRatio: (ratio: number) => void;
  onFit: () => void;
}

export function CropSection(p: Props) {
  return (
    <section>
      <h2>חיתוך</h2>
      {!p.editing ? (
        <>
          <button className="btn block" type="button" disabled={!p.ready} onClick={p.onStart}>
            חיתוך התמונה
          </button>
          {p.hasCrop && (
            <button className="btn block mt-8" type="button" onClick={p.onReset}>
              ביטול החיתוך (חזרה לתמונה המלאה)
            </button>
          )}
        </>
      ) : (
        <>
          <div className="chips" role="group" aria-label="יחס גובה-רוחב">
            {CROP_RATIOS.map((r) => (
              <button
                key={r.label}
                type="button"
                title={r.title}
                aria-pressed={Math.abs(r.value - p.ratio) < 1e-6}
                onClick={() => p.onRatio(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button className="btn block mt-10" type="button" disabled={!p.canFit} onClick={p.onFit}>
            צמוד לאובייקט
          </button>
          <div className="row mt-8">
            <button className="btn primary" type="button" onClick={p.onApply}>
              אישור
            </button>
            <button className="btn" type="button" onClick={p.onCancel}>
              ביטול
            </button>
          </div>
          <p className="hint">גוררים את המסגרת כדי להזיז אותה, ואת הריבועים הלבנים כדי לשנות את הגודל.</p>
        </>
      )}
    </section>
  );
}
