import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  /** Re-run the loader, e.g. after a write. */
  reload: () => void;
}

/**
 * Runs an async service call and tracks loading/error state.
 *
 * Guards against setting state after unmount and against a slow earlier
 * request overwriting a faster later one — which matters here because
 * switching accounts fires several service calls at once.
 *
 * `deps` is the dependency list for the loader, same contract as useEffect.
 */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  // Monotonic request id — only the newest request may write state.
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(undefined);

    loader()
      .then((result) => {
        if (!mounted.current || id !== requestId.current) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted.current || id !== requestId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
    // `loader` is intentionally excluded — callers pass an inline closure, and
    // `deps` is the caller's declaration of what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}
