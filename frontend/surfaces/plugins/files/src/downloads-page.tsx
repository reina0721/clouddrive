'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFileTime } from './use-file-time';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import {
  CheckboxField,
  SelectField,
  SwitchField,
  TextField,
} from '@clouddrive/ui-adapter/form-field';
import { DialogSurface, DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  downloadBatchError,
  downloadFinished,
  type DownloadBatch,
  type DownloadBatchAction,
  type DownloadCommand,
  type DownloadFilter,
  type DownloadListing,
  type OfflineDownload,
} from '../../../src/files/downloads';
import { formatFileBytes as bytes } from '../../../src/files/format';
import { Download, Info, RefreshCw } from '../../../src/files/icons';
import { FilesError } from '../../../src/files/model';
import { useDownloads, useFiles } from '../../../src/files/runtime';
import { DownloadCreateDialog, DownloadTargetDialog } from './download-dialogs';
const TorrentFiles = lazy(() => import('./torrent-files'));

type Confirmation = Readonly<{
  action: 'restart' | 'cancel' | 'remove';
  tasks: readonly OfflineDownload[];
}>;
const statusValues = [
  'queued',
  'resolving',
  'selecting',
  'canceling',
  'fetching',
  'pausing',
  'paused',
  'publishing',
  'completed',
  'failed',
  'canceled',
  'expired',
] as const;

