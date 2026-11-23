import { useCallback, useRef, useState } from 'react';
import { HISTORY_LIMIT } from '../constants';
import type { HistoryEntry } from '../types';

/**
 * Undo/redo stacks. `apply` performs an entry in the given direction; the caller decides
 * what each kind of entry means (settings, a crop, a brush stroke).
 */
export function useHistory(apply: (entry: HistoryEntry, direction: 'undo' | 'redo') => void) {
  const past = useRef<HistoryEntry[]>([]);
  const future = useRef<HistoryEntry[]>([]);
  const [, setVersion] = useState(0);
  const changed = () => setVersion((v) => v + 1);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const push = useCallback((entry: HistoryEntry) => {
    past.current.push(entry);
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    changed();
  }, []);

  const undo = useCallback(() => {
    const entry = past.current.pop();
    if (!entry) return;
    applyRef.current(entry, 'undo');
    future.current.push(entry);
    changed();
  }, []);

  const redo = useCallback(() => {
    const entry = future.current.pop();
    if (!entry) return;
    applyRef.current(entry, 'redo');
    past.current.push(entry);
    changed();
  }, []);

  /** Drops entries that no longer make sense (for example, edits to a removed photo). */
  const forget = useCallback((drop: (entry: HistoryEntry) => boolean) => {
    past.current = past.current.filter((e) => !drop(e));
    future.current = future.current.filter((e) => !drop(e));
    changed();
  }, []);

  return {
    push,
    undo,
    redo,
    forget,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
