'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, SwitchField, TextField } from '@clouddrive/ui-adapter/form-field';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import type { ArchiveTask } from '../../../src/files/archives';
import {
  backgroundTaskKinds,
  backgroundTaskStatuses,
  isBackgroundDownload,
  type BackgroundDownload,
  type BackgroundTaskListing,
  type BackgroundTaskQuery,
} from '../../../src/files/background-tasks';
import { Info, Package, RefreshCw } from '../../../src/files/icons';
import { FilesError } from '../../../src/files/model';
import { useArchives, useDownloads, useFiles } from '../../../src/files/runtime';
import { DownloadTaskProgress } from './download-task-progress';
import { openDownloadResult } from './download-result';
import { FileLink } from './file-link';
import { useFileTime } from './use-file-time';

type TaskAction = Readonly<{ type: 'cancel' | 'remove'; task: ArchiveTask }>;
const initialQuery: BackgroundTaskQuery = { kind: 'all', status: 'all', search: '', page: 1 };

export function ArchiveTasksPage() {
  const port = useArchives();
  const downloads = useDownloads();
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const time = useFileTime();
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState('');
  const [response, setResponse] = useState<{
    query: BackgroundTaskQuery;
    listing: BackgroundTaskListing;
  }>();
  const listing = response?.query === query ? response.listing : undefined;
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadFailure, setLoadFailure] = useState('');
  const [actionFailure, setActionFailure] = useState('');
  const [resultFailure, setResultFailure] = useState('');
  const [resultBusy, setResultBusy] = useState(false);
  const [action, setAction] = useState<TaskAction>();
  const read = useRef<AbortController | undefined>(undefined);
  const mutation = useRef<AbortController | undefined>(undefined);
  const errorText = useCallback(
    (error: unknown) =>
      t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
    [t],
  );
  const refresh = useCallback(() => {
    if (read.current) return;
    const controller = new AbortController();
    read.current = controller;
    setLoading(true);
    void files
      .listBackgroundTasks(query, controller.signal)
      .then(
        (value) => {
          if (controller.signal.aborted) return;
          setResponse({ query, listing: value });
          setLoadFailure('');
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setLoadFailure(errorText(error));
        },
      )
      .finally(() => {
        if (read.current !== controller) return;
        read.current = undefined;
        setLoading(false);
      });
  }, [files, query, errorText]);
  useEffect(() => {
    refresh();
    return () => {
      read.current?.abort();
      read.current = undefined;
    };
  }, [refresh]);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(
    () => (autoRefresh ? port.watchTasks(refresh) : undefined),
    [autoRefresh, port, refresh],
  );

  async function performAction(selected: TaskAction) {
    const controller = new AbortController();
    mutation.current = controller;
    setActionFailure('');
    try {
      if (selected.type === 'cancel') await port.cancelTask(selected.task.id, controller.signal);
      else await port.removeTask(selected.task.id, controller.signal);
      if (!controller.signal.aborted) {
        read.current?.abort();
        read.current = undefined;
        refresh();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setActionFailure(errorText(error));
        refresh();
      }
      throw error;
    } finally {
      if (mutation.current === controller) mutation.current = undefined;
    }
  }

  async function visitZIP(task: ArchiveTask, action: 'find' | 'download') {
    setResultFailure('');
    setResultBusy(true);
    try {
      const { entry } = await files.detail(task.resultEntryId);
      if (action === 'download') await files.download(entry);
      else files.navigate('files', { parent: entry.parentId, search: entry.name });
    } catch (error) {
      setResultFailure(errorText(error));
    } finally {
      setResultBusy(false);
    }
  }

  async function visitDownload(task: BackgroundDownload) {
    setResultFailure('');
    setResultBusy(true);
    try {
      await openDownloadResult(files, downloads, task);
    } catch (error) {
      setResultFailure(errorText(error));
    } finally {
      setResultBusy(false);
    }
  }

  function updateQuery(change: Partial<BackgroundTaskQuery>) {
    read.current?.abort();
    read.current = undefined;
    setLoadFailure('');
    setQuery((value) => ({ ...value, page: 1, ...change }));
  }

  const filtered = query.kind !== 'all' || query.status !== 'all' || Boolean(query.search.trim());
  const pageCount = listing ? Math.ceil(listing.total / listing.pageSize) : 0;

  return (
    <section
      className="flex h-full min-w-0 flex-col p-4 sm:p-6"
      aria-labelledby="archive-tasks-title"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 id="archive-tasks-title" className="text-xl font-semibold">
            {t('files.archives.tasks.title')}
          </h1>
          <IconAction
            label={t('files.downloads.refresh')}
            size="sm"
            onPress={refresh}
            disabled={loading}
          >
            <RefreshCw className="size-4" />
          </IconAction>
        </div>
        <div className="w-fit">
          <SwitchField
            label={t('files.downloads.autoRefresh')}
            description=""
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
            presentation="row"
          />
        </div>
      </header>
      {response && !response.listing.archiveAvailable ? (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {t('files.archives.tasks.unavailable')}
        </p>
      ) : null}
      {response?.listing.unfilteredTotal || filtered ? (
        <form
          className="my-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            updateQuery({ search });
          }}
        >
          <div className="w-full sm:w-52">
            <SelectField
              label={t('files.archives.tasks.typeFilter')}
              value={query.kind}
              options={backgroundTaskKinds.map((kind) => ({
                value: kind,
                label: t('files.archives.tasks.kind.' + kind),
              }))}
              onValueChange={(value) => updateQuery({ kind: value as BackgroundTaskQuery['kind'] })}
            />
          </div>
          <div className="w-full sm:w-52">
            <SelectField
              label={t('files.downloads.statusFilter')}
              value={query.status}
              options={backgroundTaskStatuses.map((status) => ({
                value: status,
                label: t('files.archives.tasks.status.' + status),
              }))}
              onValueChange={(value) =>
                updateQuery({ status: value as BackgroundTaskQuery['status'] })
              }
            />
          </div>
          <div className="min-w-48 flex-1">
            <TextField
              label={t('files.archives.tasks.search')}
              value={search}
              maxLength={120}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Action type="submit" variant="secondary">
            {t('files.downloads.searchAction')}
          </Action>
          {filtered || search ? (
            <Action
              variant="quiet"
              onPress={() => {
                setSearch('');
                updateQuery(initialQuery);
              }}
            >
              {t('files.archives.tasks.clearFilters')}
            </Action>
          ) : null}
        </form>
      ) : null}
      {loadFailure ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {loadFailure}
        </p>
      ) : null}
      {resultFailure ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {resultFailure}
        </p>
      ) : null}
      {!listing && !loadFailure ? (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {t('files.downloads.loading')}
        </p>
      ) : null}
      {listing?.items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <StateSurface
            compact
            state="empty"
            icon={<Package />}
            title={t('files.archives.tasks.' + (filtered ? 'noMatches' : 'empty'))}
            description={t('files.archives.tasks.' + (filtered ? 'noMatchesHint' : 'emptyHint'))}
          />
        </div>
      ) : null}
      {listing?.items.length ? (
        <ul className="mt-4 space-y-3" aria-label={t('files.archives.tasks.title')}>
          {listing.items.map((task) => {
            if (isBackgroundDownload(task)) {
              return (
                <li
                  key={`${task.kind}:${task.id}`}
                  className="space-y-2 rounded-panel border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="min-w-0 break-words font-semibold">{task.sourceName}</h2>
                    <span className="text-sm text-ink-muted">
                      {t('files.archives.tasks.kind.' + task.kind)} ·{' '}
                      <span>{t('files.downloads.state.' + task.state)}</span>
                    </span>
                  </div>
                  <time className="text-xs text-ink-muted" dateTime={task.updatedAt}>
                    {time.full(task.updatedAt)}
                  </time>
                  <DownloadTaskProgress task={task} />
                  {task.failureCode ? (
                    <p className="flex items-center gap-2 text-sm text-danger">
                      <Info className="size-4 shrink-0" aria-hidden="true" />
                      {t('files.downloads.failure.' + task.failureCode)}
                      {task.sourceStatus ? ` (${task.sourceStatus})` : ''}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <FileLink
                      target="downloads"
                      query={{ task: task.id }}
                      className="text-sm text-brand underline"
                    >
                      {t('files.archives.tasks.downloadDetails')}
                    </FileLink>
                    {task.state === 'completed' ? (
                      <Action
                        size="sm"
                        variant="quiet"
                        disabled={resultBusy}
                        onPress={() => void visitDownload(task)}
                      >
                        {t('files.downloads.openResult')}
                      </Action>
                    ) : null}
                  </div>
                </li>
              );
            }
            const canRemove =
              !task.cleanupPending && ['failed', 'canceled', 'completed'].includes(task.state);
            return (
              <li
                key={`${task.kind}:${task.id}`}
                className="space-y-2 rounded-panel border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="min-w-0 break-words font-semibold">{task.sourceName}</h2>
                  <span className="text-sm text-ink-muted">
                    {t('files.archives.tasks.kind.' + task.kind)} ·{' '}
                    <span>
                      {t(
                        task.kind === 'zip' && task.state === 'running'
                          ? 'files.archives.createZIP.running'
                          : 'files.archives.tasks.state.' + task.state,
                      )}
                    </span>
                  </span>
                </div>
                <time className="text-xs text-ink-muted" dateTime={task.updatedAt}>
                  {time.full(task.updatedAt)}
                </time>
                {task.failureCode ? (
                  <p className="flex items-center gap-2 text-sm text-danger">
                    <Info className="size-4 shrink-0" aria-hidden="true" />
                    {t('files.archives.tasks.failure.' + task.failureCode)}
                  </p>
                ) : null}
                {task.cleanupPending ? (
                  <p className="text-sm text-ink-muted">{t('files.archives.tasks.cleanup')}</p>
                ) : null}
                {task.state === 'completed' && task.kind === 'extract' ? (
                  <p className="text-sm">
                    {t('files.archives.created', { count: task.createdCount })} ·{' '}
                    {t('files.archives.skipped', { count: task.skippedCount })} ·{' '}
                    {t('files.archives.renamed', { count: task.renamedCount })}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  {task.state === 'completed' ? (
                    <FileLink
                      target="files"
                      query={{ parent: task.destinationId }}
                      className="text-sm text-brand underline"
                    >
                      {t('files.archives.openTarget')}
                    </FileLink>
                  ) : null}
                  {task.state === 'completed' && task.resultEntryId ? (
                    <>
                      <Action
                        size="sm"
                        variant="quiet"
                        disabled={resultBusy}
                        onPress={() => void visitZIP(task, 'find')}
                      >
                        {t('files.archives.createZIP.find')}
                      </Action>
                      <Action
                        size="sm"
                        variant="quiet"
                        disabled={resultBusy}
                        onPress={() => void visitZIP(task, 'download')}
                      >
                        {t('files.archives.createZIP.download')}
                      </Action>
                    </>
                  ) : null}
                  {task.state === 'queued' ? (
                    <Action
                      size="sm"
                      variant="quiet"
                      onPress={() => {
                        setActionFailure('');
                        setAction({ type: 'cancel', task });
                      }}
                    >
                      {t('files.archives.tasks.cancel')}
                    </Action>
                  ) : null}
                  {canRemove ? (
                    <Action
                      size="sm"
                      variant="quiet"
                      onPress={() => {
                        setActionFailure('');
                        setAction({ type: 'remove', task });
                      }}
                    >
                      {t('files.archives.tasks.remove')}
                    </Action>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {listing && pageCount > 1 ? (
        <nav
          aria-label={t('files.archives.tasks.pagination')}
          className="mt-6 flex flex-wrap items-center justify-between gap-3"
        >
          <Action
            variant="quiet"
            disabled={loading || listing.page === 1}
            onPress={() => updateQuery({ page: listing.page - 1 })}
          >
            {t('files.downloads.previous')}
          </Action>
          <span className="text-sm text-ink-muted">
            {t('files.archives.tasks.page', { page: listing.page, count: pageCount })}
          </span>
          <Action
            variant="quiet"
            disabled={loading || listing.page === pageCount}
            onPress={() => updateQuery({ page: listing.page + 1 })}
          >
            {t('files.downloads.next')}
          </Action>
        </nav>
      ) : null}
      {action ? (
        <DialogSurface
          isOpen
          triggerLabel={t('files.archives.tasks.' + action.type)}
          title={t('files.archives.tasks.' + action.type)}
          description={t('files.archives.tasks.' + action.type + 'Hint', {
            name: action.task.sourceName,
          })}
          confirmLabel={t('files.archives.tasks.' + action.type)}
          cancelLabel={t('files.close')}
          failureMessage={actionFailure}
          onOpenChange={(open) => {
            if (!open) setAction(undefined);
          }}
          onConfirm={() => performAction(action)}
          children={null}
        />
      ) : null}
    </section>
  );
}
