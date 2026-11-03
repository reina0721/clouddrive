'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useAuth } from './context';
import { safeReturnTo } from './contract';
function AuthLoadingSurface() {
  const { t } = useFrontendTranslation();
  return (
    <main id="main-content" className="grid min-h-screen place-items-center bg-canvas p-6">
      <p role="status" className="text-sm text-ink-muted">
        {t('auth.loading')}
      </p>
    </main>
  );
}
// Authorized application pages do not need the authentication brand/form surface.
const AuthStatusSurface = dynamic(
  () => import('./status-surface').then((module) => module.AuthStatusSurface),
  { ssr: false, loading: AuthLoadingSurface },
);
const RequiredPasswordChange = dynamic(
  () => import('./required-password-change').then((module) => module.RequiredPasswordChange),
  { ssr: false, loading: AuthLoadingSurface },
);

export function ProtectedGate({ children }: Readonly<{ children: ReactNode }>) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status !== 'anonymous') return;
    const destination = safeReturnTo(location.pathname + location.search + location.hash);
    router.replace(
      `${auth.endReason === 'expired' ? '/session-expired' : '/login'}?returnTo=${encodeURIComponent(destination)}`,
    );
  }, [auth.status, auth.endReason, router]);
  return auth.status === 'authenticated' && auth.session ? (
    auth.session.mustChangePassword ? (
      <RequiredPasswordChange />
    ) : (
      children
    )
  ) : (
    <AuthStatusSurface />
  );
}

export function GuestGate({ children }: Readonly<{ children: ReactNode }>) {
  const auth = useAuth();
  const params = useSearchParams();
  const target = safeReturnTo(params.get('returnTo'));
  useEffect(() => {
    if (auth.status === 'authenticated' && auth.authenticatedFrom === 'restore')
      window.location.replace(target);
  }, [auth.status, auth.authenticatedFrom, target]);
  return auth.status === 'anonymous' ||
    (auth.status === 'authenticated' && auth.authenticatedFrom !== 'restore') ? (
    children
  ) : (
    <AuthStatusSurface />
  );
}
