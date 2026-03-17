import { useState, useEffect, useCallback } from 'react';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseSupabaseQueryOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

export function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[] = [],
  options: UseSupabaseQueryOptions = {}
) {
  const { enabled = true, refetchInterval } = options;

  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: enabled,
    error: null,
  });

  const execute = useCallback(async () => {
    if (!enabled) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await queryFn();
      setState({ data, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState({ data: null, loading: false, error: message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    execute();
  }, [execute]);

  useEffect(() => {
    if (!refetchInterval || !enabled) return;
    const id = setInterval(execute, refetchInterval);
    return () => clearInterval(id);
  }, [execute, refetchInterval, enabled]);

  return { ...state, refetch: execute };
}
