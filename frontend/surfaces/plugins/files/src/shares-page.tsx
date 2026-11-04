'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { FileLink } from './file-link';
import { Cloud } from '../../../src/files/icons';
import { useFiles } from '../../../src/files/runtime';
import { filesAccentStyle } from '../../../src/files/appearance';
import { FilesError, type FileShare } from '../../../src/files/model';

export function MySharesPage() {
  const port = useFiles();
  const { t } = useFrontendTranslation();
  const [items, setItems] = useState<readonly FileShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<FileShare>();
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  useEffect(() => {
    const controller = new AbortController();
    void port
      .shares(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setItems(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [port, revision, t]);
  return (
    <main
      id="main-content"
      data-accent-preview="blue"
      style={filesAccentStyle}
      className="min-h-screen bg-canvas p-5 text-ink"
    >
      <Page>
        <Toolbar
          label={t('files.myShares')}
          primary={
            <FileLink target="files" className="flex items-center gap-3 font-semibold text-brand">
              <Cloud className="size-7" />
              {t('files.nav')}
            </FileLink>
          }
          secondary={
            <Action
              variant="secondary"
              onPress={() => {
                setLoading(true);
                setFailure('');
                setRevision((value) => value + 1);
              }}
            >
              {t('files.refresh')}
            </Action>
          }
        />
        <section className="rounded-panel border border-border bg-surface p-5">
          <h1 className="text-2xl font-semibold">{t('files.myShares')}</h1>
          {failure ? (
            <p role="alert" className="mt-4 text-danger">
              {failure}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="mt-4 text-ink-muted">
              {notice}
            </p>
          ) : null}
          {loading ? (
            <p role="status" className="mt-5">
              {t('files.loading')}
            </p>
          ) : items.length === 0 ? (
            <StateSurface
              state="empty"
              icon={<Cloud />}
              title={t('files.noShares')}
              description={t('files.noSharesHint')}
            />
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {items.map((share) => (
                <li
                  key={share.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-semibold">{share.name}</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {t(`files.shareStatuses.${share.status}`)} · {t('files.shareExpires')}:{' '}
                      {new Date(share.expiresAt).toLocaleString()}
                      {share.hasPassword ? ` · ${t('files.shareProtected')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Action
                      variant="secondary"
                      disabled={share.status !== 'active'}
                      onPress={() => {
                        setNotice('');
                        void port
                          .copyShareLink(share.token)
                          .then(() => setNotice(t('files.linkCopied')))
                          .catch((error: unknown) => setFailure(errorText(error)));
                      }}
                    >
                      {t('files.copyLink')}
                    </Action>
                    <Action
                      variant="danger"
                      disabled={share.status === 'revoked'}
                      onPress={() => {
                        setFailure('');
                        setTarget(share);
                      }}
                    >
                      {t('files.revokeShare')}
                    </Action>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {target ? (
          <DialogSurface
            triggerLabel={t('files.revokeShare')}
            title={t('files.revokeShare')}
            description={t('files.revokeShareHint')}
            cancelLabel={t('files.cancel')}
            confirmLabel={t('files.confirm')}
            isOpen
            onOpenChange={(open) => {
              if (!open) setTarget(undefined);
            }}
            onConfirm={async () => {
              try {
                await port.revokeShare(target.id);
                setLoading(true);
                setRevision((value) => value + 1);
              } catch (error) {
                setFailure(errorText(error));
                throw error;
              }
            }}
          >
            <p className="break-words">{target.name}</p>
          </DialogSurface>
        ) : null}
      </Page>
    </main>
  );
}
