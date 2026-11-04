'use client';
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { PublicFilesProvider } from '@clouddrive/surface/files/runtime';
import { createPublicFilesRuntime } from './public-backend';
import { AppLoadingSurface } from '../host/app-loading-surface';

export function PublicFilesRuntime({ children }: Readonly<{ children: ReactNode }>) {
  const [token, setToken] = useState<string>();
  useEffect(() => {
    const synchronize = () =>
      setToken(new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
    synchronize();
    window.addEventListener('hashchange', synchronize);
    return () => window.removeEventListener('hashchange', synchronize);
  }, []);
  const runtime = useMemo(() => createPublicFilesRuntime(token ?? ''), [token]);
  useLayoutEffect(() => {
    runtime.activate();
    return () => runtime.dispose();
  }, [runtime]);
  if (token === undefined) return <AppLoadingSurface label="正在读取分享 / Loading share" />;
  return (
    <PublicFilesProvider key={token} port={runtime.port}>
      {children}
    </PublicFilesProvider>
  );
}
