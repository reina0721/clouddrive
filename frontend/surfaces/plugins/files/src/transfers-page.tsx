'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page } from '@clouddrive/surface-foundation/layout';
import { TransferPanel } from './transfer-panel';

export function TransfersPage() {
  const { t } = useFrontendTranslation();
  return (
    <>
      <Page>
        <h1 className="text-2xl font-semibold">{t('files.transferCenter')}</h1>
        <p className="text-sm text-ink-muted">{t('files.transferResumeHint')}</p>
        <TransferPanel />
      </Page>
    </>
  );
}
