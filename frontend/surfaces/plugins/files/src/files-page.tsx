'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import {
  Cloud,
  Home,
  Trash2,
  Upload,
  FolderPlus,
  RefreshCw,
  LayoutGrid,
  List,
  Settings,
  FileGlyph,
  HardDrive,
} from '../../../src/files/icons';
import { useFiles } from '../../../src/files/runtime';
import {
  FilesError,
  type FileEntry,
  type FileListing,
  type UploadCandidate,
  type FileViewPreferences,
} from '../../../src/files/model';

type Props = Readonly<{
  parent: string;
  category: string;
  trash: boolean;
  search: string;
  navigate: (query: Record<string, string>) => void;
}>;
type QueueItem = UploadCandidate & {
  parentId: string;
  state: 'waiting' | 'uploading' | 'succeeded' | 'failed' | 'canceled';
  failure?: string | undefined;
};
type Dialog = { mode: 'folder' | 'rename' | 'move' | 'remove' | 'restore'; targets: FileEntry[] };
const initialPreferences: FileViewPreferences = { view: 'grid', sort: 'name', desc: false };

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(1)} GiB`;
}

export function FilesPage({ parent, category, trash, search, navigate }: Props) {
  const port = useFiles();
  const { t } = useFrontendTranslation();
  const [listing, setListing] = useState<FileListing>();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [selected, setSelected] = useState<string[]>([]);
  const [searchText, setSearchText] = useState(search);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const [dialog, setDialog] = useState<Dialog>();
  const destinationDialogOpen = dialog?.mode === 'move' || dialog?.mode === 'restore';
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [folders, setFolders] = useState<FileListing>();
  const [dialogFailure, setDialogFailure] = useState('');
  const [detail, setDetail] = useState<{ entry: FileEntry; path: string }>();
  const [preview, setPreview] = useState<{ entry: FileEntry; text: string; loading: boolean }>();
  const previewController = useRef<AbortController | undefined>(undefined);
  const errorText = useCallback(
    (error: unknown) =>
      t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
    [t],
  );
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    try {
      setPreferences(port.loadPreferences());
    } catch {
      setNotice(t('files.preferencesFailure'));
    }
  }, [port, t]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailure('');
    setSelected([]);
    port
      .list(
        { parent, category, trash, search, sort: preferences.sort, desc: preferences.desc },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) setListing(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setListing(undefined);
          setFailure(errorText(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    port,
    parent,
    category,
    trash,
    search,
    preferences.sort,
    preferences.desc,
    revision,
    errorText,
  ]);
  useEffect(() => {
    setSearchText(search);
  }, [search]);
  useEffect(() => {
    if (!destinationDialogOpen) return;
    const controller = new AbortController();
    setFolders(undefined);
    port
      .list(
        { parent: destination, category: '', search: '', trash: false, sort: 'name', desc: false },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) setFolders(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setDialogFailure(errorText(error));
      });
    return () => controller.abort();
  }, [port, destinationDialogOpen, destination, errorText]);

  const enqueue = useCallback(
    (candidates: readonly UploadCandidate[]) => {
      if (trash || !listing) {
        for (const candidate of candidates) port.releaseCandidate(candidate.id);
        return;
      }
      setQueue((current) => [
        ...current,
        ...candidates.map((candidate): QueueItem => ({
          ...candidate,
          parentId: parent,
          state: candidate.sizeBytes > listing.maxFileBytes ? 'failed' : 'waiting',
          ...(candidate.sizeBytes > listing.maxFileBytes
            ? { failure: t('files.errors.large') }
            : {}),
        })),
      ]);
    },
    [listing, parent, port, t, trash],
  );
  useEffect(() => port.subscribeDrop(enqueue), [port, enqueue]);
  useEffect(() => {
    const slots = (listing?.concurrentUploads ?? 1) - controllers.current.size;
    const ready = queue
      .filter((item) => item.state === 'waiting' && !controllers.current.has(item.id))
      .slice(0, Math.max(0, slots));
    for (const item of ready) {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      setQueue((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, state: 'uploading' } : candidate,
        ),
      );
      port
        .upload(item, item.parentId, controller.signal)
        .then(() => {
          port.releaseCandidate(item.id);
          setQueue((current) =>
            current.map((candidate) =>
              candidate.id === item.id ? { ...candidate, state: 'succeeded' } : candidate,
            ),
          );
        })
        .catch((error: unknown) => {
          setQueue((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? {
                    ...candidate,
                    state: controller.signal.aborted ? 'canceled' : 'failed',
                    failure: errorText(error),
                  }
                : candidate,
            ),
          );
        })
        .finally(() => {
          controllers.current.delete(item.id);
          reload();
        });
    }
  }, [queue, listing?.concurrentUploads, port, errorText, reload]);
  useEffect(() => {
    const active = controllers.current;
    return () => {
      for (const controller of active.values()) controller.abort();
      previewController.current?.abort();
    };
  }, []);

  function savePreferences(next: FileViewPreferences) {
    setPreferences(next);
    try {
      port.savePreferences(next);
    } catch {
      setNotice(t('files.preferencesFailure'));
    }
  }
  function openDialog(mode: Dialog['mode'], targets: FileEntry[] = []) {
    setNotice('');
    setDialogFailure('');
    setName(mode === 'rename' ? (targets[0]?.name ?? '') : '');
    setDestination('');
    setDialog({ mode, targets });
  }
  async function confirmDialog() {
    if (!dialog) return;
    setDialogFailure('');
    try {
      if (dialog.mode === 'folder') await port.folder(parent, name);
      else {
        const failures: FileEntry[] = [];
        let lastError: unknown;
        for (const entry of dialog.targets) {
          try {
            if (dialog.mode === 'rename') await port.update(entry.id, { name });
            else if (dialog.mode === 'move') await port.update(entry.id, { parentId: destination });
            else if (dialog.mode === 'remove') await port.trash(entry.id);
            else await port.restore(entry.id, destination);
          } catch (error) {
            failures.push(entry);
            lastError = error;
          }
        }
        if (failures.length) {
          setDialog({ ...dialog, targets: failures });
          setDialogFailure(
            `${t('files.operationPartial', { count: failures.length })} ${errorText(lastError)}`,
          );
          reload();
          throw lastError;
        }
      }
      setNotice(t('files.operationDone'));
      reload();
    } catch (error) {
      setDialogFailure((current) => current || errorText(error));
      throw error;
    }
  }
  function cancelUpload(item: QueueItem) {
    controllers.current.get(item.id)?.abort();
    setQueue((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, state: 'canceled' } : candidate,
      ),
    );
  }
  async function showDetails(entry: FileEntry) {
    try {
      const value = await port.detail(entry.id);
      setDetail({
        entry: value.entry,
        path: `${t('files.nav')}/${value.breadcrumbs.map((item) => item.name).join('/')}`,
      });
    } catch (error) {
      setNotice(errorText(error));
    }
  }
  async function showPreview(entry: FileEntry) {
    previewController.current?.abort();
    const controller = new AbortController();
    previewController.current = controller;
    setPreview({ entry, text: '', loading: true });
    try {
      const text = await port.preview(entry, controller.signal);
      if (!controller.signal.aborted) setPreview({ entry, text, loading: false });
    } catch (error) {
      if (!controller.signal.aborted)
        setPreview({
          entry,
          text:
            error instanceof FilesError && error.code === 'unsupported'
              ? t('files.unsupportedPreview')
              : errorText(error),
          loading: false,
        });
    }
  }
  async function download(entry: FileEntry) {
    try {
      await port.download(entry);
    } catch (error) {
      setNotice(errorText(error));
    }
  }
  const targets = listing?.items.filter((entry) => selected.includes(entry.id)) ?? [];
  const title = trash
    ? t('files.trash')
    : category
      ? t(`files.${category}`)
      : (listing?.breadcrumbs.at(-1)?.name ?? t('files.nav'));
  const navItems = [
    { key: '', label: t('files.nav'), icon: <Home /> },
    ...['image', 'video', 'audio', 'document'].map((key) => ({
      key,
      label: t(`files.${key}`),
      icon: (
        <FileGlyph size="small" kind="file" mediaType={`${key === 'document' ? 'text' : key}/`} />
      ),
    })),
  ];

  return (
    <div
      data-accent-preview="blue"
      style={
        {
          '--color-brand': 'var(--ds-brand)',
          '--color-brand-strong': 'var(--ds-brand-strong)',
          '--color-brand-soft': 'var(--ds-brand-soft)',
          '--color-on-brand': 'var(--ds-on-brand)',
        } as CSSProperties
      }
      className="min-h-screen bg-canvas font-sans text-ink"
    >
      <div className="mx-auto grid min-h-screen max-w-screen-2xl md:grid-cols-5">
        <aside className="border-b border-border p-4 md:border-b-0 md:p-5">
          <a href="/home" className="flex items-center gap-3 px-3 py-3 text-xl font-bold">
            <Cloud className="size-8 text-brand" />
            {t('files.brand')}
          </a>
          <nav aria-label={t('files.nav')} className="mt-5 flex flex-wrap gap-1 md:flex-col">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-current={!trash && category === item.key ? 'page' : undefined}
                onClick={() => navigate({ category: item.key })}
                className={`flex items-center gap-3 rounded-control px-4 py-2.5 text-sm text-left hover:bg-surface-muted ${!trash && category === item.key ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-muted'}`}
              >
                <span className="size-5 overflow-hidden" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
            <button
              type="button"
              aria-current={trash ? 'page' : undefined}
              onClick={() => navigate({ trash: 'true' })}
              className={`flex items-center gap-3 rounded-control px-4 py-2.5 text-sm text-left hover:bg-surface-muted ${trash ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-muted'}`}
            >
              <Trash2 className="size-5" />
              {t('files.trash')}
            </button>
          </nav>
          <div className="mt-6 flex flex-wrap gap-3 px-4 text-sm text-ink-muted md:flex-col">
            <a href="/workspace" className="flex items-center gap-3 hover:text-brand">
              <Settings className="size-5" />
              {t('files.management')}
            </a>
            <a href="/account" className="hover:text-brand">
              {t('files.account')}
            </a>
          </div>
          {listing ? (
            <div className="mt-8 rounded-panel border border-border bg-surface p-4 text-xs text-ink-muted">
              <div className="mb-3 flex items-center gap-2 font-semibold text-ink">
                <HardDrive className="size-4" />
                {t('files.storage')}
              </div>
              <ProgressMeter
                value={Math.round((listing.usedBytes / listing.quotaBytes) * 100)}
                label={`${bytes(listing.usedBytes)} / ${bytes(listing.quotaBytes)}`}
              />
            </div>
          ) : null}
        </aside>
        <main id="main-content" className="min-w-0 p-4 md:col-span-4 md:p-5">
          <Page>
            <div className="flex flex-wrap items-center gap-3">
              <Action
                leadingIcon={<Upload />}
                disabled={trash || !listing}
                onPress={() => {
                  void port
                    .chooseFiles()
                    .then(enqueue)
                    .catch((error: unknown) => setNotice(errorText(error)));
                }}
              >
                {t('files.upload')}
              </Action>
              <Action
                variant="secondary"
                leadingIcon={<FolderPlus />}
                disabled={trash || !listing}
                onPress={() => openDialog('folder')}
              >
                {t('files.newFolder')}
              </Action>
              <form
                className="flex w-full min-w-0 items-center gap-2 md:w-auto md:flex-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  navigate({
                    parent,
                    category,
                    ...(trash ? { trash: 'true' } : {}),
                    search: searchText,
                  });
                }}
              >
                <SearchBox
                  label={t('files.search')}
                  placeholder={t('files.searchPlaceholder')}
                  value={searchText}
                  onValueChange={setSearchText}
                />
                <Action type="submit" variant="secondary">
                  {t('files.search')}
                </Action>
              </form>
            </div>
            <Toolbar
              label={title}
              primary={
                <>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate({})}
                      className="text-sm font-semibold text-brand"
                    >
                      {t('files.nav')}
                    </button>
                    {listing?.breadcrumbs.map((entry) => (
                      <span key={entry.id} className="flex min-w-0 items-center gap-2 text-sm">
                        <span aria-hidden="true">/</span>
                        <button
                          type="button"
                          onClick={() => navigate({ parent: entry.id })}
                          className="max-w-40 truncate hover:text-brand"
                        >
                          {entry.name}
                        </button>
                      </span>
                    ))}
                    {trash || category ? (
                      <span className="text-sm text-ink-muted">/ {title}</span>
                    ) : null}
                    <Action size="sm" variant="quiet" leadingIcon={<RefreshCw />} onPress={reload}>
                      {t('files.refresh')}
                    </Action>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Action
                      size="sm"
                      variant={preferences.view === 'grid' ? 'secondary' : 'quiet'}
                      leadingIcon={<LayoutGrid />}
                      onPress={() => savePreferences({ ...preferences, view: 'grid' })}
                    >
                      {t('files.grid')}
                    </Action>
                    <Action
                      size="sm"
                      variant={preferences.view === 'list' ? 'secondary' : 'quiet'}
                      leadingIcon={<List />}
                      onPress={() => savePreferences({ ...preferences, view: 'list' })}
                    >
                      {t('files.list')}
                    </Action>
                    <SelectField
                      label={t('files.sort')}
                      presentation="toolbar"
                      value={preferences.sort}
                      onValueChange={(sort) => savePreferences({ ...preferences, sort })}
                      options={['name', 'size', 'updated', 'created'].map((value) => ({
                        value,
                        label: t(`files.${value}Sort`),
                      }))}
                    />
                    <Action
                      size="sm"
                      variant="quiet"
                      onPress={() => savePreferences({ ...preferences, desc: !preferences.desc })}
                    >
                      {preferences.desc ? '↓' : '↑'} {t('files.direction')}
                    </Action>
                  </div>
                </>
              }
            />
            {notice ? (
              <p
                role="status"
                className="rounded-control border border-border bg-surface p-3 text-sm"
              >
                {notice}
              </p>
            ) : null}
            {listing?.items.length ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-32">
                  <CheckboxField
                    label={t('files.selectAll')}
                    checked={selected.length === listing.items.length}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? listing.items.map((entry) => entry.id) : [])
                    }
                  />
                </div>
                {targets.length ? (
                  <>
                    <span className="text-sm text-ink-muted">
                      {t('files.selected', { count: targets.length })}
                    </span>
                    {trash ? (
                      <Action
                        variant="secondary"
                        size="sm"
                        onPress={() => openDialog('restore', targets)}
                      >
                        {t('files.restore')}
                      </Action>
                    ) : (
                      <>
                        <Action
                          variant="secondary"
                          size="sm"
                          onPress={() => openDialog('move', targets)}
                        >
                          {t('files.move')}
                        </Action>
                        <Action
                          variant="danger"
                          size="sm"
                          onPress={() => openDialog('remove', targets)}
                        >
                          {t('files.remove')}
                        </Action>
                      </>
                    )}
                  </>
                ) : null}
              </div>
            ) : null}
            <section
              aria-label={title}
              aria-busy={loading}
              className="min-h-96 rounded-panel border border-border bg-surface p-4"
            >
              <h1 className="sr-only">{title}</h1>
              {loading ? (
                <StateSurface
                  state="loading"
                  icon={<Cloud />}
                  title={t('files.loading')}
                  description={t('files.loadingDescription')}
                />
              ) : failure ? (
                <StateSurface
                  state="error"
                  icon={<Cloud />}
                  title={t('files.error')}
                  description={failure}
                  actionLabel={t('files.retry')}
                  onAction={reload}
                />
              ) : !listing?.items.length ? (
                <StateSurface
                  state="empty"
                  icon={trash ? <Trash2 /> : <Upload />}
                  title={t(
                    trash
                      ? 'files.emptyTrash'
                      : search || category
                        ? 'files.emptySearch'
                        : 'files.empty',
                  )}
                  description={t(
                    search || category ? 'files.emptySearchDescription' : 'files.emptyDescription',
                  )}
                />
              ) : (
                <div
                  className={
                    preferences.view === 'grid'
                      ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      : 'flex flex-col divide-y divide-border'
                  }
                >
                  {listing.items.map((entry) => (
                    <article
                      key={entry.id}
                      className={
                        preferences.view === 'grid'
                          ? 'min-w-0 rounded-panel border border-border p-4 hover:bg-surface-muted'
                          : 'flex min-w-0 flex-wrap items-center gap-4 py-3'
                      }
                    >
                      <div
                        className={
                          preferences.view === 'grid'
                            ? 'mb-4 flex items-start justify-between gap-3'
                            : 'w-full sm:w-48'
                        }
                      >
                        <CheckboxField
                          label={t('files.selectFile', { name: entry.name })}
                          checked={selected.includes(entry.id)}
                          onCheckedChange={(checked) =>
                            setSelected((current) =>
                              checked
                                ? [...current, entry.id]
                                : current.filter((id) => id !== entry.id),
                            )
                          }
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <FileGlyph kind={entry.kind} mediaType={entry.mediaType} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="block max-w-full truncate text-left text-sm font-semibold hover:text-brand"
                            onClick={() => {
                              if (trash) openDialog('restore', [entry]);
                              else if (entry.kind === 'folder') navigate({ parent: entry.id });
                              else void showPreview(entry);
                            }}
                          >
                            {entry.name}
                          </button>
                          <p className="mt-1 text-xs text-ink-muted">
                            {entry.kind === 'folder' ? t('files.folder') : bytes(entry.sizeBytes)}
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">
                            {new Date(entry.trashedAt ?? entry.updatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {trash ? (
                          <Action
                            size="sm"
                            variant="secondary"
                            onPress={() => openDialog('restore', [entry])}
                          >
                            {t('files.restore')}
                          </Action>
                        ) : (
                          <>
                            <Action
                              size="sm"
                              variant="quiet"
                              onPress={() => {
                                void showDetails(entry);
                              }}
                            >
                              {t('files.details')}
                            </Action>
                            <Action
                              size="sm"
                              variant="quiet"
                              onPress={() => openDialog('rename', [entry])}
                            >
                              {t('files.rename')}
                            </Action>
                            <Action
                              size="sm"
                              variant="quiet"
                              onPress={() => openDialog('move', [entry])}
                            >
                              {t('files.move')}
                            </Action>
                            {entry.kind === 'file' ? (
                              <Action
                                size="sm"
                                variant="quiet"
                                onPress={() => {
                                  void download(entry);
                                }}
                              >
                                {t('files.download')}
                              </Action>
                            ) : null}
                            <Action
                              size="sm"
                              variant="quiet"
                              onPress={() => openDialog('remove', [entry])}
                            >
                              {t('files.remove')}
                            </Action>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            {listing ? (
              <p className="text-xs text-ink-muted">
                {t('files.uploadLimit', {
                  size: bytes(listing.maxFileBytes),
                  count: listing.concurrentUploads,
                })}
              </p>
            ) : null}
            {queue.length ? (
              <section
                className="rounded-panel border border-border bg-surface p-4"
                aria-label={t('files.uploads')}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold">{t('files.uploads')}</h2>
                  <Action
                    size="sm"
                    variant="quiet"
                    onPress={() => {
                      for (const item of queue)
                        if (item.state === 'succeeded' || item.state === 'canceled')
                          port.releaseCandidate(item.id);
                      setQueue((current) =>
                        current.filter(
                          (item) => item.state !== 'succeeded' && item.state !== 'canceled',
                        ),
                      );
                    }}
                  >
                    {t('files.clearFinished')}
                  </Action>
                </div>
                <ul className="mt-3 divide-y divide-border">
                  {queue.map((item) => (
                    <li key={item.id} className="flex min-w-0 flex-wrap items-center gap-3 py-3">
                      <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                      <span className="text-xs text-ink-muted">{bytes(item.sizeBytes)}</span>
                      <span role="status" className="text-sm">
                        {t(`files.${item.state}`)}
                      </span>
                      {item.failure && item.state === 'failed' ? (
                        <p className="w-full text-xs text-danger">{item.failure}</p>
                      ) : null}
                      {item.state === 'waiting' || item.state === 'uploading' ? (
                        <Action size="sm" variant="quiet" onPress={() => cancelUpload(item)}>
                          {t('files.cancel')}
                        </Action>
                      ) : item.state === 'failed' || item.state === 'canceled' ? (
                        <Action
                          size="sm"
                          variant="secondary"
                          onPress={() =>
                            setQueue((current) =>
                              current.map((candidate) =>
                                candidate.id === item.id
                                  ? { ...candidate, state: 'waiting', failure: undefined }
                                  : candidate,
                              ),
                            )
                          }
                        >
                          {t('files.retry')}
                        </Action>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </Page>
        </main>
      </div>
      {dialog ? (
        <DialogSurface
          triggerLabel={t(`files.${dialog.mode === 'folder' ? 'newFolder' : dialog.mode}`)}
          title={t(`files.${dialog.mode === 'folder' ? 'newFolder' : dialog.mode}`)}
          description={t(
            dialog.mode === 'remove'
              ? 'files.removeHint'
              : dialog.mode === 'move'
                ? 'files.destinationHint'
                : dialog.mode === 'restore'
                  ? 'files.restoreHint'
                  : 'files.nameHint',
          )}
          cancelLabel={t('files.cancel')}
          confirmLabel={t('files.confirm')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setDialog(undefined);
          }}
          {...(dialogFailure ? { failureMessage: dialogFailure } : {})}
          onConfirm={confirmDialog}
          confirmDisabled={
            dialog.mode === 'folder' || dialog.mode === 'rename'
              ? !name.trim()
              : dialog.mode === 'move' || dialog.mode === 'restore'
                ? !folders
                : false
          }
        >
          {dialog.mode === 'folder' || dialog.mode === 'rename' ? (
            <TextField
              label={t('files.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : dialog.mode === 'move' || dialog.mode === 'restore' ? (
            <div className="space-y-3">
              <Action variant="secondary" onPress={() => setDestination('')}>
                {t('files.nav')}
              </Action>
              <p className="break-words text-sm">
                {t('files.currentDestination')}: /
                {folders?.breadcrumbs.map((entry) => entry.name).join('/')}
              </p>
              {!folders ? (
                <p role="status">{t('files.loading')}</p>
              ) : (
                <ul className="space-y-2">
                  {folders.items
                    .filter((entry) => entry.kind === 'folder')
                    .map((entry) => (
                      <li key={entry.id}>
                        <Action variant="quiet" onPress={() => setDestination(entry.id)}>
                          {entry.name}
                        </Action>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {dialog.targets.map((entry) => (
                <li key={entry.id} className="break-words">
                  {entry.name}
                </li>
              ))}
            </ul>
          )}
        </DialogSurface>
      ) : null}
      {detail ? (
        <DialogSurface
          triggerLabel={t('files.details')}
          title={detail.entry.name}
          description={t('files.details')}
          cancelLabel={t('files.close')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setDetail(undefined);
          }}
        >
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              [
                t('files.type'),
                detail.entry.kind === 'folder' ? t('files.folder') : detail.entry.mediaType,
              ],
              [t('files.size'), `${detail.entry.sizeBytes} B`],
              [t('files.path'), detail.path],
              [t('files.created'), new Date(detail.entry.createdAt).toLocaleString()],
              [t('files.updated'), new Date(detail.entry.updatedAt).toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="col-span-2">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="mt-1 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </DialogSurface>
      ) : null}
      {preview ? (
        <DialogSurface
          triggerLabel={t('files.preview')}
          title={preview.entry.name}
          description={t('files.preview')}
          cancelLabel={t('files.close')}
          isOpen
          onOpenChange={(open) => {
            if (!open) {
              previewController.current?.abort();
              setPreview(undefined);
            }
          }}
        >
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-control bg-surface-muted p-4 text-sm">
            {preview.loading ? t('files.previewLoading') : preview.text}
          </pre>
          <div className="mt-4">
            <Action
              variant="secondary"
              onPress={() => {
                void download(preview.entry);
              }}
            >
              {t('files.download')}
            </Action>
          </div>
        </DialogSurface>
      ) : null}
    </div>
  );
}
