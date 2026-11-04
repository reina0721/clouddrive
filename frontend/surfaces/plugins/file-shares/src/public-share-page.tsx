'use client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import {
  CheckboxField,
  PasswordField,
  SelectField,
  TextField,
} from '@clouddrive/ui-adapter/form-field';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Cloud, FileGlyph } from '../../../src/files/icons';
import { usePublicFiles } from '../../../src/files/runtime';
import { filesAccentStyle } from '../../../src/files/appearance';
import { formatFileBytes } from '../../../src/files/format';
import {
  FilesError,
  type PublicFileEntry,
  type PublicShare,
  type PublicFileListing,
  type PublicFileQuery,
  type SharedBatchResult,
} from '../../../src/files/model';
import { initialPublicQuery, publicMediaEntry, publicTextEntry } from './public-entry';
import type { PublicChange } from './change-dialog';

// 目录首屏不加载尚未打开的编辑、目标选择或上传对话框。
const PublicCreateDialog = lazy(() =>
  import('./content-dialogs').then((module) => ({ default: module.PublicCreateDialog })),
);
const PublicPreviewDialog = lazy(() =>
  import('./content-dialogs').then((module) => ({ default: module.PublicPreviewDialog })),
);
const PublicChangeDialog = lazy(() =>
  import('./change-dialog').then((module) => ({ default: module.PublicChangeDialog })),
);
const PublicUploadDialog = lazy(() =>
  import('./upload-dialog').then((module) => ({ default: module.PublicUploadDialog })),
);

