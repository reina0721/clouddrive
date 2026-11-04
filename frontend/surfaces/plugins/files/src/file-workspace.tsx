'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { filesAccentStyle } from '../../../src/files/appearance';
import { formatFileBytes } from '../../../src/files/format';
import {
  Cloud,
  FileGlyph,
  FolderPlus,
  HardDrive,
  Home,
  Menu,
  Settings,
  Trash2,
  Upload,
} from '../../../src/files/icons';
import {
  FilesError,
  type FileBrowseQuery,
  type FileListing,
  type UploadCandidate,
} from '../../../src/files/model';
import { FileAccountTools, useFiles, useTransferSnapshot } from '../../../src/files/runtime';
import { transferMatches } from '../../../src/files/transfers';
import { useWorkspaceRevision, WorkspaceCreateContext } from '../stores/workspace';
import { ExplorerNavigation } from './explorer-navigation';
import { FileLink } from './file-link';
import { PinnedLinks } from './pinned-links';
import type { CreateAction } from './workspace-create';
const Create = lazy(() =>
  import('./workspace-create').then((module) => ({ default: module.WorkspaceCreate })),
);
const Transfers = lazy(() =>
  import('./transfer-panel').then((module) => ({ default: module.TransferPanel })),
);
export function FileWorkspace({
  pathname,
  query,
  children,
}: {
  pathname: string;
  query: FileBrowseQuery;
  children: ReactNode;
}) {
  const port = useFiles(),
    snapshot = useTransferSnapshot(),
    { t } = useFrontendTranslation();
  const [revision, setRevision] = useWorkspaceRevision();
  const [storage, setStorage] = useState<FileListing>(),
    [storageFailure, setStorageFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [sidebarPreference] = useState(() => {
      try {
        return { collapsed: port.loadSidebarCollapsed(), failed: false };
      } catch {
        return { collapsed: false, failed: true };
      }
    }),
    [collapsed, setCollapsed] = useState(sidebarPreference.collapsed),
    [searchDraft, setSearchDraft] = useState<{ scope: string; value: string }>(),
    [tray, setTray] = useState<string | null>(null);
  const [create, setCreate] = useState<{
    action: CreateAction;
    candidates?: readonly UploadCandidate[];
  }>();
  const isFiles = pathname === port.destinationHref('files'),
    isTransfers = pathname === port.destinationHref('transfers');
  const errorText = useCallback(
    (error: unknown) =>
      t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
    [t],
  );
  const scope = pathname + JSON.stringify(query);
  const search =
    searchDraft?.scope === scope ? searchDraft.value : isFiles ? (query.search ?? '') : '';
  const setSearch = (value: string) => setSearchDraft({ scope, value });
  useEffect(() => {
    const controller = new AbortController();
    void port
      .list(
        {
          parent: '',
          category: '',
          trash: false,
          search: '',
          sort: 'name',
          desc: false,
          pageSize: 1,
        },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) {
          setStorage(value);
          setStorageFailure('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setStorage(undefined);
          setStorageFailure(errorText(error));
        }
      });
    return () => controller.abort();
  }, [port, revision, snapshot.completedRevision, pathname, errorText]);
  useEffect(
    () => (isFiles ? undefined : port.subscribeShortcuts(() => port.focusSearch(), ['search'])),
    [port, isFiles],
  );
  // 根列表继续拥有其原有拖放；其他文件页面先确认目标，避免两个订阅重复入队。
  useEffect(
    () =>
      isFiles
        ? undefined
        : port.subscribeDrop((candidates) =>
            setCreate((current) => {
              if (current) {
                for (const candidate of candidates) port.releaseCandidate(candidate.id);
                return current;
              }
              return { action: 'upload', candidates };
            }),
          ),
    [port, isFiles],
  );
  const refresh = () => setRevision((value) => value + 1);
  const navigation = [
    { target: 'shared', label: 'files.navigation.title', icon: <Cloud /> },
    { target: 'shares', label: 'files.myShares', icon: <Cloud /> },
    { target: 'connections', label: 'files.connections.title', icon: <HardDrive /> },
    { target: 'transfers', label: 'files.transferCenter', icon: <Upload /> },
    { target: 'downloads', label: 'files.downloads.title', icon: <HardDrive /> },
    { target: 'workspace', label: 'files.management', icon: <Settings /> },
    { target: 'account', label: 'files.account', icon: <Settings /> },
  ] as const;
  const categoryItems = [
    { key: '', label: 'files.nav', icon: <Home /> },
    ...['image', 'video', 'audio', 'document'].map((key) => ({
      key,
      label: 'files.' + key,
      icon: (
        <FileGlyph kind="file" size="small" mediaType={(key === 'document' ? 'text' : key) + '/'} />
      ),
    })),
  ];
  const activeCount = snapshot.items.filter((item) => transferMatches(item, 'active')).length;
  const searchQuery = (value: string): FileBrowseQuery => ({
    ...(isFiles ? query : {}),
    search: value,
    page: '',
  });
  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      port.saveSidebarCollapsed(next);
    } catch {
      setNotice(t('files.workspace.readFailed'));
    }
  }
  const renderNavigation = (close: () => void, rail: boolean, mobile: boolean) => (
    <>
      <div
        className={
          rail ? 'flex flex-col items-center gap-2' : 'flex items-center justify-between gap-2'
        }
      >
        <FileLink
          target="files"
          title={t('files.brand')}
          onNavigate={close}
          className="flex min-w-0 items-center gap-2 px-1 py-3 text-lg font-bold"
        >
          <Cloud className="size-8 shrink-0 text-brand" />
          <span className={rail ? 'sr-only' : 'truncate'}>{t('files.brand')}</span>
        </FileLink>
        {!mobile ? (
          <Action
            size="sm"
            variant="quiet"
            leadingIcon={<Menu className="size-4" />}
            onPress={toggleSidebar}
          >
            <span className="sr-only">
              {t(collapsed ? 'files.workspace.expand' : 'files.workspace.collapse')}
            </span>
          </Action>
        ) : null}
      </div>
      <nav aria-label={t('files.nav')} className="mt-3 flex flex-col gap-1">
        {categoryItems.map((item) => {
          const active = isFiles && query.trash !== 'true' && (query.category ?? '') === item.key;
          return (
            <FileLink
              key={item.key}
              target="files"
              query={{ category: item.key }}
              title={t(item.label)}
              onNavigate={close}
              {...(active ? { 'aria-current': 'page' as const } : {})}
              className={
                'flex items-center gap-3 rounded-control px-4 py-2.5 text-sm hover:bg-surface-muted ' +
                (active ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-muted')
              }
            >
              <span className="size-5 shrink-0 overflow-hidden" aria-hidden="true">
                {item.icon}
              </span>
              <span className={rail ? 'sr-only' : ''}>{t(item.label)}</span>
            </FileLink>
          );
        })}
        <FileLink
          target="files"
          query={{ trash: 'true' }}
          title={t('files.trash')}
          onNavigate={close}
          {...(isFiles && query.trash === 'true' ? { 'aria-current': 'page' as const } : {})}
          className={
            'flex items-center gap-3 rounded-control px-4 py-2.5 text-sm hover:bg-surface-muted ' +
            (isFiles && query.trash === 'true'
              ? 'bg-brand-soft text-brand font-semibold'
              : 'text-ink-muted')
          }
        >
          <Trash2 className="size-5 shrink-0" />
          <span className={rail ? 'sr-only' : ''}>{t('files.trash')}</span>
        </FileLink>
        {navigation.map((item) => {
          const active = pathname === port.destinationHref(item.target);
          return (
            <FileLink
              key={item.target}
              target={item.target}
              title={t(item.label)}
              onNavigate={close}
              {...(active ? { 'aria-current': 'page' as const } : {})}
              className={
                'flex items-center gap-3 rounded-control px-4 py-2.5 text-sm hover:bg-surface-muted ' +
                (active ? 'bg-brand-soft text-brand font-semibold' : 'text-ink-muted')
              }
            >
              <span className="size-5 shrink-0" aria-hidden="true">
                {item.icon}
              </span>
              <span className={rail ? 'sr-only' : ''}>{t(item.label)}</span>
            </FileLink>
          );
        })}
      </nav>
      {!rail ? (
        <>
          <PinnedLinks refreshKey={revision} onNavigate={close} />
          <section
            className="mt-8 space-y-3 px-3 text-xs text-ink-muted"
            aria-label={t('files.storage')}
          >
            <h2 className="flex items-center gap-2 font-semibold">
              <HardDrive className="size-4" />
              {t('files.storage')}
            </h2>
            {storageFailure ? (
              <p role="alert">
                {t('files.workspace.quotaUnknown')} · {storageFailure}
              </p>
            ) : storage ? (
              <ProgressMeter
                value={Math.min(100, Math.round((storage.usedBytes / storage.quotaBytes) * 100))}
                label={
                  formatFileBytes(storage.usedBytes) + ' / ' + formatFileBytes(storage.quotaBytes)
                }
              />
            ) : (
              <p role="status">{t('files.workspace.quotaLoading')}</p>
            )}
            <Action size="sm" variant="quiet" onPress={refresh}>
              {t('files.workspace.storageRefresh')}
            </Action>
          </section>
        </>
      ) : null}
    </>
  );
  return (
    <div
      data-accent-preview="blue"
      style={filesAccentStyle}
      className="min-h-screen bg-canvas font-sans text-ink"
    >
      <div className="min-h-screen md:flex">
        <ExplorerNavigation collapsed={collapsed} onFocusFiles={port.focusFiles}>
          {(close, mobile) => renderNavigation(close, collapsed && !mobile, mobile)}
        </ExplorerNavigation>
        <div className="min-w-0 md:flex-1">
          <header className="flex flex-wrap items-center gap-3 border-b border-border bg-canvas p-3 md:p-4">
            <MenuButton
              ariaLabel={t('files.new')}
              label={
                <span className="flex items-center gap-2">
                  <FolderPlus className="size-5" />
                  {t('files.new')}
                </span>
              }
              items={[
                { id: 'upload', label: t('files.upload') },
                { id: 'directory', label: t('files.uploadDirectory') },
                { id: 'clipboard', label: t('files.uploadClipboard') },
                { id: 'folder', label: t('files.newFolder') },
                { id: 'text', label: t('files.newText') },
                { id: 'markdown', label: t('files.newMarkdown') },
              ]
                .map((item) => ({ ...item, disabled: query.trash === 'true' || !storage }))
                .concat([{ id: 'downloads', label: t('files.downloads.title'), disabled: false }])}
              onAction={(action) => {
                if (action === 'downloads') port.navigate('downloads');
                else if (action === 'clipboard') {
                  port.focusFiles();
                  setNotice(t('files.workspace.clipboard'));
                } else if (['folder', 'text', 'markdown', 'upload', 'directory'].includes(action))
                  setCreate({ action: action as CreateAction });
              }}
            />
            <form
              data-file-workspace-search
              className="flex w-full min-w-0 items-center gap-2 md:w-auto md:flex-1"
              onKeyDownCapture={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setSearch(isFiles ? (query.search ?? '') : '');
                  port.focusFiles();
                }
              }}
              onSubmit={(event) => {
                event.preventDefault();
                port.navigate('files', searchQuery(search));
              }}
            >
              <SearchBox
                label={t('files.search')}
                placeholder={t('files.searchPlaceholder')}
                value={search}
                onValueChange={setSearch}
              />
              <Action type="submit" variant="secondary">
                {t('files.search')}
              </Action>
              {search ? (
                <Action
                  size="sm"
                  variant="quiet"
                  onPress={() => {
                    setSearch('');
                    port.navigate('files', searchQuery(''));
                  }}
                >
                  {t('files.explorer.clearSearch')}
                </Action>
              ) : null}
            </form>
            <Action
              size="sm"
              variant="quiet"
              onPress={() => {
                if (isTransfers) port.focusFiles();
                else setTray(pathname);
              }}
              leadingIcon={<Upload className="size-5" />}
            >
              <span>
                {t('files.workspace.queue')}
                <span aria-hidden="true"> · {activeCount}</span>
                <span className="sr-only">
                  {t('files.workspace.queueCount', { count: activeCount })}
                </span>
              </span>
            </Action>
            <FileAccountTools />
          </header>
          {notice || sidebarPreference.failed ? (
            <p role="status" className="px-4 py-2 text-sm">
              {notice || t('files.workspace.readFailed')}
            </p>
          ) : null}
          <main id="main-content" tabIndex={-1} className="min-w-0 p-3 md:p-4">
            <WorkspaceCreateContext value={(action) => setCreate({ action })}>
              {children}
            </WorkspaceCreateContext>
          </main>
        </div>
      </div>
      {create ? (
        <Suspense fallback={<p role="status">{t('files.previewLoading')}</p>}>
          <Create
            action={create.action}
            initialParent={isFiles && query.trash !== 'true' ? (query.parent ?? '') : ''}
            {...(create.candidates ? { candidates: create.candidates } : {})}
            onClose={() => setCreate(undefined)}
            onChanged={(queued) => {
              setCreate(undefined);
              refresh();
              setNotice(t(queued ? 'files.workspace.queued' : 'files.operationDone'));
              if (queued && !isTransfers) setTray(pathname);
            }}
          />
        </Suspense>
      ) : null}
      {tray === pathname && !isTransfers ? (
        <DrawerSurface
          isOpen
          placement="right"
          triggerLabel={t('files.workspace.queue')}
          title={t('files.workspace.queue')}
          description={t('files.transferResumeHint')}
          closeLabel={t('files.close')}
          onOpenChange={(open) => setTray(open ? pathname : null)}
        >
          <Suspense fallback={<p>{t('files.previewLoading')}</p>}>
            <Transfers compact />
          </Suspense>
        </DrawerSurface>
      ) : null}
    </div>
  );
}
