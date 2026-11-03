'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { readAuthConfig } from './config';

/** Environment disclosure belongs to Host composition, never form behavior. */
export function EnvironmentNotice() {
  const { t } = useFrontendTranslation();
  let demo: boolean;
  try {
    demo = readAuthConfig().mode === 'mock';
  } catch {
    return null;
  }
  if (!demo) return null;
  return (
    <aside className="mt-6 space-y-2 rounded-control bg-surface-muted p-4 text-xs leading-5 text-ink-muted">
      <p className="font-semibold text-ink">{t('auth.demoTitle')}</p>
      <p>{t('auth.demoDescription')}</p>
      <p className="break-all">{t('auth.demoAccount')}</p>
      <p className="break-all">{t('auth.demoPassword')}</p>
    </aside>
  );
}
