import type { Item } from '../types';
import { CloseIcon, PlusIcon } from './icons';

const STATUS_TEXT: Record<Item['status'], string> = {
  pending: 'ממתינה בתור',
  working: 'בעיבוד',
  done: 'מוכנה',
  error: 'נכשלה',
};

interface Props {
  items: Item[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

/** The row of opened photos under the preview: pick one to work on, remove, or add more. */
export function Filmstrip({ items, currentId, onSelect, onRemove, onAdd }: Props) {
  return (
    <div className="filmstrip" role="list" aria-label="התמונות שנפתחו">
      {items.map((it) => (
        <div key={it.id} role="listitem" className={it.id === currentId ? 'film-item current' : 'film-item'}>
          <button
            type="button"
            className="film-thumb"
            aria-current={it.id === currentId}
            aria-label={`${it.name}: ${STATUS_TEXT[it.status]}`}
            title={`${it.name}: ${STATUS_TEXT[it.status]}`}
            onClick={() => onSelect(it.id)}
          >
            <img src={it.thumb} alt="" />
            <span className={`film-status ${it.status}`} aria-hidden="true">
              {it.status === 'done' ? '✓' : it.status === 'error' ? '!' : ''}
            </span>
          </button>
          <button
            type="button"
            className="film-remove"
            aria-label={`הסרת ${it.name} מהרשימה`}
            title="הסרה מהרשימה"
            onClick={() => onRemove(it.id)}
          >
            <CloseIcon />
          </button>
        </div>
      ))}
      <button type="button" className="film-add" aria-label="הוספת תמונות" title="הוספת תמונות" onClick={onAdd}>
        <PlusIcon />
      </button>
    </div>
  );
}
