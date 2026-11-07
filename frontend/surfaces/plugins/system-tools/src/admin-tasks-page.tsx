'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { Page, PageHeader, SectionBody } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { DatePickerField } from '@clouddrive/ui-adapter/date-picker-field';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import {
  adminTaskKinds,
  adminTaskOrigins,
  type AdminTask,
  type AdminTaskCleanup,
  type AdminTaskFilters,
  type AdminTaskPreviewQuery,
  type AdminTaskQuery,
} from '../../../src/files/admin-tasks';
import { backgroundTaskStatuses } from '../../../src/files/background-tasks';
import { maxInventoryPage } from '../../../src/files/inventory';
import { useFiles } from '../../../src/files/runtime';
import { workerNodeIdPattern } from '../../../src/files/worker-nodes';
import type { Preferences } from '../../../src/preferences-model';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';

const filters: AdminTaskFilters = {
  ownerId: '',
  nodeId: '',
  kind: 'all',
  origin: 'all',
  status: 'all',
};
const initial: AdminTaskQuery = {
  ...filters,
  taskId: '',
  sort: 'created',
  direction: 'desc',
  page: 1,
};
const taskKey = ({ kind, id }: AdminTask) => `${kind}:${id}`;
type TaskRow = { id: string; task: AdminTask };
const zh = {
  description: '查看跨账号任务和系统维护记录，并清理已结束的任务记录。',
  filter: '过滤',
  apply: '应用',
  reset: '重置',
  owner: '创建者 ID',
  origin: '来源',
  origins: { all: '全部来源', user: '用户', system: '系统' },
  maintenance: { 'trash-expiry': '回收站到期扫描', 'blob-reclaim': '定时扫描回收文件 Blob' },
  taskId: '任务 ID',
  name: '内容',
  kind: '类型',
  state: '状态',
  node: '处理节点',
  nodeId: '节点 ID',
  invalidNodeId: '节点 ID 只能包含小写字母、数字、连字符和下划线。',
  clearNode: '清除节点筛选',
  created: '创建于',
  updated: '更新于',
  started: '开始时间',
  finished: '结束时间',
  duration: '运行耗时（毫秒）',
  empty: '没有符合条件的任务',
  detail: '任务详情',
  detailHint: '查看任务状态和可披露的诊断。',
  failure: '故障代码',
  select: '选择任务',
  selectPage: '选择本页可清理任务',
  cleanup: '清理任务',
  selected: '清理选中任务',
  cleanupHint: '清理已结束的任务及临时资源，保留已发布文件。',
  before: '截止日期（UTC）',
  clock: '截止时间（UTC）',
  calendar: '选择截止日期',
  preview: '预览清理范围',
  batch: (shown: number, total: number) => `本次可清理 ${shown} 条，共匹配 ${total} 条。`,
  result: (removed: number, failed: number) => `已清理 ${removed} 条，未清理 ${failed} 条。`,
  pagination: (page: number, pages: number, total: number) =>
    `第 ${page} / ${pages} 页，共 ${total} 项`,
};
const en: typeof zh = {
  description: 'Review user tasks and system maintenance, and clean up finished task records.',
  filter: 'Filter',
  apply: 'Apply',
  reset: 'Reset',
  owner: 'Creator ID',
  origin: 'Source',
  origins: { all: 'All sources', user: 'User', system: 'System' },
  maintenance: {
    'trash-expiry': 'Trash expiry scan',
    'blob-reclaim': 'Scheduled Blob reclamation',
  },
  taskId: 'Task ID',
  name: 'Content',
  kind: 'Type',
  state: 'State',
  node: 'Worker node',
  nodeId: 'Node ID',
  invalidNodeId: 'Use lowercase letters, digits, hyphens and underscores in the node ID.',
  clearNode: 'Clear node filter',
  created: 'Created',
  updated: 'Updated',
  started: 'Started',
  finished: 'Finished',
  duration: 'Duration (ms)',
  empty: 'No tasks match the filters',
  detail: 'Task details',
  detailHint: 'Review task state and available diagnostics.',
  failure: 'Failure code',
  select: 'Select task',
  selectPage: 'Select cleanable tasks on this page',
  cleanup: 'Clean up tasks',
  selected: 'Clean up selected tasks',
  cleanupHint: 'Remove finished task records and temporary resources. Published files are kept.',
  before: 'Cutoff date (UTC)',
  clock: 'Cutoff time (UTC)',
  calendar: 'Choose cutoff date',
  preview: 'Preview cleanup',
  batch: (shown, total) => `${shown} tasks in this batch, ${total} match.`,
  result: (removed, failed) => `${removed} tasks removed, ${failed} not removed.`,
  pagination: (page, pages, total) => `Page ${page} of ${pages}, ${total} items`,
};

