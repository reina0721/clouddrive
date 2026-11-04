'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { PasswordField } from '@clouddrive/ui-adapter/form-field';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Cloud, FileGlyph } from '../../../src/files/icons';
import { usePublicFiles } from '../../../src/files/runtime';
import { filesAccentStyle } from '../../../src/files/appearance';
import { FilesError, type PublicFileEntry } from '../../../src/files/model';

export default function PublicSharePage() {
  const port = usePublicFiles();
  const { t } = useFrontendTranslation();
  const [root, setRoot] = useState<PublicFileEntry>();
  const [items, setItems] = useState<PublicFileEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<PublicFileEntry[]>([]);
  const [parent, setParent] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [revision, setRevision] = useState(0);
  const errorText = (error: unknown) =>
    t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const share = await port.metadata(controller.signal);
        if (controller.signal.aborted) return;
        setLocked(share.locked);
        if (share.locked) return;
        setRoot(share.root);
        if (share.root?.kind === 'folder') {
          const listing = await port.entries(parent, controller.signal);
          if (controller.signal.aborted) return;
          setItems(listing.items);
          setBreadcrumbs(listing.breadcrumbs);
        } else if (share.root) {
          setItems([share.root]);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailure(
            t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          );
          setRoot(undefined);
          setItems([]);
          setBreadcrumbs([]);
          setLocked(error instanceof FilesError && error.code === 'locked');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [port, parent, revision, t]);
  const refresh = () => {
    setLoading(true);
    setFailure('');
    setRevision((value) => value + 1);
  };
  const browse = (id: string) => {
    setLoading(true);
    setFailure('');
    setParent(id);
  };
  const download = (entry: PublicFileEntry) => {
    setDownloading(entry.id);
    setFailure('');
    void port
      .download(entry)
      .catch((error: unknown) => setFailure(errorText(error)))
      .finally(() => setDownloading(''));
  };
  return (
    <main
      id="main-content"
      data-accent-preview="blue"
      style={filesAccentStyle}
      className="min-h-screen bg-canvas p-5 text-ink"
    >
      <Page>
        <Toolbar
          label={t('publicFiles.title')}
          primary={
            <a href="/home" className="flex items-center gap-3 text-xl font-bold">
              <Cloud className="size-7 text-brand" />
              clouddrive
            </a>
          }
          secondary={
            <Action variant="secondary" onPress={refresh}>
              {t('publicFiles.refresh')}
            </Action>
          }
        />
        <section className="rounded-panel border border-border bg-surface p-6">
          <h1 className="text-2xl font-semibold">{root?.name ?? t('publicFiles.title')}</h1>
          {failure ? (
            <p role="alert" className="mt-4 text-danger">
              {failure}
            </p>
          ) : null}
          {loading ? (
            <p role="status" className="mt-5">
              {t('publicFiles.loading')}
            </p>
          ) : locked ? (
            <form
              className="mt-6 flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                setUnlocking(true);
                setFailure('');
                void port
                  .unlock(password)
                  .then(() => {
                    setPassword('');
                    setParent('');
                    setLoading(true);
                    setRevision((value) => value + 1);
                  })
                  .catch((error: unknown) => setFailure(errorText(error)))
                  .finally(() => setUnlocking(false));
              }}
            >
              <PasswordField
                label={t('publicFiles.password')}
                value={password}
                purpose="current"
                showLabel={t('publicFiles.showPassword')}
                hideLabel={t('publicFiles.hidePassword')}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Action type="submit" loading={unlocking}>
                {t('publicFiles.unlock')}
              </Action>
            </form>
          ) : root ? (
            <>
              {breadcrumbs.length ? (
                <nav aria-label={t('publicFiles.path')} className="mt-5 flex flex-wrap gap-2">
                  {breadcrumbs.map((entry) => (
                    <Action key={entry.id} variant="quiet" onPress={() => browse(entry.id)}>
                      {entry.name}
                    </Action>
                  ))}
                </nav>
              ) : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((entry) => (
                  <div key={entry.id} className="min-w-0 rounded-panel border border-border p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileGlyph kind={entry.kind} mediaType={entry.mediaType} />
                      <span className="min-w-0 break-words font-medium">{entry.name}</span>
                    </div>
                    <Action
                      variant="secondary"
                      loading={downloading === entry.id}
                      disabled={downloading !== ''}
                      onPress={() => (entry.kind === 'folder' ? browse(entry.id) : download(entry))}
                    >
                      {t(entry.kind === 'folder' ? 'publicFiles.open' : 'publicFiles.download')}
                    </Action>
                  </div>
                ))}
              </div>
              {items.length === 0 ? (
                <StateSurface
                  state="empty"
                  icon={<Cloud />}
                  title={t('publicFiles.empty')}
                  description={t('publicFiles.emptyDescription')}
                />
              ) : null}
            </>
          ) : null}
        </section>
      </Page>
    </main>
  );
}
