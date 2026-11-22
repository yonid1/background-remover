import { useCallback, useEffect, useState } from 'react';

/** A short message shown at the bottom of the preview for a few seconds. */
export function useToast(durationMs = 7000): [string | null, (text: string) => void] {
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  const show = useCallback((text: string) => setToast({ text, id: Date.now() }), []);
  return [toast?.text ?? null, show];
}
