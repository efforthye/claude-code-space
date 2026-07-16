// Minimal data-fetching hook: loading/error/data + refetch, with optional
// polling. Dependency-free stand-in for react-query at this app's scale.

import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
  /** Poll every N ms while mounted (e.g. live job progress). */
  pollMs?: number;
  /** Skip fetching when false. */
  enabled?: boolean;
  /** Re-run the query when any of these change (e.g. a route id). */
  deps?: ReadonlyArray<unknown>;
};

export type QueryResult<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

export function useQuery<T>(fn: () => Promise<T>, options: Options = {}): QueryResult<T> {
  const { pollMs, enabled = true, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);

  const fnRef = useRef(fn);
  fnRef.current = fn;
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const result = await fnRef.current();
      if (aliveRef.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (aliveRef.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        aliveRef.current = false;
      };
    }
    setLoading(true);
    load();
    let timer: ReturnType<typeof setInterval> | undefined;
    if (pollMs && pollMs > 0) {
      timer = setInterval(load, pollMs);
    }
    return () => {
      aliveRef.current = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollMs, load, ...deps]);

  return { data, error, loading, refetch: load };
}
