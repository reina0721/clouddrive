'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { FrontendMessages, formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { DatePickerField } from '@clouddrive/ui-adapter/date-picker-field';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import {
  adminTaskKinds,
  adminTaskOrigins,
  type AdminTask,
  type AdminTaskCleanup,
  type AdminTaskFilters,
  type AdminTaskPreviewQuery,
  type AdminTaskQuery,
  type AdminTaskSummary,
} from '../../../src/files/admin-tasks';
import { backgroundTaskStatuses } from '../../../src/files/background-tasks';
import { maxInventoryPage } from '../../../src/files/inventory';
import { useFiles } from '../../../src/files/runtime';
import { workerNodeIdPattern } from '../../../src/files/worker-nodes';
import { NavigationIcon } from '../../../src/navigation-icon-presentation';
import type { Preferences } from '../../../src/preferences-model';
import { adminTaskMessages } from './admin-task-messages';
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
const sortOptions = ['newest', 'oldest', 'idAsc', 'idDesc'] as const;
type SortOption = (typeof sortOptions)[number];

function isMaintenanceKind(
  kind: AdminTaskFilters['kind'],
): kind is 'trash-expiry' | 'blob-reclaim' {
  return kind === 'trash-expiry' || kind === 'blob-reclaim';
}

function validNodeFilter(id: string) {
  return id === '' || workerNodeIdPattern.test(id);
}

function sortOption(query: Pick<AdminTaskQuery, 'sort' | 'direction'>): SortOption {
  if (query.sort === 'id') return query.direction === 'asc' ? 'idAsc' : 'idDesc';
  return query.direction === 'asc' ? 'oldest' : 'newest';
}

function applySort(query: AdminTaskQuery, value: string): AdminTaskQuery {
  switch (value) {
    case 'oldest':
      return { ...query, sort: 'created', direction: 'asc' };
    case 'idAsc':
      return { ...query, sort: 'id', direction: 'asc' };
    case 'idDesc':
      return { ...query, sort: 'id', direction: 'desc' };
    default:
      return { ...query, sort: 'created', direction: 'desc' };
  }
}

function useTaskText() {
  const { t, locale } = useFrontendTranslation();
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  return {
    t,
    locale,
    label: (key: string, values?: Readonly<Record<string, unknown>>) =>
      values ? t('adminTasks.' + key, values) : t('adminTasks.' + key),
    time: (value: string) => formatInstant(locale, region, value),
    number: (value: number) => formatNumber(locale, value),
  };
}

function taskName(task: AdminTask, label: ReturnType<typeof useTaskText>['label']) {
  return isMaintenanceKind(task.kind) ? label('maintenance.' + task.kind) : task.name;
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

function stateTone(state: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (state === 'completed') return 'success';
  if (state === 'failed') return 'danger';
  if (state === 'canceled' || state === 'expired') return 'neutral';
  return 'warning';
}

function FilterFields({
  value,
  change,
  terminal = false,
}: {
  value: AdminTaskFilters;
  change: (value: AdminTaskFilters) => void;
  terminal?: boolean;
}) {
  const { t, label } = useTaskText();
  return (
    <>
      <TextField
        label={label('owner')}
        value={value.ownerId}
        maxLength={128}
        onChange={(event) => change({ ...value, ownerId: event.target.value })}
      />
      <TextField
        label={label('nodeId')}
        value={value.nodeId}
        maxLength={64}
        {...(validNodeFilter(value.nodeId) ? {} : { error: label('invalidNodeId') })}
        onChange={(event) => change({ ...value, nodeId: event.target.value })}
      />
      <SelectField
        label={label('origin')}
        value={value.origin}
        options={adminTaskOrigins.map((origin) => ({
          value: origin,
          label: label('origins.' + origin),
        }))}
        onValueChange={(origin) =>
          change({
            ...value,
            origin: adminTaskOrigins.find((item) => item === origin) ?? 'all',
          })
        }
      />
      <SelectField
        label={label('kind')}
        value={value.kind}
        options={adminTaskKinds.map((kind) => ({
          value: kind,
          label: isMaintenanceKind(kind)
            ? label('maintenance.' + kind)
            : t('files.archives.tasks.kind.' + kind),
        }))}
        onValueChange={(kind) =>
          change({
            ...value,
            kind: adminTaskKinds.find((item) => item === kind) ?? 'all',
          })
        }
      />
      <SelectField
        label={label('state')}
        value={value.status}
        options={backgroundTaskStatuses
          .filter((status) => !terminal || status !== 'active')
          .map((status) => ({
            value: status,
            label: t('files.archives.tasks.status.' + status),
          }))}
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

function TaskDetail({ task, close }: { task: AdminTask; close: () => void }) {
  const { t, label, time } = useTaskText();
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
      triggerLabel={label('detail')}
      title={label('detail')}
      description={label('detailHint')}
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
        <DescriptionList
          label={label('detail')}
          columns={2}
          items={[
            {
              id: 'state',
              term: label('state'),
              description: <StatusPill tone={stateTone(item.state)}>{labelState(item)}</StatusPill>,
            },
            { id: 'name', term: label('name'), description: taskName(item, label) },
            {
              id: 'id',
              term: label('taskId'),
              description: <span className="break-all">{item.id}</span>,
            },
            {
              id: 'owner',
              term: label('owner'),
              description: (
                <span className="break-all">{item.ownerId || label('systemOwner')}</span>
              ),
            },
            { id: 'node', term: label('node'), description: item.nodeId || label('noNode') },
            {
              id: 'created',
              term: maintenance ? label('started') : label('created'),
              description: time(item.createdAt),
            },
            {
              id: 'updated',
              term: maintenance ? label('finishedAt') : label('updated'),
              description: time(item.updatedAt),
            },
            ...(item.durationMs === null
              ? []
              : [{ id: 'duration', term: label('duration'), description: item.durationMs }]),
            { id: 'failure', term: label('failure'), description: item.failureCode || '—' },
          ]}
        />
      ) : null}
    </DialogSurface>
  );
}

