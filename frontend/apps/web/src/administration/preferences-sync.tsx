'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { AlertTriangle } from 'lucide-react';
import { useProductAccess } from '@clouddrive/surface/identity/runtime';
import type { AdministrationPort } from '@clouddrive/surface/administration';
import { applyAccountPreferences } from './preferences';

export function AccountPreferencesSync({ port }: Readonly<{ port: AdministrationPort }>) {
  const access = useProductAccess();
  const { t } = useFrontendTranslation();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const allowed =
    access.data?.nativePermissions?.includes('iam:account:self:preferences:read') ?? false;
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    void port.preferences().then(
      (value) => {
        if (active) {
          setFailed(false);
          if (value.version > 0) applyAccountPreferences(value);
        }
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [port, allowed, retry]);
  return failed ? (
    <AlertBanner
      actionLabel={t('administration.retry')}
      onAction={() => setRetry((value) => value + 1)}
      tone="warning"
      title={t('administration.preferencesLoadFailure')}
      description={t('administration.failureDescription')}
      icon={<AlertTriangle aria-hidden="true" />}
    />
  ) : null;
}
