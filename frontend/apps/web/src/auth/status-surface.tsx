'use client';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useAuth } from './context';
import { AuthFrame } from './frame';
import { AlertTriangle } from 'lucide-react';

export function AuthStatusSurface() {
  const auth = useAuth();
  const { t } = useFrontendTranslation();
  const failed = auth.status === 'error';
  return (
    <AuthFrame>
      <Page>
        <PageHeader
          title={t(failed ? 'auth.errorTitle' : 'auth.restoringTitle')}
          description={t(failed ? 'auth.errorDescription' : 'auth.restoringDescription')}
        />
        {failed ? (
          <AlertBanner
            title={t(`auth.errors.${auth.error ?? 'unavailable'}`)}
            description={t('auth.errorDescription')}
            icon={<AlertTriangle aria-hidden="true" className="size-4" />}
            tone="danger"
            announcement="urgent"
            actionLabel={t('auth.retry')}
            onAction={() => {
              if (auth.failedOperation === 'logout') void auth.logout();
              else void auth.restore();
            }}
          />
        ) : (
          <p role="status" className="text-sm text-ink-muted">
            {t('auth.loading')}
          </p>
        )}
      </Page>
    </AuthFrame>
  );
}
