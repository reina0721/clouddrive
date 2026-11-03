'use client';
import { useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import {
  useApiWorkbenchPort,
  type ApiCollection,
  type ApiRequestDefinition,
  type TaskDefinition,
} from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { DestructiveConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { SelectField, SwitchField, TextField } from '@clouddrive/ui-adapter/form-field';
import { Clock, Play, Plus, Trash2 } from 'lucide-react';
import { runCollectionBatch } from '../model/runner';
import { useWorkbenchStore } from '../../stores/workbench';
import { isValidSchedule } from '../model/schedule';
import { useWorkbenchFormat } from './use-workbench-format';
export type TasksViewProps = Readonly<{
  collections: readonly ApiCollection[];
  requests: readonly ApiRequestDefinition[];
  tasks: readonly TaskDefinition[];
  envVars: Record<string, string>;
  globalVars: Record<string, string>;
  onTasksChange: (tasks: readonly TaskDefinition[]) => Promise<void>;
}>;
export function TasksView({
  collections,
  requests,
  tasks,
  envVars,
  globalVars,
  onTasksChange,
}: TasksViewProps) {
  const { t } = useFrontendTranslation();
  const format = useWorkbenchFormat();
  const port = useApiWorkbenchPort();
  const scheduling = port.capabilities.persistentTasks;
  const [newName, setNewName] = useState('');
  const [newColId, setNewColId] = useState(collections[0]?.id ?? '');
  const [newCron, setNewCron] = useState('*/5 * * * *');
  const [adding, setAdding] = useState(false);
  const [touched, setTouched] = useState(false);
  const [localPending, setPending] = useState<string | null>(null);
  const runningTaskId = useWorkbenchStore((state) => state.runningTaskId);
  const pending = localPending ?? runningTaskId;
  const unsavedRun = useWorkbenchStore((state) => state.unsavedTaskRun);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskDefinition | null>(null);
  const perform = async (id: string, action: () => Promise<void>) => {
    if (pendingRef.current || useWorkbenchStore.getState().runningTaskId) return;
    pendingRef.current = true;
    setPending(id);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(t('apiWorkbench.feedback.saveFailed'));
      throw failure;
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  };
  const runNow = async (task: TaskDefinition) => {
    if (pendingRef.current || useWorkbenchStore.getState().runningTaskId) return;
    useWorkbenchStore.getState().setRunningTaskId(task.id);
    pendingRef.current = true;
    setPending(task.id);
    setError(null);
    try {
      const result = await runCollectionBatch(
        requests.filter((request) => request.collectionId === task.targetCollectionId),
        envVars,
        globalVars,
        port.transport,
      );
      const message = t('apiWorkbench.tasks.result', {
        passed: format.count(result.passed),
        failed: format.count(result.failed),
        total: format.count(result.total),
      });
      const completed: TaskDefinition = {
        ...task,
        lastRun: {
          time: new Date().toISOString(),
          passed: result.failed === 0 && result.items.some((item) => !item.skipped),
          message,
        },
      };
      try {
        await onTasksChange(tasks.map((item) => (item.id === task.id ? completed : item)));
      } catch {
        useWorkbenchStore.getState().setUnsavedTaskRun(completed);
        setError(t('apiWorkbench.tasks.runSaveFailed'));
      }
    } catch {
      setError(t('apiWorkbench.feedback.executionFailed'));
    } finally {
      useWorkbenchStore.getState().setRunningTaskId(null);
      pendingRef.current = false;
      setPending(null);
    }
  };
  return (
    <div className="@container/editor grid min-w-0 gap-4">
      {!scheduling && (
        <AlertBanner
          tone="info"
          icon={<Clock className="size-5" />}
          title={t('apiWorkbench.tasks.noticeTitle')}
          description={t('apiWorkbench.tasks.notice')}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{t('apiWorkbench.tasks.title')}</h3>
        {!adding && (
          <Action
            variant="secondary"
            size="sm"
            disabled={collections.length === 0 || Boolean(pending)}
            leadingIcon={<Plus className="size-4" />}
            onPress={() => {
              setAdding(true);
              setTouched(false);
            }}
          >
            {t('apiWorkbench.tasks.add')}
          </Action>
        )}
      </div>
      {collections.length === 0 && (
        <p className="text-sm leading-6 text-ink-muted">
          {t('apiWorkbench.tasks.emptyCollection')}
        </p>
      )}
      {unsavedRun && (
        <div
          role="group"
          aria-label={t('apiWorkbench.tasks.unsavedRecord')}
          className="grid gap-3 rounded-control border border-border p-3"
        >
          <time className="text-xs text-ink-muted" dateTime={unsavedRun.lastRun?.time}>
            {unsavedRun.lastRun ? format.timestamp(unsavedRun.lastRun.time) : ''}
          </time>
          <p className="break-words text-sm text-ink">{unsavedRun.lastRun?.message}</p>
          <p className="text-sm text-danger">{t('apiWorkbench.tasks.runSaveFailed')}</p>
          <div>
            <Action
              variant="secondary"
              size="sm"
              loading={pending === 'record'}
              disabled={Boolean(pending)}
              onPress={() => {
                void perform('record', async () => {
                  await onTasksChange(
                    tasks.map((task) => (task.id === unsavedRun.id ? unsavedRun : task)),
                  );
                  useWorkbenchStore.getState().setUnsavedTaskRun(null);
                }).catch(() => undefined);
              }}
            >
              {t('apiWorkbench.tasks.retryRecord')}
            </Action>
          </div>
        </div>
      )}
      {error && !unsavedRun && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {adding && (
        <div className="grid min-w-0 gap-4 rounded-panel border border-border p-4">
          <TextField
            label={t('apiWorkbench.tasks.name')}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <div className="grid min-w-0 gap-3 @lg/editor:grid-cols-2">
            <SelectField
              label={t('apiWorkbench.tasks.target')}
              options={collections.map((collection) => ({
                value: collection.id,
                label: collection.name,
              }))}
              value={newColId}
              onValueChange={setNewColId}
            />
            <TextField
              label={t('apiWorkbench.tasks.cron')}
              value={newCron}
              hint={t('apiWorkbench.tasks.scheduleHint')}
              {...(touched && !isValidSchedule(newCron)
                ? { error: t('apiWorkbench.tasks.invalidSchedule') }
                : {})}
              onBlur={() => setTouched(true)}
              onChange={(event) => setNewCron(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Action
              variant="secondary"
              size="sm"
              disabled={Boolean(pending)}
              onPress={() => setAdding(false)}
            >
              {t('apiWorkbench.common.cancel')}
            </Action>
            <Action
              size="sm"
              loading={pending === 'create'}
              disabled={!newName.trim() || !newColId || !isValidSchedule(newCron)}
              onPress={() => {
                void perform('create', async () => {
                  await onTasksChange([
                    ...tasks,
                    {
                      id: `task_${Date.now().toString(36)}`,
                      name: newName.trim(),
                      targetCollectionId: newColId,
                      cronOrInterval: newCron.trim(),
                      enabled: scheduling,
                    },
                  ]);
                  setNewName('');
                  setAdding(false);
                }).catch(() => undefined);
              }}
            >
              {t('apiWorkbench.tasks.save')}
            </Action>
          </div>
        </div>
      )}
      {tasks.length === 0 && (
        <p className="py-6 text-sm text-ink-muted">{t('apiWorkbench.tasks.empty')}</p>
      )}
      <div className="grid min-w-0 gap-4">
        {tasks.map((task) => {
          const collection = collections.find((item) => item.id === task.targetCollectionId);
          const count = requests.filter(
            (request) => request.collectionId === task.targetCollectionId,
          ).length;
          return (
            <div
              key={task.id}
              role="group"
              aria-label={task.name}
              className="grid min-w-0 gap-3 rounded-panel border border-border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words text-sm font-semibold text-ink">
                  {task.name}
                </span>
                <StatusPill tone={scheduling && task.enabled ? 'success' : 'neutral'}>
                  {t(
                    !scheduling
                      ? 'apiWorkbench.tasks.configured'
                      : task.enabled
                        ? 'apiWorkbench.tasks.scheduled'
                        : 'apiWorkbench.tasks.paused',
                  )}
                </StatusPill>
              </div>
              <dl className="grid min-w-0 gap-2 text-xs leading-5">
                <div>
                  <dt className="text-ink-muted">{t('apiWorkbench.tasks.target')}</dt>
                  <dd className="break-words text-ink">
                    {collection?.name ?? task.targetCollectionId}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t('apiWorkbench.tasks.cron')}</dt>
                  <dd className="break-all font-mono text-ink">{task.cronOrInterval}</dd>
                </div>
              </dl>
              {task.lastRun && (
                <div className="grid min-w-0 gap-1 border-t border-border pt-3 text-xs leading-5">
                  <span className="text-ink-muted">
                    {t('apiWorkbench.tasks.lastRun')}:{' '}
                    <time dateTime={task.lastRun.time}>{format.timestamp(task.lastRun.time)}</time>
                  </span>
                  <p
                    className={
                      task.lastRun.passed ? 'break-words text-success' : 'break-words text-danger'
                    }
                  >
                    {task.lastRun.message}
                  </p>
                </div>
              )}
              <div className="grid min-w-0 gap-3 border-t border-border pt-3">
                <SwitchField
                  label={t('apiWorkbench.tasks.status')}
                  description=""
                  checked={scheduling && task.enabled}
                  presentation="row"
                  disabled={!scheduling || Boolean(pending)}
                  onCheckedChange={(enabled) => {
                    void perform(task.id, () =>
                      onTasksChange(
                        tasks.map((item) => (item.id === task.id ? { ...item, enabled } : item)),
                      ),
                    ).catch(() => undefined);
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Action
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Play className="size-4" />}
                    loading={pending === task.id}
                    disabled={Boolean(pending) || Boolean(unsavedRun) || count === 0}
                    onPress={() => void runNow(task)}
                  >
                    {t('apiWorkbench.tasks.runNow')}
                  </Action>
                  <IconAction
                    label={t('apiWorkbench.tasks.delete')}
                    disabled={Boolean(pending)}
                    onPress={() => setDeleteTarget(task)}
                    size="sm"
                  >
                    <Trash2 className="size-4 text-danger" />
                  </IconAction>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-ink-muted">{t('apiWorkbench.workspace.savedVersion')}</p>
      <DestructiveConfirmDialog
        triggerLabel={t('apiWorkbench.tasks.delete')}
        title={t('apiWorkbench.common.deleteTitle')}
        description={t('apiWorkbench.common.deleteDescription', { name: deleteTarget?.name })}
        impact={t('apiWorkbench.common.deleteOneImpact')}
        cancelLabel={t('apiWorkbench.common.cancel')}
        confirmLabel={t('apiWorkbench.common.delete')}
        failureMessage={t('apiWorkbench.feedback.saveFailed')}
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={async () => {
          if (deleteTarget)
            await perform('delete', () =>
              onTasksChange(tasks.filter((task) => task.id !== deleteTarget.id)),
            );
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