export function DownloadsPage() {
  const port = useDownloads(),
    files = useFiles(),
    { t } = useFrontendTranslation();
  const time = useFileTime();
  const [query, setQuery] = useState<DownloadFilter>({
    section: 'all',
    state: '',
    search: '',
    cursor: '',
  });
  const [search, setSearch] = useState(''),
    [previous, setPrevious] = useState<string[]>([]),
    [revision, setRevision] = useState(0);
  const [page, setPage] = useState<DownloadListing>(),
    [loading, setLoading] = useState(true),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState('');
  const [auto, setAuto] = useState(true),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<OfflineDownload>(),
    [target, setTarget] = useState<OfflineDownload>(),
    [confirmation, setConfirmation] = useState<Confirmation>();
  const [batchFailures, setBatchFailures] = useState<
    readonly { id: string; name: string; message: string }[]
  >([]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  useEffect(() => {
    const controller = new AbortController();
    void port
      .list(query, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setPage(value);
          setFailure('');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [port, query, revision, t]);
  useEffect(() => (auto ? port.watch(refresh) : undefined), [port, auto, refresh]);
  const selectedTasks = page?.items.filter((task) => selected.includes(task.id)) ?? [];
  const currentDetail = detail
    ? (page?.items.find((task) => task.id === detail.id) ?? detail)
    : undefined;
  function filter(change: Partial<DownloadFilter>) {
    setLoading(true);
    setSelected([]);
    setPrevious([]);
    setQuery((value) => ({ ...value, ...change, cursor: '' }));
  }
  async function command(task: OfflineDownload, action: DownloadCommand) {
    setBusy(true);
    setNotice('');
    try {
      const changed = await port.command(task, action);
      if (detail?.id === task.id) setDetail(changed);
      setNotice(t('files.downloads.changed'));
      refresh();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function batch(tasks: readonly OfflineDownload[], action: DownloadBatchAction) {
    const items: DownloadBatch['items'] = [];
    const limit = page?.batchEntries ?? 20;
    for (let offset = 0; offset < tasks.length; offset += limit) {
      const result = await port.batch(tasks.slice(offset, offset + limit), action);
      items.push(...result.items);
    }
    const failed = items.filter((item) => item.errorCode);
    setBatchFailures(
      failed.map((item) => ({
        id: item.id,
        name: tasks.find((task) => task.id === item.id)?.name ?? item.id,
        message: t(`files.errors.${downloadBatchError(item.errorCode)}`),
      })),
    );
    setSelected(failed.map((item) => item.id));
    setNotice(
      t('files.downloads.batchResult', {
        success: items.length - failed.length,
        failed: failed.length,
      }),
    );
    refresh();
  }
  async function showResult(task: OfflineDownload) {
    setBusy(true);
    try {
      const current = await port.read(task);
      if (!current.resultAvailable || !current.entryId) throw new FilesError('missing');
      const detail = await files.detail(current.entryId);
      files.openFolder(current.resultIsFolder ? detail.entry.id : detail.entry.parentId);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  const controlsDisabled = busy || loading || Boolean(failure);
  const canDownload = Boolean(
    (page?.available || page?.torrent.available) && !page?.metadataLimited,
  );
  function card(task: OfflineDownload) {
    const canRun = Boolean(
      !page?.metadataLimited &&
      (task.kind === 'bittorrent' ? page?.torrent.available : page?.available),
    );
    const percentage =
      task.declaredBytes === null
        ? undefined
        : task.declaredBytes === 0
          ? task.state === 'completed'
            ? 100
            : 0
          : Math.min(100, (task.receivedBytes / task.declaredBytes) * 100);
    return (
      <li
        key={task.id}
        data-download-id={task.id}
        className="rounded-panel border border-border bg-surface p-4"
      >
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-fit">
            <CheckboxField
              label={t('files.downloads.select', { name: task.name })}
              presentation="control-only"
              checked={selected.includes(task.id)}
              disabled={controlsDisabled}
              onCheckedChange={(checked) =>
                setSelected((value) =>
                  checked
                    ? [...new Set([...value, task.id])]
                    : value.filter((id) => id !== task.id),
                )
              }
            />
          </div>
          <Download className="size-7 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="break-all text-left font-semibold hover:text-brand"
              onClick={() => setDetail(task)}
            >
              {task.name}
            </button>
            <p className="mt-1 break-all text-xs text-ink-muted">{task.origin}</p>
            {task.kind === 'bittorrent' ? (
              <p className="mt-1 break-all text-xs text-ink-muted">
                {task.nodeName || task.nodeId} ·{' '}
                {t('files.downloads.fileSelection', {
                  selected: task.selectedCount,
                  total: task.fileCount,
                })}
              </p>
            ) : null}
            <p className="mt-1 break-all text-sm text-ink-muted">
              {task.metadataLimited
                ? t('files.downloads.metadataUnknown')
                : task.destinationAvailable
                  ? task.destinationPath
                  : t('files.downloads.directoryUnavailable')}
            </p>
          </div>
          <span className="rounded-control bg-surface-muted px-2 py-1 text-xs font-semibold">
            {t(`files.downloads.state.${task.state}`)}
          </span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-muted">
            <span>
              {bytes(task.receivedBytes)} /{' '}
              {task.declaredBytes === null
                ? t('files.downloads.unknownSize')
                : bytes(task.declaredBytes)}
            </span>
            <span>{bytes(Math.round(task.rateBytesPerSecond))}/s</span>
          </div>
          {percentage === undefined ? null : (
            <ProgressMeter value={Math.round(percentage)} label={t('files.downloads.received')} />
          )}
        </div>
        {task.failureCode ? (
          <p className="mt-3 text-sm text-danger">
            {t(`files.downloads.failure.${task.failureCode}`)}
            {task.sourceStatus ? ` (${task.sourceStatus})` : ''}
          </p>
        ) : null}
        {task.cleanupPending ? (
          <p className="mt-2 text-sm text-ink-muted">{t('files.downloads.cleanup')}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {['queued', 'resolving', 'selecting', 'fetching', 'publishing'].includes(task.state) ? (
            <Action
              size="sm"
              variant="quiet"
              disabled={controlsDisabled}
              onPress={() => {
                void command(task, 'pause');
              }}
            >
              {t('files.downloads.pause')}
            </Action>
          ) : null}
          {task.state === 'paused' ? (
            <Action
              size="sm"
              variant="quiet"
              disabled={controlsDisabled || !canRun || !task.resumable || task.cancelRequested}
              onPress={() => {
                void command(task, 'resume');
              }}
            >
              {t('files.downloads.resume')}
            </Action>
          ) : null}
          {task.state === 'failed' ? (
            <Action
              size="sm"
              variant="quiet"
              disabled={controlsDisabled || (!task.cancelRequested && (!canRun || !task.resumable))}
              onPress={() => {
                void command(task, 'retry');
              }}
            >
              {t(task.cancelRequested ? 'files.downloads.retryCleanup' : 'files.downloads.retry')}
            </Action>
          ) : null}
          {['paused', 'failed'].includes(task.state) && !task.cancelRequested ? (
            <>
              <Action
                size="sm"
                variant="quiet"
                disabled={controlsDisabled || !canRun}
                onPress={() => setConfirmation({ action: 'restart', tasks: [task] })}
              >
                {t('files.downloads.restart')}
              </Action>
              <Action
                size="sm"
                variant="quiet"
                onPress={() => setTarget(task)}
                disabled={controlsDisabled || task.metadataLimited}
              >
                {t('files.downloads.retarget')}
              </Action>
            </>
          ) : null}
          {!['completed', 'canceled', 'expired'].includes(task.state) ? (
            <Action
              size="sm"
              variant="quiet"
              disabled={controlsDisabled}
              onPress={() => setConfirmation({ action: 'cancel', tasks: [task] })}
            >
              {t('files.downloads.cancel')}
            </Action>
          ) : null}
          {task.state === 'completed' ? (
            <Action
              size="sm"
              variant="quiet"
              disabled={controlsDisabled || !task.resultAvailable}
              onPress={() => {
                void showResult(task);
              }}
            >
              {t('files.downloads.openResult')}
            </Action>
          ) : null}
          {downloadFinished(task) ? (
            <Action
              size="sm"
              variant="quiet"
              disabled={controlsDisabled}
              onPress={() => setConfirmation({ action: 'remove', tasks: [task] })}
            >
              {t('files.downloads.remove')}
            </Action>
          ) : null}
          <Action size="sm" variant="quiet" onPress={() => setDetail(task)}>
            {t(
              task.state === 'selecting'
                ? 'files.downloads.selectFiles'
                : 'files.downloads.details',
            )}
          </Action>
        </div>
        {['paused', 'failed'].includes(task.state) && !task.resumable ? (
          <p className="mt-2 text-xs text-ink-muted">{t('files.downloads.noResume')}</p>
        ) : null}
      </li>
    );
  }
  return (
    <>
      <Page>
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Action disabled={!canDownload || loading} onPress={() => setCreating(true)}>
              {t('files.downloads.create')}
            </Action>
            <div className="w-fit">
              <SwitchField
                label={t('files.downloads.autoRefresh')}
                description=""
                presentation="row"
                checked={auto}
                onCheckedChange={setAuto}
              />
            </div>
          </header>
          <section className="mt-5 flex-1 rounded-panel border border-border bg-surface p-4 sm:p-6">
            <PageHeader
              title={t('files.downloads.title')}
              description={t('files.downloads.subtitle')}
              actions={
                <Action
                  variant="quiet"
                  disabled={busy}
                  leadingIcon={<RefreshCw className="size-4" />}
                  onPress={refresh}
                >
                  {t('files.downloads.refresh')}
                </Action>
              }
            />
            {page && !page.available && !page.torrent.available ? (
              <p role="status" className="mt-3 text-sm text-ink-muted">
                {t('files.downloads.unavailable')}
              </p>
            ) : null}
            {page?.metadataLimited ? (
              <p role="status" className="mt-3 text-sm text-ink-muted">
                {t('files.downloads.metadataLimited')}
              </p>
            ) : null}
            <form
              className="my-5 flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                filter({ search });
              }}
            >
              <div className="min-w-48 flex-1">
                <TextField
                  label={t('files.downloads.search')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="w-full sm:w-52">
                <SelectField
                  label={t('files.downloads.statusFilter')}
                  value={query.state}
                  options={[
                    { value: '', label: t('files.downloads.anyStatus') },
                    ...statusValues.map((state) => ({
                      value: state,
                      label: t(`files.downloads.state.${state}`),
                    })),
                  ]}
                  onValueChange={(value) => filter({ state: value as DownloadFilter['state'] })}
                />
              </div>
              <Action type="submit" variant="secondary">
                {t('files.downloads.searchAction')}
              </Action>
            </form>
            <div className="mb-4 flex flex-wrap gap-2">
              {(['all', 'active', 'finished'] as const).map((section) => (
                <Action
                  key={section}
                  variant={query.section === section ? 'primary' : 'quiet'}
                  onPress={() => filter({ section })}
                >
                  {t(`files.downloads.${section}`)}{' '}
                  {section === 'active'
                    ? (page?.activeCount ?? 0)
                    : section === 'finished'
                      ? (page?.finishedCount ?? 0)
                      : (page?.totalCount ?? 0)}
                </Action>
              ))}
            </div>
            <div
              role="status"
              aria-live="polite"
              className="my-3 break-words text-sm text-ink-muted"
            >
              {notice}
            </div>
            {failure ? (
              <StateSurface
                compact
                state="error"
                icon={<Info />}
                title={failure}
                description={t('files.downloads.readLatest')}
                actionLabel={t('files.downloads.readLatest')}
                onAction={refresh}
                announcement="urgent"
              />
            ) : null}
            {batchFailures.length ? (
              <ul role="status" className="my-3 space-y-2 text-sm text-danger">
                {batchFailures.map((item) => (
                  <li key={item.id} className="break-words">
                    {item.name}: {item.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {loading ? (
              <StateSurface
                compact
                state="loading"
                icon={<RefreshCw />}
                title={t('files.downloads.loading')}
                description={t('files.downloads.subtitle')}
                announcement="polite"
              />
            ) : null}
            {page?.items.length ? (
              <div className="my-4 flex flex-wrap items-center gap-2">
                <div className="w-fit">
                  <CheckboxField
                    label={t('files.downloads.selectAll')}
                    checked={page.items.every((task) => selected.includes(task.id))}
                    disabled={controlsDisabled}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? page.items.map((task) => task.id) : [])
                    }
                  />
                </div>
                <span className="text-sm text-ink-muted">
                  {t('files.downloads.selected', { count: selectedTasks.length })}
                </span>
                {selectedTasks.length ? (
                  <>
                    <Action
                      size="sm"
                      variant="quiet"
                      disabled={!selectedTasks.length || controlsDisabled}
                      onPress={() => setSelected([])}
                    >
                      {t('files.downloads.clearSelection')}
                    </Action>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={!selectedTasks.length || controlsDisabled}
                      onPress={() => {
                        setBusy(true);
                        void batch(selectedTasks, 'pause')
                          .catch((error: unknown) => setNotice(errorText(error)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      {t('files.downloads.batchPause')}
                    </Action>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={!selectedTasks.length || controlsDisabled || !canDownload}
                      onPress={() => {
                        setBusy(true);
                        void batch(selectedTasks, 'resume')
                          .catch((error: unknown) => setNotice(errorText(error)))
                          .finally(() => setBusy(false));
                      }}
                    >
                      {t('files.downloads.batchResume')}
                    </Action>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={!selectedTasks.length || controlsDisabled}
                      onPress={() => setConfirmation({ action: 'cancel', tasks: selectedTasks })}
                    >
                      {t('files.downloads.batchCancel')}
                    </Action>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={!selectedTasks.length || controlsDisabled}
                      onPress={() => setConfirmation({ action: 'remove', tasks: selectedTasks })}
                    >
                      {t('files.downloads.batchRemove')}
                    </Action>
                  </>
                ) : null}
              </div>
            ) : null}
            {(['active', 'finished'] as const).map((section) => {
              if (query.section !== 'all' && query.section !== section) return null;
              const tasks =
                page?.items.filter((task) => downloadFinished(task) === (section === 'finished')) ??
                [];
              return (
                <Section
                  key={section}
                  title={t(`files.downloads.${section}`)}
                  appearance="embedded"
                >
                  {tasks.length ? (
                    <ul className="grid gap-3 xl:grid-cols-2">{tasks.map(card)}</ul>
                  ) : !loading && !failure ? (
                    <StateSurface
                      compact
                      state="empty"
                      icon={<Download />}
                      title={t('files.downloads.empty')}
                      description={t('files.downloads.emptyHint')}
                    />
                  ) : null}
                </Section>
              );
            })}
            <nav
              aria-label={t('files.downloads.title')}
              className="mt-6 flex justify-between gap-3"
            >
              <Action
                variant="quiet"
                disabled={loading || !previous.length}
                onPress={() => {
                  const cursor = previous.at(-1) ?? '';
                  setPrevious((value) => value.slice(0, -1));
                  setSelected([]);
                  setLoading(true);
                  setQuery((value) => ({ ...value, cursor }));
                }}
              >
                {t('files.downloads.previous')}
              </Action>
              <Action
                variant="quiet"
                disabled={loading || !page?.nextCursor}
                onPress={() => {
                  if (!page?.nextCursor) return;
                  setPrevious((value) => [...value, query.cursor]);
                  setSelected([]);
                  setLoading(true);
                  setQuery((value) => ({ ...value, cursor: page.nextCursor }));
                }}
              >
                {t('files.downloads.next')}
              </Action>
            </nav>
          </section>
        </section>
      </Page>
      {creating && page ? (
        <DownloadCreateDialog
          limit={page.batchEntries}
          httpAvailable={page.available}
          torrent={page.torrent}
          onClose={() => setCreating(false)}
          onCreated={refresh}
        />
      ) : null}
      {target ? (
        <DownloadTargetDialog
          task={target}
          onClose={() => setTarget(undefined)}
          onSaved={() => {
            setTarget(undefined);
            refresh();
          }}
        />
      ) : null}
      {currentDetail ? (
        <DrawerSurface
          triggerLabel={t('files.downloads.details')}
          title={currentDetail.name}
          description={t('files.downloads.details')}
          closeLabel={t('files.downloads.close')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setDetail(undefined);
          }}
        >
          <div className="space-y-4 break-words">
            {currentDetail.kind === 'bittorrent' ? (
              <Suspense fallback={<p role="status">{t('files.downloads.loading')}</p>}>
                <TorrentFiles key={currentDetail.id} task={currentDetail} onSaved={refresh} />
              </Suspense>
            ) : null}
            <p>{t(`files.downloads.state.${currentDetail.state}`)}</p>
            <p>{currentDetail.origin}</p>
            <p>{currentDetail.destinationPath}</p>
            <p>
              {bytes(currentDetail.receivedBytes)} /{' '}
              {currentDetail.declaredBytes === null
                ? t('files.downloads.unknownSize')
                : bytes(currentDetail.declaredBytes)}
            </p>
            <dl className="space-y-3">
              {(
                [
                  ['created', currentDetail.createdAt],
                  ['started', currentDetail.startedAt],
                  ['finishedAt', currentDetail.finishedAt],
                  ['expires', currentDetail.expiresAt],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-ink-muted">{t(`files.downloads.${label}`)}</dt>
                  <dd>{value ? time.full(value) : '—'}</dd>
                </div>
              ))}
              <div>
                <dt>{t('files.downloads.attempts')}</dt>
                <dd>{currentDetail.attempts}</dd>
              </div>
            </dl>
            {currentDetail.failureCode ? (
              <p className="text-danger">
                {t(`files.downloads.failure.${currentDetail.failureCode}`)}
              </p>
            ) : null}
            <p className="text-sm text-ink-muted">{t('files.downloads.privateSource')}</p>
            <Action
              variant="secondary"
              disabled={busy || !currentDetail.canCopySource}
              onPress={() => {
                void port
                  .copySource(currentDetail)
                  .then(() => setNotice(t('files.downloads.copied')))
                  .catch((error: unknown) => setNotice(errorText(error)));
              }}
            >
              {t('files.downloads.copySource')}
            </Action>
            <Action
              variant="secondary"
              onPress={() => {
                void port
                  .read(currentDetail)
                  .then(setDetail)
                  .catch((error: unknown) => setNotice(errorText(error)));
              }}
            >
              {t('files.downloads.readLatest')}
            </Action>
          </div>
        </DrawerSurface>
      ) : null}
      {confirmation ? (
        <DialogSurface
          triggerLabel={t(`files.downloads.${confirmation.action}`)}
          title={t(`files.downloads.${confirmation.action}`)}
          description={t(`files.downloads.${confirmation.action}Hint`)}
          cancelLabel={t('files.cancel')}
          confirmLabel={t('files.downloads.confirm')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setConfirmation(undefined);
          }}
          onConfirm={async () => {
            setBusy(true);
            try {
              if (confirmation.tasks.length > 1 && confirmation.action !== 'restart')
                await batch(confirmation.tasks, confirmation.action);
              else {
                const task = confirmation.tasks[0];
                if (!task) throw new FilesError('invalid');
                if (confirmation.action === 'remove') {
                  await port.remove(task);
                  if (detail?.id === task.id) setDetail(undefined);
                  setNotice(t('files.downloads.removeDone'));
                } else await port.command(task, confirmation.action);
                refresh();
              }
            } catch (error) {
              setNotice(errorText(error));
              throw error;
            } finally {
              setBusy(false);
            }
          }}
        >
          <ul className="max-h-48 space-y-2 overflow-auto">
            {confirmation.tasks.map((task) => (
              <li key={task.id} className="break-all">
                {task.name}
              </li>
            ))}
          </ul>
        </DialogSurface>
      ) : null}
    </>
  );
}
