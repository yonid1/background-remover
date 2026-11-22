export type ExportType = 'image/png' | 'image/jpeg';

interface Props {
  ready: boolean;
  /** JPG can't keep a transparent background. */
  transparent: boolean;
  onCompare: (showOriginal: boolean) => void;
  onDownload: (type: ExportType) => void;
}

export function ExportSection({ ready, transparent, onCompare, onDownload }: Props) {
  const release = () => onCompare(false);

  return (
    <section>
      <h2>שמירה</h2>
      <button
        className="btn block"
        type="button"
        disabled={!ready}
        onPointerDown={(e) => {
          e.preventDefault();
          onCompare(true);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onCompare(true);
          }
        }}
        onKeyUp={release}
      >
        החזיקו לחוץ כדי לראות את המקור
      </button>
      <div className="row mt-8">
        <button className="btn primary" type="button" disabled={!ready} onClick={() => onDownload('image/png')}>
          הורדה כ-PNG
        </button>
        <button
          className="btn"
          type="button"
          disabled={!ready || transparent}
          title={transparent ? 'קובץ JPG לא יכול להיות שקוף. כדאי לבחור רקע או להוריד כ-PNG.' : undefined}
          onClick={() => onDownload('image/jpeg')}
        >
          הורדה כ-JPG
        </button>
      </div>
    </section>
  );
}