export function PublicSharePage() {
  const port = usePublicFiles(),
    { t } = useFrontendTranslation();
  const [share, setShare] = useState<PublicShare>(),
    [listing, setListing] = useState<PublicFileListing>(),
    [query, setQuery] = useState<PublicFileQuery>(initialPublicQuery),
    [search, setSearch] = useState(''),
    [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [password, setPassword] = useState(''),
    [unlocking, setUnlocking] = useState(false),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<readonly PublicFileEntry[]>([]),
    [batchFailures, setBatchFailures] = useState<readonly { id: string; message: string }[]>([]);
  const [creating, setCreating] = useState<'folder' | 'text' | 'markdown'>(),
    [preview, setPreview] = useState<Readonly<{ entry: PublicFileEntry; edit: boolean }>>(),
    [change, setChange] = useState<PublicChange>(),
    [uploading, setUploading] = useState(false);
  const errorText = (error: unknown) =>
    t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const value = await port.metadata(controller.signal);
        if (controller.signal.aborted) return;
        setShare(value);
        setListing(undefined);
        setFailure('');
        if (value.locked) return;
        if (value.root?.kind === 'folder' && value.permissions?.browse) {
          const entries = await port.entries(query, controller.signal);
          if (!controller.signal.aborted) setListing(entries);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setShare(undefined);
          setListing(undefined);
          setFailure(
            t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [port, query, revision, t]);
  const refresh = () => {
    setLoading(true);
    setFailure('');
    setRevision((value) => value + 1);
  };
  const navigate = (next: PublicFileQuery) => {
    setLoading(true);
    setFailure('');
    setListing(undefined);
    setSelected([]);
    setBatchFailures([]);
    setQuery(next);
  };
  const root = share?.root,
    rights = share?.permissions,
    limits = share?.limits;
  const items = root?.kind === 'folder' ? (listing?.items ?? []) : root ? [root] : [];
  const parent = query.parent || root?.id || '';
  const currentSelected = selected.filter((entry) => items.some((item) => item.id === entry.id));
  const toggle = (entry: PublicFileEntry, checked: boolean) =>
    setSelected((value) =>
      checked
        ? value.some((item) => item.id === entry.id) || value.length >= (limits?.batchEntries ?? 20)
          ? value
          : [...value, entry]
        : value.filter((item) => item.id !== entry.id),
    );
  const run = (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailure('');
    void operation()
      .catch((error: unknown) => setFailure(errorText(error)))
      .finally(() => setBusy(false));
  };
  const applied = (result: SharedBatchResult) => {
    const failed = result.items.filter((item) => item.errorCode);
    setSelected((value) => value.filter((entry) => failed.some((item) => item.id === entry.id)));
    setBatchFailures(
      failed.map((item) => ({ id: item.id, message: t(`publicFiles.errors.${item.errorCode}`) })),
    );
    setNotice(t(`publicFiles.collaboration.${failed.length ? 'batchPartial' : 'batchSucceeded'}`));
    setChange(undefined);
    refresh();
  };
  const saved = () => {
    setCreating(undefined);
    setPreview(undefined);
    setNotice(t('publicFiles.collaboration.batchSucceeded'));
    refresh();
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
            <a
              href="/home"
              aria-label="clouddrive"
              className="flex items-center gap-3 text-xl font-bold"
            >
              <Cloud className="size-7 text-brand" />
              <span className="hidden sm:inline">clouddrive</span>
            </a>
          }
          secondary={
            <>
              {!loading && share ? (
                <a
                  className="rounded-control border border-border px-4 py-2 text-sm"
                  href={port.saveShortcutHref()}
                >
                  {t('publicFiles.saveShortcut')}
                </a>
              ) : null}
              <Action variant="secondary" onPress={refresh}>
                {t('publicFiles.refresh')}
              </Action>
            </>
          }
        />
        <PageHeader
          title={share?.title || root?.name || t('publicFiles.title')}
          description={t(
            root?.kind === 'file'
              ? 'publicFiles.collaboration.rootProtected'
              : 'publicFiles.collaboration.subtitle',
          )}
        />
        {failure ? (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        {loading && share && !share.locked ? <p role="status">{t('publicFiles.loading')}</p> : null}
        {loading && !share ? (
          <StateSurface
            state="loading"
            icon={<Cloud />}
            title={t('publicFiles.loading')}
            description={t('publicFiles.collaboration.subtitle')}
          />
        ) : share?.locked || (!share && failure === t('publicFiles.errors.locked')) ? (
          <Section title={t('publicFiles.password')} contentInset>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                setUnlocking(true);
                setFailure('');
                void port
                  .unlock(password)
                  .then(() => {
                    setPassword('');
                    setSelected([]);
                    setQuery(initialPublicQuery);
                    refresh();
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
          </Section>
        ) : root && rights && limits ? (
          <>
            {root.kind === 'folder' && (rights.create || rights.upload) ? (
              <Toolbar
                label={t('publicFiles.title')}
                primary={
                  <div className="flex flex-wrap gap-2">
                    {root.kind === 'folder' && rights.create ? (
                      <>
                        <Action variant="secondary" onPress={() => setCreating('folder')}>
                          {t('publicFiles.collaboration.newFolder')}
                        </Action>
                        <Action variant="secondary" onPress={() => setCreating('text')}>
                          {t('publicFiles.collaboration.newText')}
                        </Action>
                        <Action variant="secondary" onPress={() => setCreating('markdown')}>
                          {t('publicFiles.collaboration.newMarkdown')}
                        </Action>
                      </>
                    ) : null}
                    {root.kind === 'folder' && rights.upload ? (
                      <Action onPress={() => setUploading(true)}>
                        {t('publicFiles.collaboration.upload')}
                      </Action>
                    ) : null}
                  </div>
                }
              />
            ) : null}
            {root.kind === 'folder' && rights.browse ? (
              <Section title={t('publicFiles.collaboration.search')} contentInset>
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    navigate({ ...query, search, page: 1 });
                  }}
                >
                  <TextField
                    label={t('publicFiles.collaboration.search')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <Action type="submit" variant="secondary">
                    {t('publicFiles.collaboration.searchAction')}
                  </Action>
                  <SelectField
                    label={t('publicFiles.collaboration.sort')}
                    value={query.sort}
                    onValueChange={(value) =>
                      navigate({ ...query, sort: value as PublicFileQuery['sort'], page: 1 })
                    }
                    options={(['name', 'size', 'updated', 'created'] as const).map((value) => ({
                      value,
                      label: t(`publicFiles.collaboration.sorts.${value}`),
                    }))}
                  />
                  <SelectField
                    label={t('publicFiles.collaboration.direction')}
                    value={query.desc ? 'desc' : 'asc'}
                    onValueChange={(value) =>
                      navigate({ ...query, desc: value === 'desc', page: 1 })
                    }
                    options={[
                      { value: 'asc', label: t('publicFiles.collaboration.ascending') },
                      { value: 'desc', label: t('publicFiles.collaboration.descending') },
                    ]}
                  />
                  <SelectField
                    label={t('publicFiles.collaboration.scope')}
                    value={query.scope}
                    onValueChange={(value) =>
                      navigate({ ...query, scope: value as PublicFileQuery['scope'], page: 1 })
                    }
                    options={[
                      { value: 'folder', label: t('publicFiles.collaboration.currentFolder') },
                      { value: 'tree', label: t('publicFiles.collaboration.subtree') },
                    ]}
                  />
                </form>
              </Section>
            ) : null}
            {listing ? (
              <nav aria-label={t('publicFiles.path')} className="flex flex-wrap gap-2">
                {listing.breadcrumbs.map((entry) => (
                  <Action
                    key={entry.id}
                    variant="quiet"
                    onPress={() => navigate({ ...query, parent: entry.id, search: '', page: 1 })}
                  >
                    {entry.name}
                  </Action>
                ))}
              </nav>
            ) : null}
            {root.kind === 'folder' && !rights.browse ? (
              <StateSurface
                state="empty"
                icon={<Cloud />}
                title={t('publicFiles.collaboration.uploadOnly')}
                description={t('publicFiles.collaboration.uploadLocation')}
              />
            ) : (
              <>
                {selected.length ? (
                  <Toolbar
                    label={t('publicFiles.collaboration.selected', { count: selected.length })}
                    primary={
                      <div className="flex flex-wrap gap-2">
                        <span>
                          {t('publicFiles.collaboration.selected', { count: selected.length })}
                        </span>
                        {rights.download ? (
                          <Action
                            variant="secondary"
                            disabled={busy}
                            onPress={() => run(() => port.archive(selected))}
                          >
                            {t('publicFiles.collaboration.archive')}
                          </Action>
                        ) : null}
                        {(['move', 'copy', 'trash'] as const).map((action) =>
                          rights[action === 'trash' ? 'delete' : action] &&
                          root.kind === 'folder' ? (
                            <Action
                              key={action}
                              variant="secondary"
                              disabled={busy}
                              onPress={() => setChange({ action, entries: selected, batch: true })}
                            >
                              {t(
                                `publicFiles.collaboration.${action === 'trash' ? 'batchTrash' : action === 'move' ? 'batchMove' : 'batchCopy'}`,
                              )}
                            </Action>
                          ) : null,
                        )}
                      </div>
                    }
                  />
                ) : null}
                {batchFailures.length ? (
                  <ul className="space-y-2 text-sm text-danger" aria-live="polite">
                    {batchFailures.map((item) => (
                      <li key={item.id}>
                        {selected.find((entry) => entry.id === item.id)?.name}: {item.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Section title={root.name} contentInset>
                  {root.kind === 'folder' && items.length ? (
                    <CheckboxField
                      label={t('publicFiles.collaboration.selectPage')}
                      checked={currentSelected.length === items.length}
                      onCheckedChange={(checked) =>
                        setSelected(checked ? items.slice(0, limits.batchEntries) : [])
                      }
                    />
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((entry) => {
                      const protectedRoot = entry.id === root.id;
                      return (
                        <article
                          key={entry.id}
                          data-shared-entry-id={entry.id}
                          className="min-w-0 space-y-3 rounded-panel border border-border bg-surface p-4"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <FileGlyph kind={entry.kind} mediaType={entry.mediaType} />
                            <span className="min-w-0 break-words font-medium">{entry.name}</span>
                          </div>
                          <p className="text-sm text-ink-muted">
                            {entry.kind === 'file' ? formatFileBytes(entry.sizeBytes) : ''}
                          </p>
                          {!protectedRoot ? (
                            <CheckboxField
                              label={t('publicFiles.collaboration.select', { name: entry.name })}
                              checked={selected.some((item) => item.id === entry.id)}
                              disabled={
                                !selected.some((item) => item.id === entry.id) &&
                                selected.length >= limits.batchEntries
                              }
                              onCheckedChange={(checked) => toggle(entry, checked)}
                            />
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {entry.kind === 'folder' && rights.browse ? (
                              <Action
                                variant="secondary"
                                onPress={() =>
                                  navigate({ ...query, parent: entry.id, search: '', page: 1 })
                                }
                              >
                                {t('publicFiles.open')}
                              </Action>
                            ) : null}
                            {rights.preview &&
                            (publicTextEntry(entry) || publicMediaEntry(entry)) ? (
                              <Action
                                variant="secondary"
                                onPress={() => setPreview({ entry, edit: false })}
                              >
                                {t('publicFiles.collaboration.preview')}
                              </Action>
                            ) : null}
                            {rights.modify && publicTextEntry(entry) ? (
                              <Action
                                variant="secondary"
                                onPress={() => setPreview({ entry, edit: true })}
                              >
                                {t('publicFiles.collaboration.edit')}
                              </Action>
                            ) : null}
                            {rights.download && entry.kind === 'file' ? (
                              <Action
                                variant="secondary"
                                disabled={busy}
                                onPress={() => run(() => port.download(entry))}
                              >
                                {t('publicFiles.download')}
                              </Action>
                            ) : null}
                            {!protectedRoot &&
                              (['rename', 'move', 'copy', 'trash'] as const).map((action) =>
                                rights[action === 'trash' ? 'delete' : action] ? (
                                  <Action
                                    key={action}
                                    variant="quiet"
                                    disabled={busy}
                                    onPress={() =>
                                      setChange({ action, entries: [entry], batch: false })
                                    }
                                  >
                                    {t(`publicFiles.collaboration.${action}`)}
                                  </Action>
                                ) : null,
                              )}
                            {entry.kind === 'shortcut' ? (
                              <p className="text-sm text-ink-muted">
                                {t('publicFiles.shortcutUnavailable')}
                              </p>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {items.length === 0 && !loading ? (
                    <StateSurface
                      state="empty"
                      icon={<Cloud />}
                      title={t('publicFiles.empty')}
                      description={t('publicFiles.emptyDescription')}
                    />
                  ) : null}
                </Section>
                {listing ? (
                  <Toolbar
                    label={t('publicFiles.collaboration.pageCount', {
                      page: listing.page,
                      total: listing.total,
                    })}
                    primary={
                      <p>
                        {t('publicFiles.collaboration.pageCount', {
                          page: listing.page,
                          total: listing.total,
                        })}
                      </p>
                    }
                    secondary={
                      <>
                        <Action
                          variant="secondary"
                          disabled={query.page === 1}
                          onPress={() => navigate({ ...query, page: query.page - 1 })}
                        >
                          {t('publicFiles.collaboration.previous')}
                        </Action>
                        <Action
                          variant="secondary"
                          disabled={listing.page * listing.pageSize >= listing.total}
                          onPress={() => navigate({ ...query, page: query.page + 1 })}
                        >
                          {t('publicFiles.collaboration.next')}
                        </Action>
                      </>
                    }
                  />
                ) : null}
              </>
            )}
            <Suspense fallback={<p role="status">{t('publicFiles.loading')}</p>}>
              {creating ? (
                <PublicCreateDialog
                  kind={creating}
                  parent={parent}
                  onClose={() => setCreating(undefined)}
                  onSaved={saved}
                />
              ) : null}
              {preview ? (
                <PublicPreviewDialog
                  entry={preview.entry}
                  edit={preview.edit}
                  maxBytes={limits.maxPreviewBytes}
                  onClose={() => setPreview(undefined)}
                  onSaved={saved}
                />
              ) : null}
              {change ? (
                <PublicChangeDialog
                  change={change}
                  root={root}
                  parent={parent}
                  onClose={() => setChange(undefined)}
                  onApplied={applied}
                />
              ) : null}
              {uploading ? (
                <PublicUploadDialog
                  parent={parent}
                  limit={limits.batchEntries}
                  onClose={() => setUploading(false)}
                  onSaved={refresh}
                />
              ) : null}
            </Suspense>
          </>
        ) : null}
      </Page>
    </main>
  );
}