function isMaintenanceKind(kind: AdminTaskFilters['kind']): kind is keyof typeof zh.maintenance {
  return kind === 'trash-expiry' || kind === 'blob-reclaim';
}

function taskName(task: AdminTask, labels: typeof zh) {
  return isMaintenanceKind(task.kind) ? labels.maintenance[task.kind] : task.name;
}

function validNodeFilter(id: string) {
  return id === '' || workerNodeIdPattern.test(id);
}

function FilterFields({
  value,
  change,
  labels,
  terminal = false,
}: {
  value: AdminTaskFilters;
  change: (value: AdminTaskFilters) => void;
  labels: typeof zh;
  terminal?: boolean;
}) {
  const { t } = useFrontendTranslation();
  return (
    <>
      <TextField
        label={labels.owner}
        value={value.ownerId}
        maxLength={128}
        onChange={(event) => change({ ...value, ownerId: event.target.value })}
      />
      <TextField
        label={labels.nodeId}
        value={value.nodeId}
        maxLength={64}
        {...(validNodeFilter(value.nodeId) ? {} : { error: labels.invalidNodeId })}
        onChange={(event) => change({ ...value, nodeId: event.target.value })}
      />
      <SelectField
        label={labels.origin}
        value={value.origin}
        options={adminTaskOrigins.map((origin) => ({
          value: origin,
          label: labels.origins[origin],
        }))}
        onValueChange={(origin) =>
          change({ ...value, origin: adminTaskOrigins.find((item) => item === origin) ?? 'all' })
        }
      />
      <SelectField
        label={labels.kind}
        value={value.kind}
        options={adminTaskKinds.map((kind) => ({
          value: kind,
          label: isMaintenanceKind(kind)
            ? labels.maintenance[kind]
            : t('files.archives.tasks.kind.' + kind),
        }))}
        onValueChange={(kind) =>
          change({ ...value, kind: adminTaskKinds.find((item) => item === kind) ?? 'all' })
        }
      />
      <SelectField
        label={labels.state}
        value={value.status}
        options={backgroundTaskStatuses
          .filter((status) => !terminal || status !== 'active')
          .map((status) => ({ value: status, label: t('files.archives.tasks.status.' + status) }))}
        onValueChange={(status) =>
          change({
            ...value,
            status: backgroundTaskStatuses.find((item) => item === status) ?? 'all',
          })
        }
      />
    </>
  );
}

function useTaskStateLabel() {
  const { t } = useFrontendTranslation();
  return (item: AdminTask) => {
    if (isMaintenanceKind(item.kind)) return t('files.archives.tasks.status.' + item.state);
    const prefix =
      item.kind === 'zip' || item.kind === 'extract'
        ? 'files.archives.tasks.state.'
        : 'files.downloads.state.';
    return t(prefix + item.state);
  };
}