function CleanupDialog({
  rows,
  preview,
  close,
  clean,
}: {
  rows: readonly AdminTask[];
  preview?: AdminTaskPreviewQuery;
  close: () => void;
  clean: (rows: readonly AdminTask[]) => Promise<void>;
}) {
  const { t, label } = useTaskText();
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
      triggerLabel={label('cleanup')}
      title={label('cleanup')}
      description={label('cleanupHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={label('cleanup')}
      confirmDisabled={targets.length === 0}
      failureMessage={label('cleanupFailure')}
      onConfirm={() => clean(targets)}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {preview && !state.result ? <p role="status">{t('administration.loading')}</p> : null}
      {state.result && 'error' in state.result ? (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      ) : null}
      <p>{label('batch', { shown: targets.length, total: page?.total ?? targets.length })}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {targets.map((row) => (
          <li className="break-all" key={taskKey(row)}>
            {taskName(row, label)} · {row.id}
          </li>
        ))}
      </ul>
    </DialogSurface>
  );
}

function TaskSummaryView({
  value,
  show,
}: {
  value: AdminTaskSummary;
  show: (status: AdminTaskQuery['status']) => void;
}) {
  const { label, number, time } = useTaskText();
  const finished = value.completed + value.failed + value.canceled + value.expired;
  return (
    <div className="space-y-4">
      <DescriptionList
        label={label('snapshot')}
        columns={2}
        items={[
          { id: 'total', term: label('total'), description: number(value.total) },
          {
            id: 'active',
            term: label('active'),
            description: (
              <StatusPill tone={value.active ? 'warning' : 'neutral'}>
                {number(value.active)}
              </StatusPill>
            ),
          },
          {
            id: 'failed',
            term: label('failed'),
            description: (
              <StatusPill tone={value.failed ? 'danger' : 'neutral'}>
                {number(value.failed)}
              </StatusPill>
            ),
          },
          { id: 'finished', term: label('finished'), description: number(finished) },
          { id: 'cleanable', term: label('cleanable'), description: number(value.cleanable) },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-xs text-ink-muted">
          {label('asOf', { time: time(value.asOf) })}
        </p>
        {value.active ? (
          <Action size="sm" variant="quiet" onPress={() => show('active')}>
            {label('showActive')}
          </Action>
        ) : null}
        {value.failed ? (
          <Action size="sm" variant="quiet" onPress={() => show('failed')}>
            {label('showFailed')}
          </Action>
        ) : null}
      </div>
    </div>
  );
}

function AdminTasksContent({ nodeId = '' }: { nodeId?: string }) {
  const files = useFiles();
  const { t, label, time } = useTaskText();
  const labelState = useTaskStateLabel();
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
  const summaryQuery = useMemo(
    () => ({
      ownerId: query.ownerId,
      nodeId: query.nodeId,
      kind: query.kind,
      origin: query.origin,
      taskId: query.taskId,
    }),
    [query.ownerId, query.nodeId, query.kind, query.origin, query.taskId],
  );
  const summary = useCatalogRequest(
    useCallback(
      (signal) => files.readAdminTaskSummary(summaryQuery, signal),
      [files, summaryQuery],
    ),
  );
  const page = state.result && 'value' in state.result ? state.result.value : undefined;
  const summaryValue =
    summary.result && 'value' in summary.result ? summary.result.value : undefined;
  const pages = page
    ? Math.max(1, Math.min(maxInventoryPage, Math.ceil(page.total / page.pageSize)))
    : 1;
  const eligible = page?.canCleanup ? page.items.filter((row) => row.cleanable) : [];
  const selected = eligible.filter((row) => selection.includes(taskKey(row)));
  const apply = (next: AdminTaskQuery) => {
    setSelection([]);
    setNotice(undefined);
    setQuery(next);
  };
  const refresh = () => {
    setSelection([]);
    state.refresh();
    summary.refresh();
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
        title={label('title')}
        description={label('description')}
        actions={
          <>
            <Action variant="secondary" onPress={refresh}>
              {t('files.refresh')}
            </Action>
            <Action variant="secondary" onPress={() => setDraft(query)}>
              {label('filter')}
            </Action>
            {page?.canCleanup ? (
              <Action
                variant="secondary"
                onPress={() =>
                  setCriteria({ ...filters, nodeId: query.nodeId, day: '', clock: '00:00' })
                }
              >
                {label('cleanup')}
              </Action>
            ) : null}
          </>
        }
      />
      <Section title={label('snapshot')} description={label('snapshotHint')} contentInset>
        {!summary.result ? <p role="status">{t('administration.loading')}</p> : null}
        {summary.result && 'error' in summary.result ? (
          <CatalogFailure error={summary.result.error} retry={summary.refresh} />
        ) : null}
        {summaryValue ? (
          <TaskSummaryView
            value={summaryValue}
            show={(status) => apply({ ...query, status, page: 1 })}
          />
        ) : null}
      </Section>
      <Section title={label('title')} description={label('listHint')} contentInset>
        <div className="space-y-4">
          {query.nodeId ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-all text-sm">
                {label('nodeId')} · {query.nodeId}
              </p>
              <Action
                variant="quiet"
                size="sm"
                onPress={() => apply({ ...query, nodeId: '', page: 1 })}
              >
                {label('clearNode')}
              </Action>
            </div>
          ) : null}
          {notice ? (
            <div role="status">
              <p>
                {label('result', {
                  removed: notice.items.length - failed.length,
                  failed: failed.length,
                })}
              </p>
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
            <CatalogFailure error={state.result.error} retry={state.refresh} />
          ) : null}
          {page ? (
            <>
              {eligible.length ? (
                <div className="flex flex-wrap items-center gap-3">
                  <CheckboxField
                    label={label('selectPage')}
                    checked={selected.length === eligible.length}
                    onCheckedChange={(checked) =>
                      setSelection(checked ? eligible.map(taskKey) : [])
                    }
                  />
                  {selected.length ? (
                    <>
                      <span className="text-sm text-ink-muted">
                        {label('selectedCount', { count: selected.length })}
                      </span>
                      <Action
                        size="sm"
                        variant="danger"
                        onPress={() => setCleanup({ rows: selected })}
                      >
                        {label('cleanupSelected')}
                      </Action>
                    </>
                  ) : null}
                </div>
              ) : null}
              {page.items.length ? (
                <ul
                  aria-label={label('title')}
                  className="divide-y divide-border rounded-panel border border-border"
                >
                  {page.items.map((task) => (
                    <li key={taskKey(task)} className="flex min-w-0 gap-3 px-4 py-4">
                      <div className="pt-1">
                        {page.canCleanup && task.cleanable ? (
                          <CheckboxField
                            label={`${label('select')} ${task.id}`}
                            presentation="control-only"
                            checked={selection.includes(taskKey(task))}
                            onCheckedChange={(checked) =>
                              setSelection((current) =>
                                checked
                                  ? [...current, taskKey(task)]
                                  : current.filter((id) => id !== taskKey(task)),
                              )
                            }
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Action size="sm" variant="quiet" onPress={() => setDetail(task)}>
                            <span className="block max-w-40 truncate sm:max-w-80 lg:max-w-none">
                              {taskName(task, label)}
                            </span>
                          </Action>
                          <StatusPill tone={stateTone(task.state)}>{labelState(task)}</StatusPill>
                        </div>
                        <dl className="grid min-w-0 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div className="min-w-0">
                            <dt className="text-xs text-ink-muted">{label('kind')}</dt>
                            <dd>
                              {isMaintenanceKind(task.kind)
                                ? label('maintenance.' + task.kind)
                                : t('files.archives.tasks.kind.' + task.kind)}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-ink-muted">{label('created')}</dt>
                            <dd>{time(task.createdAt)}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-ink-muted">{label('owner')}</dt>
                            <dd className="truncate" title={task.ownerId}>
                              {task.ownerId ? task.ownerId.slice(0, 12) : label('systemOwner')}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-xs text-ink-muted">{label('taskIdShort')}</dt>
                            <dd className="font-mono" title={task.id}>
                              {task.id.slice(0, 8)}
                            </dd>
                          </div>
                          {task.nodeId ? (
                            <div className="min-w-0">
                              <dt className="text-xs text-ink-muted">{label('node')}</dt>
                              <dd className="truncate" title={task.nodeId}>
                                {task.nodeId}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <StateSurface
                  compact
                  state="empty"
                  icon={<NavigationIcon iconId="list" />}
                  title={label('empty')}
                  description={label('listHint')}
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={query.page <= 1}
                  onPress={() => apply({ ...query, page: query.page - 1 })}
                >
                  {t('administration.previous')}
                </Action>
                <p className="mr-auto text-sm" role="status">
                  {label('pagination', { page: page.page, pages, total: page.total })}
                </p>
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
        </div>
      </Section>
      {draft ? (
        <DialogSurface
          isOpen
          triggerLabel={label('filter')}
          title={label('filter')}
          description={label('description')}
          cancelLabel={t('files.cancel')}
          confirmLabel={label('apply')}
          confirmDisabled={!validNodeFilter(draft.nodeId)}
          onConfirm={() => apply({ ...draft, page: 1 })}
          onOpenChange={(open) => {
            if (!open) setDraft(undefined);
          }}
        >
          <div className="min-w-0 space-y-4">
            <TextField
              label={label('taskId')}
              value={draft.taskId}
              maxLength={36}
              onChange={(event) => setDraft({ ...draft, taskId: event.target.value })}
            />
            <FilterFields value={draft} change={(value) => setDraft({ ...draft, ...value })} />
            <SelectField
              label={label('sort')}
              value={sortOption(draft)}
              options={sortOptions.map((value) => ({
                value,
                label: label('sorts.' + value),
              }))}
              onValueChange={(value) => setDraft(applySort(draft, value))}
            />
            <Action
              variant="secondary"
              onPress={() => {
                apply(initial);
                setDraft(undefined);
              }}
            >
              {label('reset')}
            </Action>
          </div>
        </DialogSurface>
      ) : null}
      {criteria ? (
        <DialogSurface
          isOpen
          triggerLabel={label('cleanup')}
          title={label('cleanup')}
          description={label('cleanupHint')}
          cancelLabel={t('files.cancel')}
          confirmLabel={label('preview')}
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
              label={label('before')}
              calendarLabel={label('calendar')}
              value={criteria.day || null}
              onValueChange={(day) => setCriteria({ ...criteria, day: day ?? '' })}
            />
            <TextField
              label={label('clock')}
              value={criteria.clock}
              maxLength={5}
              onChange={(event) => setCriteria({ ...criteria, clock: event.target.value })}
            />
            <FilterFields
              value={criteria}
              change={(value) => setCriteria({ ...criteria, ...value })}
              terminal
            />
          </div>
        </DialogSurface>
      ) : null}
      {detail ? <TaskDetail task={detail} close={() => setDetail(undefined)} /> : null}
      {cleanup ? (
        <CleanupDialog {...cleanup} clean={clean} close={() => setCleanup(undefined)} />
      ) : null}
    </Page>
  );
}

export function AdminTasksPage(props: { nodeId?: string }) {
  const { t } = useFrontendTranslation();
  return (
    <FrontendMessages
      resources={adminTaskMessages}
      fallback={<p role="status">{t('administration.loading')}</p>}
    >
      <AdminTasksContent {...props} />
    </FrontendMessages>
  );
}
