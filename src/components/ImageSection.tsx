const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

export function ImageSection({ onPick }: { onPick: () => void }) {
  return (
    <section>
      <h2>תמונה</h2>
      <button className="btn primary block" type="button" onClick={onPick}>
        בחירת תמונה
      </button>
      <p className="hint">
        אפשר גם לגרור תמונה לאזור התצוגה או להדביק אותה ({isMac ? '⌘V' : 'Ctrl+V'}).
      </p>
    </section>
  );
}
