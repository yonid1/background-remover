import { CROP_RATIOS } from '../constants';
import type { Framing } from '../types';
import { Range } from './Range';

interface Props {
  /** The background has been removed, so cropping is available. */
  ready: boolean;
  editing: boolean;
  hasCrop: boolean;
  ratio: number;
  canFit: boolean;
  framing: Framing;
  onFraming: (patch: Partial<Framing>) => void;
  onStart: () => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
  onRatio: (ratio: number) => void;
  onFit: () => void;
}

function RatioChips({ value, onChange }: { value: number; onChange: (ratio: number) => void }) {
  return (
    <div className="chips" role="group" aria-label="יחס גובה-רוחב">
      {CROP_RATIOS.map((r) => (
        <button
          key={r.label}
          type="button"
          title={r.title}
          aria-pressed={Math.abs(r.value - value) < 1e-6}
          onClick={() => onChange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function CropSection(p: Props) {
  return (
    <section>
      <h2>חיתוך ומסגרת</h2>

      {!p.framing.on &&
        (!p.editing ? (
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
            <RatioChips value={p.ratio} onChange={p.onRatio} />
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
        ))}

      {!p.editing && (
        <>
          <label className="switch-row mt-14">
            <input
              type="checkbox"
              className="switch"
              checked={p.framing.on}
              onChange={(e) => p.onFraming({ on: e.target.checked })}
            />
            <span>מרכוז האובייקט עם שוליים</span>
          </label>
          {p.framing.on && (
            <div className="sub-controls">
              <p className="hint flush">
                התמונה נבנית סביב האובייקט, גם מעבר לקצוות של התמונה המקורית. מתאים לתמונות מוצר ופרופיל. חל על כל
                התמונות.
              </p>
              <Range label="שוליים" min={0} max={60} value={p.framing.padding} onChange={(padding) => p.onFraming({ padding })} />
              <div className="field-label">צורה</div>
              <RatioChips value={p.framing.ratio} onChange={(ratio) => p.onFraming({ ratio })} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
