import type { RemovalProgress, RemovalState } from '../types';

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(0)}MB`;

const PHASE_TEXT: Record<RemovalProgress['phase'], string> = {
  loading: 'טוענים את כלי ההסרה…',
  download: 'מורידים את מודל הבינה המלאכותית (רק בפעם הראשונה)…',
  preparing: 'מכינים את המודל…',
  removing: 'מסירים את הרקע…',
};

interface Props {
  removal: RemovalState;
  onRetry: () => void;
}

/** Covers the preview while the background is being removed, or when that failed. */
export function StatusOverlay({ removal, onRetry }: Props) {
  if (removal.status === 'idle' || removal.status === 'done') return null;

  if (removal.status === 'error') {
    return (
      <div className="overlay">
        <div className="card error">
          <div className="status-text">
            {removal.offline ? 'לא הצלחנו להוריד את מודל הבינה המלאכותית.' : 'משהו השתבש בהסרת הרקע.'}
          </div>
          <div className="status-sub">
            {removal.offline ? 'צריך חיבור לאינטרנט בשימוש הראשון. כדאי לבדוק את החיבור ולנסות שוב.' : removal.detail}
          </div>
          <button className="btn primary mt-14" type="button" onClick={onRetry}>
            לנסות שוב
          </button>
        </div>
      </div>
    );
  }

  const p = removal.progress;
  const fraction = p.phase === 'download' ? p.done / p.total : null;
  return (
    <div className="overlay">
      <div className="card">
        <div className="spinner" />
        <div className="status-text">{PHASE_TEXT[p.phase]}</div>
        <div className="status-sub">{p.phase === 'download' ? `${mb(p.done)} מתוך ${mb(p.total)}` : ''}</div>
        <div className={fraction === null ? 'progress indeterminate' : 'progress'}>
          <div className="bar" style={fraction === null ? undefined : { width: `${Math.round(fraction * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
