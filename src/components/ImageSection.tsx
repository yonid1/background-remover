import { MODELS, type ModelInfo } from '../constants';
import { hasWebGPU } from '../lib/removal';
import type { ModelId } from '../types';

const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Why a model can't be used here, or null if it can. */
export function unavailableReason(m: ModelInfo, appleGpu: boolean): string | null {
  if (m.needsWebGPU && !hasWebGPU) return 'לא נתמך בדפדפן הזה';
  if (m.failsOnApple && appleGpu) return 'לא נתמך במק ובאייפון';
  return null;
}

interface Props {
  onPick: () => void;
  model: ModelId;
  onModel: (model: ModelId) => void;
  appleGpu: boolean;
  /** Photos are already open, so changing the model processes them again. */
  hasPhotos: boolean;
}

export function ImageSection({ onPick, model, onModel, appleGpu, hasPhotos }: Props) {
  const current = MODELS.find((m) => m.id === model) ?? MODELS[0];
  return (
    <section>
      <h2>תמונות</h2>
      <button className="btn primary block" type="button" onClick={onPick}>
        בחירת תמונות
      </button>
      <p className="hint">
        אפשר לבחור כמה תמונות בבת אחת, לגרור אותן לאזור התצוגה או להדביק ({isMac ? '⌘V' : 'Ctrl+V'}).
      </p>

      <label className="field mt-14">
        מודל להסרת הרקע
        <select value={model} onChange={(e) => onModel(e.target.value as ModelId)}>
          {MODELS.map((m) => {
            const reason = unavailableReason(m, appleGpu);
            return (
              <option key={m.id} value={m.id} disabled={!!reason}>
                {m.label} ({m.size}){reason ? `, ${reason}` : ''}
              </option>
            );
          })}
        </select>
      </label>
      <p className="hint">
        {current.description} ההורדה ({current.size}) קורית רק בפעם הראשונה שמשתמשים במודל.
        {!hasWebGPU && ' המודלים חוץ מ-ISNet צריכים דפדפן עם WebGPU, כמו כרום עדכני.'}
        {hasPhotos && ' החלפת מודל מעבדת מחדש את כל התמונות.'}
      </p>
    </section>
  );
}
