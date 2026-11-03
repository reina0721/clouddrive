'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useIdentityPort } from './context';
import { IdentityError } from './errors';
import type { IdentityPort } from './model';

/** Feature-owned async result; old requests never replace a different query or identity revision. */
export function useIdentityQuery<T>(key: string, load: (port: IdentityPort) => Promise<T>) {
  const port = useIdentityPort();
  const revision = useSyncExternalStore(
    (listener) => port.subscribe(listener),
    () => port.getRevision(),
    () => port.getRevision(),
  );
  const [retry, setRetry] = useState(0);
  const scope = `${key}:${port.currentUserId() ?? ''}`;
  const requestKey = `${scope}:${revision}:${retry}`;
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  }, [load]);
  const [result, setResult] = useState<
    Readonly<{ key: string; scope: string; data: T | null; error: IdentityError | null }>
  >({ key: '', scope: '', data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    void loader.current(port).then(
      (data) => {
        if (!cancelled) setResult({ key: requestKey, scope, data, error: null });
      },
      (error: unknown) => {
        if (!cancelled)
          setResult({
            key: requestKey,
            scope,
            data: null,
            error: error instanceof IdentityError ? error : new IdentityError('unavailable'),
          });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [requestKey, scope, port]);
  const loading = result.key !== requestKey;
  return {
    data: loading && result.scope !== scope ? null : result.data,
    error: loading ? null : result.error,
    loading,
    reload: () => setRetry((prior) => prior + 1),
  };
}
