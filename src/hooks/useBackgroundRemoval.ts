import { useCallback, useEffect, useState } from 'react';
import { isNetworkError, removeBackgroundFrom } from '../lib/removal';
import type { LoadedImage, RemovalState } from '../types';

/**
 * Runs background removal whenever `image` changes. A newer image cancels the result of
 * an older one. Returns the current state and a function that runs it again after an error.
 */
export function useBackgroundRemoval(image: LoadedImage | null): [RemovalState, () => void] {
  const [state, setState] = useState<RemovalState>({ status: 'idle' });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!image) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    setState({ status: 'working', progress: { phase: 'loading' } });

    removeBackgroundFrom(image.pixels, (progress) => setState({ status: 'working', progress }), signal)
      .then(({ cutout, subjectBox }) => {
        if (!signal.aborted) setState({ status: 'done', cutout, subjectBox });
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        console.error(err);
        setState({
          status: 'error',
          offline: isNetworkError(err),
          detail: String((err as Error | undefined)?.message ?? err),
        });
      });

    return () => controller.abort();
  }, [image, retryCount]);

  const retry = useCallback(() => setRetryCount((n) => n + 1), []);
  return [state, retry];
}
