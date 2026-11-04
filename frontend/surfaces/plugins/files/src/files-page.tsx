'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { ShareDialog } from './share-dialog';
import { TransferPanel } from './transfer-panel';
import { PinnedLinks, PinDialog } from './pinned-links';
import { SaveShortcutDialog, ShortcutActionDialog } from './shortcut-dialogs';
import type { PinTarget } from '../../../src/files/navigation';
import { FileLink } from './file-link';
import { TextDialog, type TextRequest } from './text-dialog';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
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
  MoreHorizontal,
} from '../../../src/files/icons';
import {
  useFiles,
  useFileNavigation,
  useFileMedia,
  useTransfers,
  useTransferSnapshot,
} from '../../../src/files/runtime';
import { filesAccentStyle } from '../../../src/files/appearance';
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
type Dialog = {
  mode: 'folder' | 'rename' | 'move' | 'copy' | 'remove' | 'restore';
  targets: FileEntry[];
};
const initialPreferences: FileViewPreferences = { view: 'grid', sort: 'name', desc: false };

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(1)} GiB`;
}

export function FilesPage({ parent, category, trash, search, navigate: routeNavigate }: Props) {
  const port = useFiles();
  const navigation = useFileNavigation();
  const transfers = useTransfers();
  const transferState = useTransferSnapshot();
  const Media = useFileMedia();
  const { t } = useFrontendTranslation();
  const [listing, setListing] = useState<FileListing>();
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const navigate = useCallback(
    (query: Record<string, string>) => {
      if (
        (query.parent ?? '') !== parent ||
        (query.category ?? '') !== category ||
        (query.trash === 'true') !== trash ||
        (query.search ?? '') !== search
      )
        setNavigating(true);
      routeNavigate(query);
    },
    [routeNavigate, parent, category, trash, search],
  );
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [saveShortcut, setSaveShortcut] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<FileEntry>();
  const [pinTarget, setPinTarget] = useState<PinTarget>();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [selected, setSelected] = useState<string[]>([]);
  const [searchText, setSearchText] = useState(search);
  const [dialog, setDialog] = useState<Dialog>();
  const [shareTarget, setShareTarget] = useState<FileEntry>();
  const [textRequest, setTextRequest] = useState<TextRequest>();
  const [mediaEntry, setMediaEntry] = useState<FileEntry>();
  const [contextEntry, setContextEntry] = useState<string>();
  const [galleryPage, setGalleryPage] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const destinationDialogOpen =
    dialog?.mode === 'move' || dialog?.mode === 'restore' || dialog?.mode === 'copy';
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
        if (!controller.signal.aborted) {
          setLoading(false);
          setNavigating(false);
        }
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
      void transfers.enqueue(candidates, parent).catch((error) => setNotice(errorText(error)));
    },
    [trash, listing, parent, port, transfers, errorText],
  );
  useEffect(() => port.subscribeDrop(enqueue), [port, enqueue]);
  useEffect(() => () => previewController.current?.abort(), []);
  const completedRevision = useRef(transferState.completedRevision);
  useEffect(() => {
    if (completedRevision.current !== transferState.completedRevision) {
      completedRevision.current = transferState.completedRevision;
      reload();
    }
  }, [transferState.completedRevision, reload]);

  function savePreferences(next: FileViewPreferences) {
    setPreferences(next);
    try {
      port.savePreferences(next);
    } catch {
      setNotice(t('files.preferencesFailure'));
    }
  }
  const openDialog = useCallback(
    (mode: Dialog['mode'], targets: FileEntry[] = []) => {
      setNotice('');
      setDialogFailure('');
      const source = targets[0];
      const dot = source?.kind === 'file' ? source.name.lastIndexOf('.') : -1;
      const copyName = source
        ? `${t('files.copyName', { name: dot > 0 ? source.name.slice(0, dot) : source.name })}${dot > 0 ? source.name.slice(dot) : ''}`
        : '';
      setName(mode === 'rename' ? (source?.name ?? '') : mode === 'copy' ? copyName : '');
      setDestination('');
      setDialog({ mode, targets });
    },
    [t],
  );
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
            if (dialog.mode === 'rename')
              await port.update(entry.id, {
                name,
                ...(entry.kind === 'shortcut' ? { expectedRevision: entry.contentRevision } : {}),
              });
            else if (dialog.mode === 'copy') await port.copy(entry.id, destination, name);
            else if (dialog.mode === 'move')
              await port.update(entry.id, {
                parentId: destination,
                ...(entry.kind === 'shortcut' ? { expectedRevision: entry.contentRevision } : {}),
              });
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
  const showPreview = useCallback(
    async (entry: FileEntry) => {
      if (entry.kind === 'shortcut') {
        navigation.openShortcut(entry.id);
        return;
      }
      if (/^(image|audio|video)\//.test(entry.mediaType)) {
        setPreview(undefined);
        setMediaEntry(entry);
        return;
      }
      setMediaEntry(undefined);
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
    },
    [port, navigation, t, errorText],
  );
  async function download(entry: FileEntry) {
    try {
      await port.download(entry);
    } catch (error) {
      setNotice(errorText(error));
    }
  }
  const targets = listing?.items.filter((entry) => selected.includes(entry.id)) ?? [];
  const pageCount = listing
    ? Math.max(1, Math.ceil(listing.items.length / listing.maxGalleryEntries))
    : 0;
  const currentGalleryPage = Math.min(galleryPage, Math.max(0, pageCount - 1));
  const visibleItems = listing
    ? preferences.view === 'gallery'
      ? listing.items.slice(
          currentGalleryPage * listing.maxGalleryEntries,
          (currentGalleryPage + 1) * listing.maxGalleryEntries,
        )
      : listing.items
    : [];
  useEffect(() => setGalleryPage(0), [parent, category, trash, search]);
  useEffect(
    () =>
      port.subscribeShortcuts((shortcut) => {
        const chosen = listing?.items.filter((entry) => selected.includes(entry.id)) ?? [];
        if (shortcut === 'search') port.focusSearch();
        else if (shortcut === 'refresh') reload();
        else if (shortcut === 'selectAll')
          setSelected(listing?.items.map((entry) => entry.id) ?? []);
        else if (shortcut === 'clearSelection') setSelected([]);
        else if (shortcut === 'newFolder' && !trash && listing) openDialog('folder');
        else if (shortcut === 'rename' && !trash && chosen.length === 1)
          openDialog('rename', chosen);
        else if (shortcut === 'trash' && !trash && chosen.length) openDialog('remove', chosen);
        else if (shortcut === 'open' && chosen.length === 1) {
          const entry = chosen[0];
          if (!entry) return;
          if (trash) openDialog('restore', [entry]);
          else if (entry.kind === 'folder') navigate({ parent: entry.id });
          else void showPreview(entry);
        }
      }),
    [port, listing, selected, trash, navigate, openDialog, showPreview, reload],
  );
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
      style={filesAccentStyle}
      className="min-h-screen bg-canvas font-sans text-ink"
    >
      <div className="mx-auto grid min-h-screen max-w-screen-2xl md:grid-cols-5">
        <aside className="border-b border-border p-4 md:border-b-0 md:p-5">
          <FileLink target="files" className="flex items-center gap-3 px-3 py-3 text-xl font-bold">
            <Cloud className="size-8 text-brand" />
            {t('files.brand')}
          </FileLink>
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
            <FileLink target="shared" className="hover:text-brand">
              {t('files.navigation.title')}
            </FileLink>
            <Action variant="quiet" size="sm" onPress={() => setSaveShortcut(true)}>
              {t('files.navigation.save')}
            </Action>
            <Action
              variant="quiet"
              size="sm"
              onPress={() => setPinTarget({ targetKind: 'folder', targetId: parent })}
            >
              {t('files.navigation.pin')}
            </Action>
            <FileLink target="shares" className="hover:text-brand">
              {t('files.myShares')}
            </FileLink>
            <FileLink target="transfers" className="hover:text-brand">
              {t('files.transferCenter')}
            </FileLink>
            <FileLink target="connections" className="hover:text-brand">
              {t('files.connections.title')}
            </FileLink>
            <FileLink target="workspace" className="flex items-center gap-3 hover:text-brand">
              <Settings className="size-5" />
              {t('files.management')}
            </FileLink>
            <FileLink target="account" className="hover:text-brand">
              {t('files.account')}
            </FileLink>
          </div>
          <PinnedLinks refreshKey={revision} />
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
        <main id="main-content" tabIndex={-1} className="min-w-0 p-4 md:col-span-4 md:p-5">
          <Page>
            <div className="flex flex-wrap items-center gap-3">
              <MenuButton
                ariaLabel={t('files.new')}
                label={
                  <span className="flex items-center gap-2">
                    <FolderPlus className="size-5" />
                    {t('files.new')}
                  </span>
                }
                items={[
                  {
                    id: 'upload',
                    label: t('files.upload'),
                    disabled: trash || !listing || loading || navigating,
                  },
                  {
                    id: 'directory',
                    label: t('files.uploadDirectory'),
                    disabled: trash || !listing || loading || navigating,
                  },
                  {
                    id: 'clipboard',
                    label: t('files.uploadClipboard'),
                    disabled: trash || !listing || loading || navigating,
                  },
                  {
                    id: 'folder',
                    label: t('files.newFolder'),
                    disabled: trash || !listing || loading || navigating,
                  },
                  {
                    id: 'text',
                    label: t('files.newText'),
                    disabled: trash || !listing || loading || navigating,
                  },
                  {
                    id: 'markdown',
                    label: t('files.newMarkdown'),
                    disabled: trash || !listing || loading || navigating,
                  },
                ]}
                onAction={(action) => {
                  if (action === 'folder') openDialog('folder');
                  else if (action === 'text' || action === 'markdown')
                    setTextRequest({ mode: action, parentId: parent });
                  else if (action === 'clipboard') {
                    port.focusFiles();
                    setNotice(t('files.clipboardHint'));
                  } else
                    void (action === 'directory' ? port.chooseDirectory() : port.chooseFiles())
                      .then(enqueue)
                      .catch((error: unknown) => setNotice(errorText(error)));
                }}
              />
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
                    <Action
                      size="sm"
                      variant={preferences.view === 'gallery' ? 'secondary' : 'quiet'}
                      onPress={() => savePreferences({ ...preferences, view: 'gallery' })}
                    >
                      {t('files.gallery')}
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
                    {!trash ? (
                      <Action
                        size="sm"
                        variant="secondary"
                        loading={archiving}
                        disabled={archiving || targets.some((entry) => entry.kind === 'shortcut')}
                        onPress={() => {
                          setArchiving(true);
                          setNotice('');
                          void port
                            .archive(selected)
                            .then(() => setNotice(t('files.archiveReady')))
                            .catch((error: unknown) => setNotice(errorText(error)))
                            .finally(() => setArchiving(false));
                        }}
                      >
                        {t('files.archive')}
                      </Action>
                    ) : null}
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
              aria-busy={loading || navigating}
              className="min-h-96 rounded-panel border border-border bg-surface p-4"
            >
              <h1 className="sr-only">{title}</h1>
              {loading || navigating ? (
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
                  {visibleItems.map((entry) => (
                    <article
                      key={entry.id}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setContextEntry(entry.id);
                        if (!selected.includes(entry.id)) setSelected([entry.id]);
                      }}
                      className={
                        preferences.view === 'grid'
                          ? 'min-w-0 rounded-panel border border-border p-4 hover:bg-surface-muted'
                          : 'flex min-w-0 flex-wrap items-center gap-4 py-3'
                      }
                    >
                      <div
                        className={
                          preferences.view === 'grid'
                            ? 'mb-3 flex items-center justify-between gap-3'
                            : 'flex w-full items-center justify-between gap-3 sm:w-auto'
                        }
                      >
                        <CheckboxField
                          label={t('files.selectFile', { name: entry.name })}
                          presentation="control-only"
                          checked={selected.includes(entry.id)}
                          onCheckedChange={(checked) =>
                            setSelected((current) =>
                              checked
                                ? [...current, entry.id]
                                : current.filter((id) => id !== entry.id),
                            )
                          }
                        />
                        <MenuButton
                          label={<MoreHorizontal className="size-5" />}
                          ariaLabel={t('files.actionsFor', { name: entry.name })}
                          triggerSize="sm"
                          isOpen={contextEntry === entry.id}
                          onOpenChange={(open) => setContextEntry(open ? entry.id : undefined)}
                          items={
                            trash
                              ? [
                                  { id: 'restore', label: t('files.restore') },
                                  ...(entry.kind === 'shortcut'
                                    ? [
                                        {
                                          id: 'purge',
                                          label: t('files.navigation.purge'),
                                          tone: 'danger' as const,
                                        },
                                      ]
                                    : []),
                                ]
                              : [
                                  { id: 'details', label: t('files.details') },
                                  { id: 'rename', label: t('files.rename') },
                                  { id: 'move', label: t('files.move') },
                                  { id: 'copy', label: t('files.copy') },
                                  ...(entry.kind === 'file'
                                    ? [
                                        { id: 'download', label: t('files.download') },
                                        ...(entry.mediaType.startsWith('text/') ||
                                        /\.(md|txt)$/i.test(entry.name)
                                          ? [{ id: 'edit', label: t('files.edit') }]
                                          : []),
                                      ]
                                    : []),
                                  ...(entry.kind === 'shortcut'
                                    ? []
                                    : [{ id: 'share', label: t('files.share') }]),
                                  ...(entry.kind === 'folder' || entry.kind === 'shortcut'
                                    ? [{ id: 'pin', label: t('files.navigation.pin') }]
                                    : []),
                                  { id: 'remove', label: t('files.remove'), tone: 'danger' },
                                ]
                          }
                          onAction={(action) => {
                            setContextEntry(undefined);
                            if (action === 'details') void showDetails(entry);
                            else if (action === 'purge') setPurgeTarget(entry);
                            else if (
                              action === 'pin' &&
                              (entry.kind === 'folder' || entry.kind === 'shortcut')
                            )
                              setPinTarget({ targetKind: entry.kind, targetId: entry.id });
                            else if (action === 'download') void download(entry);
                            else if (action === 'share') setShareTarget(entry);
                            else if (action === 'edit') setTextRequest({ mode: 'edit', entry });
                            else if (
                              action === 'rename' ||
                              action === 'move' ||
                              action === 'copy' ||
                              action === 'remove' ||
                              action === 'restore'
                            )
                              openDialog(action, [entry]);
                          }}
                        />
                      </div>
                      <div
                        className={
                          preferences.view === 'list'
                            ? 'flex min-w-0 flex-1 items-center gap-3'
                            : 'flex min-w-0 flex-col items-center gap-3 py-3'
                        }
                      >
                        {preferences.view === 'gallery' &&
                        entry.kind === 'file' &&
                        entry.mediaType.startsWith('image/') &&
                        listing ? (
                          <Media
                            key={entry.id + ':' + entry.contentRevision}
                            entry={entry}
                            mode="thumbnail"
                            maxBytes={listing.maxThumbnailBytes}
                          />
                        ) : (
                          <FileGlyph
                            kind={entry.kind}
                            mediaType={entry.mediaType}
                            size={preferences.view === 'list' ? 'small' : 'large'}
                          />
                        )}
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
                            {entry.kind === 'folder'
                              ? t('files.folder')
                              : entry.kind === 'shortcut'
                                ? t('files.navigation.shortcut')
                                : bytes(entry.sizeBytes)}
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">
                            {new Date(entry.trashedAt ?? entry.updatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            {listing && preferences.view === 'gallery' && pageCount > 1 ? (
              <div className="flex flex-wrap items-center gap-3">
                <Action
                  variant="secondary"
                  size="sm"
                  disabled={currentGalleryPage === 0}
                  onPress={() => setGalleryPage(currentGalleryPage - 1)}
                >
                  {t('files.previousPage')}
                </Action>
                <span className="text-sm text-ink-muted">
                  {t('files.galleryPage', { current: currentGalleryPage + 1, pages: pageCount })}
                </span>
                <Action
                  variant="secondary"
                  size="sm"
                  disabled={currentGalleryPage + 1 >= pageCount}
                  onPress={() => setGalleryPage(currentGalleryPage + 1)}
                >
                  {t('files.nextPage')}
                </Action>
              </div>
            ) : null}
            {listing ? (
              <p className="text-xs text-ink-muted">
                {t('files.uploadLimit', {
                  size: bytes(listing.maxFileBytes),
                  count: listing.concurrentUploads,
                })}
              </p>
            ) : null}
            <TransferPanel compact />
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
              : dialog.mode === 'copy'
                ? !folders || !name.trim()
                : dialog.mode === 'move' || dialog.mode === 'restore'
                  ? !folders
                  : false
          }
        >
          {dialog.mode === 'copy' ? (
            <TextField
              label={t('files.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : null}
          {dialog.mode === 'folder' || dialog.mode === 'rename' ? (
            <TextField
              label={t('files.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : dialog.mode === 'move' || dialog.mode === 'restore' || dialog.mode === 'copy' ? (
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
      {shareTarget ? (
        <ShareDialog entry={shareTarget} onClose={() => setShareTarget(undefined)} />
      ) : null}
      {saveShortcut ? (
        <SaveShortcutDialog
          parentId={parent}
          onClose={() => setSaveShortcut(false)}
          onSaved={() => {
            setSaveShortcut(false);
            reload();
          }}
        />
      ) : null}
      {purgeTarget ? (
        <ShortcutActionDialog
          entry={purgeTarget}
          action="purge"
          onClose={() => setPurgeTarget(undefined)}
          onChanged={() => {
            setPurgeTarget(undefined);
            reload();
          }}
        />
      ) : null}
      {pinTarget ? (
        <PinDialog
          target={pinTarget}
          onClose={() => setPinTarget(undefined)}
          onChanged={() => {
            setPinTarget(undefined);
            reload();
          }}
        />
      ) : null}
      {textRequest && listing ? (
        <TextDialog
          request={textRequest}
          maxBytes={listing.maxTextBytes}
          onClose={() => setTextRequest(undefined)}
          onSaved={() => {
            setNotice(t('files.operationDone'));
            reload();
          }}
        />
      ) : null}
      {mediaEntry && listing ? (
        <DialogSurface
          triggerLabel={t('files.mediaPreview')}
          title={mediaEntry.name}
          description={t('files.mediaPreview')}
          cancelLabel={t('files.close')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setMediaEntry(undefined);
          }}
        >
          <div className="space-y-4">
            <Media
              key={mediaEntry.id + ':' + mediaEntry.contentRevision}
              entry={mediaEntry}
              mode="preview"
              maxBytes={listing.maxMediaBytes}
            />
            <Action
              variant="secondary"
              onPress={() => {
                void download(mediaEntry);
              }}
            >
              {t('files.download')}
            </Action>
          </div>
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
                detail.entry.kind === 'folder'
                  ? t('files.folder')
                  : detail.entry.kind === 'shortcut'
                    ? t('files.navigation.shortcut')
                    : detail.entry.mediaType,
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
