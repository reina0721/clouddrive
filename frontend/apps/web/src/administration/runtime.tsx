'use client';
import { useMemo, useContext, type ReactNode } from 'react';
import { AuthContext, useAuth } from '../auth/context';
import { AdministrationProvider } from '@clouddrive/surface/administration/runtime';
import { readAuthConfig } from '../auth/config';
import { createLazyAdministrationPort } from './lazy-port';
import dynamic from 'next/dynamic';
const AccountPreferencesSync = dynamic(
  () => import('./preferences-sync').then((module) => module.AccountPreferencesSync),
  { ssr: false },
);
export function AdministrationRuntime({ children }: Readonly<{ children: ReactNode }>) {
  const controller = useContext(AuthContext);
  const auth = useAuth();
  const port = useMemo(() => {
    const config = readAuthConfig();
    return config.mode === 'backend'
      ? createLazyAdministrationPort(
          config.apiBaseUrl,
          () => controller?.getState().session?.user.id ?? null,
        )
      : null;
  }, [controller]);
  return (
    <AdministrationProvider port={port}>
      {port && auth.session && !auth.session.mustChangePassword ? (
        <AccountPreferencesSync key={auth.session.user.id} port={port} />
      ) : null}
      {children}
    </AdministrationProvider>
  );
}
