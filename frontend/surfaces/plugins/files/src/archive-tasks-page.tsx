'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SwitchField } from '@clouddrive/ui-adapter/form-field';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import type { ArchiveTask, ArchiveTaskListing } from '../../../src/files/archives';
import { Info, Package, RefreshCw } from '../../../src/files/icons';
import { FilesError } from '../../../src/files/model';
import { useArchives } from '../../../src/files/runtime';
import { FileLink } from './file-link';
import { useFileTime } from './use-file-time';

type TaskAction = Readonly<{ type: 'cancel' | 'remove'; task: ArchiveTask }>;

export function ArchiveTasksPage() {
  const port = useArchives();
  const { t } = useFrontendTranslation();
  const time = useFileTime();
  const [listing, setListing] = useState<ArchiveTaskListing>();
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadFailure, setLoadFailure] = useState('');
  const [actionFailure, setActionFailure] = useState('');
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
    void port
      .listTasks(controller.signal)
      .then(
        (value) => {
          if (controller.signal.aborted) return;
          setListing(value);
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
  }, [port, errorText]);
  useEffect(() => {
    refresh();
    return () => {
      read.current?.abort();
      read.current = undefined;
      mutation.current?.abort();
    };
  }, [refresh]);
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
      {listing && !listing.available ? (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {t('files.archives.tasks.unavailable')}
        </p>
      ) : null}
      {loadFailure ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {loadFailure}
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
            title={t('files.archives.tasks.empty')}
            description={t('files.archives.tasks.emptyHint')}
          />
        </div>
      ) : null}
      {listing?.items.length ? (
        <ul className="mt-4 space-y-3" aria-label={t('files.archives.tasks.title')}>
          {listing.items.map((task) => {
            const canRemove =
              !task.cleanupPending && ['failed', 'canceled', 'completed'].includes(task.state);
            return (
              <li
                key={task.id}
                className="space-y-2 rounded-panel border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="min-w-0 break-words font-semibold">{task.sourceName}</h2>
                  <span className="text-sm text-ink-muted">
                    {t('files.archives.tasks.state.' + task.state)}
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
                {task.state === 'completed' ? (
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