function TaskDetail({
  task,
  labels,
  time,
  close,
}: {
  task: AdminTask;
  labels: typeof zh;
  time: (value: string) => string;
  close: () => void;
}) {
  const { t } = useFrontendTranslation();
  const files = useFiles();
  const labelState = useTaskStateLabel();
  const state = useCatalogRequest(
    useCallback(
      (signal) => files.readAdminTask(task.kind, task.id, signal),
      [files, task.kind, task.id],
    ),
  );
  const item = state.result && 'value' in state.result ? state.result.value : undefined;
  const maintenance = item && isMaintenanceKind(item.kind);
  return (
    <DialogSurface
      isOpen
      triggerLabel={labels.detail}
      title={labels.detail}
      description={labels.detailHint}
      cancelLabel={t('files.close')}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
      {state.result && 'error' in state.result ? (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      ) : null}
      {item ? (
        <dl className="space-y-2 text-sm">
          {[
            [labels.taskId, item.id],
            [labels.name, taskName(item, labels)],
            [labels.owner, item.ownerId || labels.origins.system],
            [labels.state, labelState(item)],
            [labels.node, item.nodeId || '—'],
            [maintenance ? labels.started : labels.created, time(item.createdAt)],
            [maintenance ? labels.finished : labels.updated, time(item.updatedAt)],
            ...(item.durationMs === null ? [] : [[labels.duration, item.durationMs]]),
            [labels.failure, item.failureCode || '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="font-medium">{label}</dt>
              <dd className="break-all text-ink-muted">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </DialogSurface>
  );
}

function CleanupDialog({
  rows,
  preview,
  labels,
  close,
  clean,
}: {
  rows: readonly AdminTask[];
  preview?: AdminTaskPreviewQuery;
  labels: typeof zh;
  close: () => void;
  clean: (rows: readonly AdminTask[]) => Promise<void>;
}) {
  const { t } = useFrontendTranslation();
  const files = useFiles();
  const state = useCatalogRequest(
    useCallback(
      (signal) =>
        preview ? files.previewAdminTaskCleanup(preview, signal) : Promise.resolve(undefined),
      [files, preview],
    ),
  );
  const page = state.result && 'value' in state.result ? state.result.value : undefined;
  const targets = preview ? (page?.items ?? []) : rows;
  return (
    <DialogSurface
      isOpen
      triggerLabel={labels.cleanup}
      title={labels.cleanup}
      description={labels.cleanupHint}
      cancelLabel={t('files.cancel')}
      confirmLabel={labels.cleanup}
      confirmDisabled={targets.length === 0}
      onConfirm={() => clean(targets)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {preview && !state.result ? <p role="status">{t('administration.loading')}</p> : null}
      {state.result && 'error' in state.result ? (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      ) : null}
      <p>{labels.batch(targets.length, page?.total ?? targets.length)}</p>
      <ul className="space-y-2 text-sm">
        {targets.map((row) => (
          <li className="break-all" key={taskKey(row)}>
            {taskName(row, labels)} · {row.id}
          </li>
        ))}
      </ul>
    </DialogSurface>
  );
}

export function AdminTasksPage({ nodeId = '' }: { nodeId?: string }) {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labelState = useTaskStateLabel();
  const labels = locale.startsWith('zh') ? zh : en;
  const title = t('systemTools.nav.tasks');
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  const time = (value: string) => formatInstant(locale, region, value);
  const [query, setQuery] = useState({ ...initial, nodeId });
  const [draft, setDraft] = useState<AdminTaskQuery>();
  const [criteria, setCriteria] = useState<AdminTaskFilters & { day: string; clock: string }>();
  const [cleanup, setCleanup] = useState<{
    rows: readonly AdminTask[];
    preview?: AdminTaskPreviewQuery;
  }>();
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [detail, setDetail] = useState<AdminTask>();
  const [notice, setNotice] = useState<AdminTaskCleanup>();
  const state = useCatalogRequest(
    useCallback((signal) => files.listAdminTasks(query, signal), [files, query]),
  );
  const page = state.result && 'value' in state.result ? state.result.value : undefined;
  const pages = page
    ? Math.max(1, Math.min(maxInventoryPage, Math.ceil(page.total / page.pageSize)))
    : 1;
  const eligible = page?.canCleanup ? page.items.filter((row) => row.cleanable) : [];
  const selected = eligible.filter((row) => selection.includes(taskKey(row)));
  const refresh = () => {
    setSelection([]);
    state.refresh();
  };
  const apply = (next: AdminTaskQuery) => {
    setSelection([]);
    setNotice(undefined);
    setQuery(next);
  };
  const clean = async (rows: readonly AdminTask[]) => {
    const result = await files.cleanAdminTasks(
      rows.map(({ id, kind, revision, updatedAt }) => ({ id, kind, revision, updatedAt })),
    );
    setNotice(result);
    refresh();
  };
  const failed = notice?.items.filter((item) => item.status !== 200) ?? [];
  return (
    <Page>
      <PageHeader
        title={title}
        description={labels.description}
        actions={
          <>
            <Action variant="secondary" onPress={refresh}>
              {t('files.refresh')}
            </Action>
            <Action variant="secondary" onPress={() => setDraft(query)}>
              {labels.filter}
            </Action>
            {page?.canCleanup ? (
              <Action
                variant="secondary"
                onPress={() =>
                  setCriteria({ ...filters, nodeId: query.nodeId, day: '', clock: '00:00' })
                }
              >
                {labels.cleanup}
              </Action>
            ) : null}
            {selected.length > 0 ? (
              <Action variant="danger" onPress={() => setCleanup({ rows: selected })}>
                {labels.selected} ({selected.length})
              </Action>
            ) : null}
          </>
        }
      />
      <Panel className="surface-route-region overflow-hidden">
        <SectionBody>
          {query.nodeId ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-all text-sm">
                {labels.nodeId} · {query.nodeId}
              </p>
              <Action
                variant="quiet"
                size="sm"
                onPress={() => apply({ ...query, nodeId: '', page: 1 })}
              >
                {labels.clearNode}
              </Action>
            </div>
          ) : null}
          {notice ? (
            <div role="status">
              <p>{labels.result(notice.items.length - failed.length, failed.length)}</p>
              {failed.length ? (
                <ul>
                  {failed.map((item) => (
                    <li className="break-all" key={`${item.kind}:${item.id}`}>
                      {item.id} · {item.code ?? item.status}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
          {state.result && 'error' in state.result ? (
            <CatalogFailure error={state.result.error} retry={refresh} />
          ) : null}
          {page ? (
            <>
              {eligible.length ? (
                <CheckboxField
                  label={labels.selectPage}
                  checked={selected.length === eligible.length}
                  onCheckedChange={(checked) => setSelection(checked ? eligible.map(taskKey) : [])}
                />
              ) : null}
              <DataTable<TaskRow>
                label={title}
                density="compact"
                rows={page.items.map((item) => ({ id: taskKey(item), task: item }))}
                emptyContent={labels.empty}
                sort={{
                  columnId: query.sort,
                  direction: query.direction === 'asc' ? 'ascending' : 'descending',
                  onSortChange: (sort, direction) => {
                    if (sort === 'id' || sort === 'created')
                      apply({
                        ...query,
                        sort,
                        direction: direction === 'ascending' ? 'asc' : 'desc',
                        page: 1,
                      });
                  },
                }}
                columns={[
                  ...(eligible.length
                    ? [
                        {
                          id: 'select',
                          label: labels.select,
                          render: (row: TaskRow) =>
                            row.task.cleanable ? (
                              <CheckboxField
                                label={`${labels.select} ${row.task.id}`}
                                presentation="control-only"
                                checked={selection.includes(row.id)}
                                onCheckedChange={(checked) =>
                                  setSelection((current) =>
                                    checked
                                      ? [...current, row.id]
                                      : current.filter((id) => id !== row.id),
                                  )
                                }
                              />
                            ) : null,
                        },
                      ]
                    : []),
                  {
                    id: 'id',
                    label: 'ID',
                    sortable: true,
                    render: ({ task }) => <span title={task.id}>{task.id.slice(0, 8)}</span>,
                  },
                  {
                    id: 'name',
                    label: labels.name,
                    rowHeader: true,
                    render: ({ task }) => (
                      <div className="flex flex-wrap gap-2">
                        <Action size="sm" variant="quiet" onPress={() => setDetail(task)}>
                          {taskName(task, labels)}
                        </Action>
                        {page.canCleanup && task.cleanable ? (
                          <Action
                            size="sm"
                            variant="quiet"
                            onPress={() => setCleanup({ rows: [task] })}
                          >
                            {labels.cleanup}
                          </Action>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    id: 'kind',
                    label: labels.kind,
                    render: ({ task }) =>
                      isMaintenanceKind(task.kind)
                        ? labels.maintenance[task.kind]
                        : t('files.archives.tasks.kind.' + task.kind),
                  },
                  { id: 'state', label: labels.state, render: ({ task }) => labelState(task) },
                  {
                    id: 'owner',
                    label: labels.owner,
                    render: ({ task }) => (
                      <span title={task.ownerId}>
                        {task.ownerId.slice(0, 8) || labels.origins.system}
                      </span>
                    ),
                  },
                  { id: 'node', label: labels.node, render: ({ task }) => task.nodeId || '—' },
                  {
                    id: 'created',
                    label: labels.created,
                    sortable: true,
                    render: ({ task }) => time(task.createdAt),
                  },
                ]}
              />
              <div className="flex flex-wrap items-center gap-2 py-2">
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={query.page <= 1}
                  onPress={() => apply({ ...query, page: query.page - 1 })}
                >
                  {t('administration.previous')}
                </Action>
                <p role="status">{labels.pagination(page.page, pages, page.total)}</p>
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={query.page >= pages}
                  onPress={() => apply({ ...query, page: query.page + 1 })}
                >
                  {t('administration.next')}
                </Action>
              </div>
            </>
          ) : null}
        </SectionBody>
      </Panel>
      {draft ? (
        <DialogSurface
          isOpen
          triggerLabel={labels.filter}
          title={labels.filter}
          description={labels.description}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.apply}
          confirmDisabled={!validNodeFilter(draft.nodeId)}
          onConfirm={() => apply({ ...draft, page: 1 })}
          onOpenChange={(open) => {
            if (!open) setDraft(undefined);
          }}
        >
          <div className="min-w-0 space-y-4">
            <TextField
              label={labels.taskId}
              value={draft.taskId}
              maxLength={36}
              onChange={(event) => setDraft({ ...draft, taskId: event.target.value })}
            />
            <FilterFields
              value={draft}
              change={(value) => setDraft({ ...draft, ...value })}
              labels={labels}
            />
            <Action
              variant="secondary"
              onPress={() => {
                apply(initial);
                setDraft(undefined);
              }}
            >
              {labels.reset}
            </Action>
          </div>
        </DialogSurface>
      ) : null}
      {criteria ? (
        <DialogSurface
          isOpen
          triggerLabel={labels.cleanup}
          title={labels.cleanup}
          description={labels.cleanupHint}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.preview}
          confirmDisabled={
            !validNodeFilter(criteria.nodeId) ||
            !criteria.day ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(criteria.clock)
          }
          onConfirm={() => {
            const { day, clock, ...filter } = criteria;
            setCriteria(undefined);
            setCleanup({ rows: [], preview: { ...filter, before: `${day}T${clock}:00Z` } });
          }}
          onOpenChange={(open) => {
            if (!open) setCriteria(undefined);
          }}
        >
          <div className="min-w-0 space-y-4">
            <DatePickerField
              label={labels.before}
              calendarLabel={labels.calendar}
              value={criteria.day || null}
              onValueChange={(day) => setCriteria({ ...criteria, day: day ?? '' })}
            />
            <TextField
              label={labels.clock}
              value={criteria.clock}
              maxLength={5}
              onChange={(event) => setCriteria({ ...criteria, clock: event.target.value })}
            />
            <FilterFields
              value={criteria}
              change={(value) => setCriteria({ ...criteria, ...value })}
              labels={labels}
              terminal
            />
          </div>
        </DialogSurface>
      ) : null}
      {detail ? (
        <TaskDetail task={detail} labels={labels} time={time} close={() => setDetail(undefined)} />
      ) : null}
      {cleanup ? (
        <CleanupDialog
          {...cleanup}
          labels={labels}
          clean={clean}
          close={() => setCleanup(undefined)}
        />
      ) : null}
    </Page>
  );
}
