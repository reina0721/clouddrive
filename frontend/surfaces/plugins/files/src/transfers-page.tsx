'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Cloud } from '../../../src/files/icons';
import { filesAccentStyle } from '../../../src/files/appearance';
import { FileLink } from './file-link';
import { TransferPanel } from './transfer-panel';

export function TransfersPage() {
  const { t } = useFrontendTranslation();
  return (
    <main
      id="main-content"
      data-accent-preview="blue"
      style={filesAccentStyle}
      className="min-h-screen bg-canvas p-5 text-ink"
    >
      <Page>
        <Toolbar
          label={t('files.transferCenter')}
          primary={
            <FileLink target="files" className="flex items-center gap-3 font-semibold text-brand">
              <Cloud className="size-7" />
              {t('files.nav')}
            </FileLink>
          }
          secondary={
            <FileLink target="shares" className="text-sm text-brand">
              {t('files.myShares')}
            </FileLink>
          }
        />
        <h1 className="text-2xl font-semibold">{t('files.transferCenter')}</h1>
        <p className="text-sm text-ink-muted">{t('files.transferResumeHint')}</p>
        <TransferPanel />
      </Page>
    </main>
  );
}
