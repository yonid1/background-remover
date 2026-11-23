import { EXPORT_FORMATS, EXPORT_SIZES } from '../constants';
import type { ExportFormat, ExportSettings } from '../types';

// What this browser can do. Sharing files is mostly available on phones (and Safari on Mac).
const canCopy = typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';
const canShare =
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [new File([''], 'test.png', { type: 'image/png' })] });

interface Props {
  ready: boolean;
  /** JPG can't keep a transparent background. */
  transparent: boolean;
  settings: ExportSettings;
  /** The format that will actually be used (PNG instead of JPG when the result is transparent). */
  format: ExportFormat;
  onSettings: (patch: Partial<ExportSettings>) => void;
  onCompare: (showOriginal: boolean) => void;
  onDownload: () => void;
  onCopy: () => void;
  onShare: () => void;
}

export function ExportSection(p: Props) {
  const release = () => p.onCompare(false);

  return (
    <section>
      <h2>שמירה</h2>
      <button
        className="btn block"
        type="button"
        disabled={!p.ready}
        onPointerDown={(e) => {
          e.preventDefault();
          p.onCompare(true);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            p.onCompare(true);
          }
        }}
        onKeyUp={release}
      >
        החזיקו לחוץ כדי לראות את המקור
      </button>

      <div className="field-label">פורמט</div>
      <div className="chips three" role="group" aria-label="פורמט הקובץ">
        {EXPORT_FORMATS.map((f) => {
          const blocked = f.id === 'jpeg' && p.transparent;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={p.format === f.id}
              disabled={blocked}
              title={blocked ? 'קובץ JPG לא יכול להיות שקוף. כדאי לבחור רקע, או לשמור כ-PNG או WEBP.' : undefined}
              onClick={() => p.onSettings({ format: f.id })}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <label className="field mt-10">
        גודל
        <select value={p.settings.maxSide} onChange={(e) => p.onSettings({ maxSide: Number(e.target.value) })}>
          {EXPORT_SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="row mt-10">
        <button className="btn primary" type="button" disabled={!p.ready} onClick={p.onDownload}>
          הורדה
        </button>
        {canCopy && (
          <button className="btn" type="button" disabled={!p.ready} onClick={p.onCopy}>
            העתקה
          </button>
        )}
      </div>
      {canShare && (
        <button className="btn block mt-8" type="button" disabled={!p.ready} onClick={p.onShare}>
          שיתוף או שמירה לתמונות
        </button>
      )}
    </section>
  );
}
