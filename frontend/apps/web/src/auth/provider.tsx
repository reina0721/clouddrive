'use client';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { AppLoadingSurface } from '../host/app-loading-surface';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { loadAdministrationMessages } from '@clouddrive/surface/shell';
import { appI18n } from '../i18n/i18n';

function AuthBootSurface() {
  const { t } = useFrontendTranslation();
  return <AppLoadingSurface label={t('common.appLoading')} />;
}

// The browser session runtime loads after the shared Host boot/hydration surface.
const AuthRuntime = dynamic(
  async () => {
    const [module, messages] = await Promise.all([
      import('./runtime'),
      loadAdministrationMessages(),
    ]);
    appI18n.addResources(messages);
    return module.AuthRuntime;
  },
  {
    ssr: false,
    loading: AuthBootSurface,
  },
);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthRuntime>{children}</AuthRuntime>;
}
