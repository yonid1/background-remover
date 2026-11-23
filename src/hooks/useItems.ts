import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { OpenedImage } from '../lib/image';
import { isNetworkError, removeBackgroundFrom } from '../lib/removal';
import type { Item, ModelId } from '../types';

type Action =
  | { type: 'add'; items: Item[] }
  | { type: 'remove'; id: string }
  | { type: 'patch'; id: string; patch: Partial<Item> }
  /** The cutout was edited in place: bump its version so the preview redraws. */
  | { type: 'bump'; id: string }
  /** Process again: one photo after an error, or every photo after the model changed. */
  | { type: 'requeue'; id?: string };

function reducer(items: Item[], action: Action): Item[] {
  switch (action.type) {
    case 'add':
      return [...items, ...action.items];
    case 'remove':
      return items.filter((i) => i.id !== action.id);
    case 'patch':
      return items.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i));
    case 'bump':
      return items.map((i) => (i.id === action.id ? { ...i, version: i.version + 1 } : i));
    case 'requeue':
      return items.map((i) =>
        action.id === undefined || i.id === action.id
          ? { ...i, status: 'pending', progress: { phase: 'queued' }, error: null, cutout: null, subjectBox: null }
          : i,
      );
  }
}

let nextId = 1;

/**
 * The list of opened photos, processed one after another with the chosen model.
 * Removing a photo (or changing the model) stops its processing.
 */
export function useItems(model: ModelId) {
  const [items, dispatch] = useReducer(reducer, []);
  const running = useRef<{ id: string; controller: AbortController } | null>(null);

  // Start the next photo in line whenever nothing is being processed.
  useEffect(() => {
    if (running.current) return;
    const next = items.find((i) => i.status === 'pending');
    if (!next) return;

    const controller = new AbortController();
    const { signal } = controller;
    running.current = { id: next.id, controller };
    dispatch({ type: 'patch', id: next.id, patch: { status: 'working', progress: { phase: 'loading' } } });

    removeBackgroundFrom(model, next.original, (progress) => dispatch({ type: 'patch', id: next.id, patch: { progress } }), signal)
      .then(({ cutout, subjectBox }) => {
        if (signal.aborted) return;
        dispatch({ type: 'patch', id: next.id, patch: { status: 'done', cutout, subjectBox, version: next.version + 1 } });
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        console.error(err);
        dispatch({
          type: 'patch',
          id: next.id,
          patch: {
            status: 'error',
            error: { offline: isNetworkError(err), detail: String((err as Error | undefined)?.message ?? err) },
          },
        });
      })
      .finally(() => {
        if (running.current?.controller === controller) running.current = null;
        // Wake the effect up for the next photo (the state change above may have been skipped).
        dispatch({ type: 'patch', id: next.id, patch: {} });
      });
  }, [items, model]);

  // A different model means every photo is processed again.
  const firstModel = useRef(model);
  useEffect(() => {
    if (firstModel.current === model) return;
    firstModel.current = model;
    running.current?.controller.abort();
    running.current = null;
    dispatch({ type: 'requeue' });
  }, [model]);

  const add = useCallback((opened: OpenedImage[]) => {
    const created: Item[] = opened.map((o) => ({
      id: `img-${nextId++}`,
      name: o.name,
      original: o.original,
      thumb: o.thumb,
      scaledDown: o.scaledDown,
      status: 'pending',
      progress: { phase: 'queued' },
      error: null,
      cutout: null,
      version: 0,
      subjectBox: null,
      crop: null,
    }));
    dispatch({ type: 'add', items: created });
    return created;
  }, []);

  const remove = useCallback((id: string) => {
    if (running.current?.id === id) {
      running.current.controller.abort();
      running.current = null;
    }
    dispatch({ type: 'remove', id });
  }, []);

  const patch = useCallback((id: string, p: Partial<Item>) => dispatch({ type: 'patch', id, patch: p }), []);
  const retry = useCallback((id: string) => dispatch({ type: 'requeue', id }), []);
  const bump = useCallback((id: string) => dispatch({ type: 'bump', id }), []);

  return { items, add, remove, patch, retry, bump };
}
