'use client';
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import {
  useFrontendTranslation,
  formatDate,
  formatTimeOfDay,
  formatNumber,
} from '@clouddrive/i18n';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import {
  Collection,
  CollectionPagination,
  CollectionQuery,
  type CollectionActiveFilter,
} from '@clouddrive/surface-foundation/collection';
import {
  CollectionToolbar,
  type ColumnSettingsText,
  type DensityLevel,
} from '@clouddrive/surface-foundation/collection-tools';
import { normalizeColumnLayout, toCsv, type CsvColumn } from '@clouddrive/core';
import type { DataColumn } from '@clouddrive/ui-adapter/data-display';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { BusyIndicator } from '@clouddrive/ui-adapter/busy-indicator';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { PaginationControl } from '@clouddrive/ui-adapter/navigation';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { route, RouteLink, usePluginNavigation } from '@clouddrive/plugin-framework/plugin';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { rehydrateStore } from '@clouddrive/state-foundation';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { RefreshCw } from '../../../src/action-icons';
import {
  IdentityError,
  auditOperations,
  defaultAuditQuery,
  useIdentityPort,
  type AuditQuery,
  type AuditRecord,
} from '@clouddrive/surface/identity/runtime';
import { useIdentityQuery } from '../../../src/identity/use-query';
import {
  IdentityModeNotice,
  IdentityQueryState,
  IdentityMutationError,
  IdentityEmptyState,
} from '../../../src/identity/query-state';
import { useAuditColumnLayoutStore } from '../stores/column-layout';
import { browserCsvExport } from './csv-export';
const DatePickerField = lazy(() =>
  import('@clouddrive/ui-adapter/date-picker-field').then((module) => ({
    default: module.DatePickerField,
  })),
);
const AuditTable = lazy(() =>
  import('./audit-table').then((module) => ({
    default: module.AuditTable,
  })),
);
export function AuditPage({ query }: Readonly<{ query: AuditQuery | null }>) {
  const { t, locale } = useFrontendTranslation();
  const { notify } = useFeedback();
  const port = useIdentityPort();
  const navigation = usePluginNavigation();
  const preferencesPort = usePreferencesPort<Preferences>();
  const region = preferencesPort.getSnapshot().localeRegion;
  // 表格密度走正式 Preferences Port（与 users 同一偏好，写入即持久化）。
  const tableDensity = useSyncExternalStore(
    (onChange) => preferencesPort.subscribe(onChange),
    () => preferencesPort.getSnapshot().dataDisplay.tableDensity,
    () => preferencesPort.getSnapshot().dataDisplay.tableDensity,
  );
  const rememberColumnLayout = useSyncExternalStore(
    (onChange) => preferencesPort.subscribe(onChange),
    () => preferencesPort.getSnapshot().dataDisplay.rememberColumnLayout,
    () => preferencesPort.getSnapshot().dataDisplay.rememberColumnLayout,
  );
  const filters = query ?? defaultAuditQuery;
  const [search, setSearch] = useState(filters.q);
  const [actor, setActor] = useState(filters.actor ?? '');
  const [object, setObject] = useState(filters.object ?? '');
  const [from, setFrom] = useState(filters.from ?? '');
  const [to, setTo] = useState(filters.to ?? '');
  const [failure, setFailure] = useState<IdentityError | null>(null);
  // 高级筛选（actor/object/日期）默认折叠：与既有行为一致，深链筛选也先展示 chips 再展开。
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const result = useIdentityQuery(`audit:${JSON.stringify(query)}`, async (service) => {
    if (!query) throw new IdentityError('validation');
    const access = await service.access();
    if (!access.permissions.includes('audit.read')) throw new IdentityError('forbidden');
    return service.audit(query);
  });
  const location = (value: AuditQuery) => ({
    q: value.q,
    operation: value.operation,
    result: value.result,
    actor: value.actor ?? '',
    object: value.object ?? '',
    from: value.from ?? '',
    to: value.to ?? '',
    page: String(value.page),
    pageSize: String(value.pageSize),
  });
  function apply(patch: Partial<AuditQuery>) {
    setFailure(null);
    void import('../../../src/identity/model')
      .then(({ auditQuerySchema }) => {
        const parsed = auditQuerySchema.safeParse({ ...filters, ...patch });
        if (!parsed.success) {
          setFailure(new IdentityError('validation'));
          return;
        }
        navigation.navigate(route('audit', {}, { query: location(parsed.data) }));
      })
      .catch(() => setFailure(new IdentityError('unavailable')));
  }
  const timestamp = (value: string) =>
    formatDate(locale, value, region.timeZone === 'auto' ? {} : { timeZone: region.timeZone }) +
    ' · ' +
    formatTimeOfDay(locale, region, value);
  const operation = (record: AuditRecord) => (
    <RouteLink
      target={route('audit.detail', {}, { query: { ...location(filters), id: record.id } })}
    >
      {t(`management.operations.${record.operation}`)}
    </RouteLink>
  );
  const status = (record: AuditRecord) => (
    <StatusPill tone={record.result === 'success' ? 'success' : 'danger'}>
      {t(`audit.${record.result}`)}
    </StatusPill>
  );
  const columns: readonly DataColumn<AuditRecord>[] = [
    { id: 'time', label: t('audit.time'), render: (record) => timestamp(record.createdAt) },
    { id: 'operation', label: t('audit.operation'), rowHeader: true, render: operation },
    { id: 'actor', label: t('audit.actor'), render: (record) => record.actorName },
    { id: 'object', label: t('audit.object'), render: (record) => record.objectName },
    { id: 'result', label: t('audit.result'), render: status },
  ];
  // 列设置（audit 插件私有 store，独立 ownership；受 dataDisplay.rememberColumnLayout 控制）。
  const [columnOverride, setColumnOverride] = useState<readonly string[] | null>(null);
  const savedColumnOrder = useAuditColumnLayoutStore((state) => state.visibleOrder);
  useEffect(() => {
    rehydrateStore(useAuditColumnLayoutStore);
  }, []);
  const mandatoryColumns = new Set(['operation']);
  const canonicalColumnIds = columns.map((column) => column.id);
  const visibleColumnIds =
    columnOverride ??
    normalizeColumnLayout(
      canonicalColumnIds,
      rememberColumnLayout ? (savedColumnOrder ?? undefined) : undefined,
      mandatoryColumns,
    );
  const visibleColumns = visibleColumnIds.flatMap((id) => {
    const column = columns.find((item) => item.id === id);
    return column ? [column] : [];
  });
  const persistColumnOrder = (order: readonly string[]) => {
    setColumnOverride(order);
    if (!rememberColumnLayout) return;
    useAuditColumnLayoutStore.getState().saveVisibleOrder(order);
  };
  const resetColumnOrder = () => {
    setColumnOverride(null);
    useAuditColumnLayoutStore.getState().resetVisibleOrder();
  };
  const columnSettingsText: ColumnSettingsText = {
    title: t('audit.columnSettingsTitle'),
    description: t('audit.columnSettingsDescription'),
    mandatory: t('audit.columnMandatory'),
    reset: t('audit.columnReset'),
    close: t('audit.columnClose'),
    moveUp: (columnLabel) => t('audit.columnMoveUp', { column: columnLabel }),
    moveDown: (columnLabel) => t('audit.columnMoveDown', { column: columnLabel }),
  };
  const changeDensity = (value: DensityLevel) => {
    const outcome = preferencesPort.updateCategory('dataDisplay', { tableDensity: value });
    if (!outcome.ok) notify({ title: t('audit.densityFailure'), tone: 'danger' });
  };
  const selectedRecords = result.data?.items.filter((record) => selected.includes(record.id)) ?? [];
  const csvColumns: readonly CsvColumn[] = [
    { id: 'time', label: t('audit.time') },
    { id: 'operation', label: t('audit.operation') },
    { id: 'actor', label: t('audit.actor') },
    { id: 'object', label: t('audit.object') },
    { id: 'result', label: t('audit.result') },
  ];
  const exportCsv = async (records: readonly AuditRecord[], fileName: string) => {
    try {
      const rows = records.map((record) => ({
        time: timestamp(record.createdAt),
        operation: t(`management.operations.${record.operation}`),
        actor: record.actorName,
        object: record.objectName,
        result: t(`audit.${record.result}`),
      }));
      await browserCsvExport.downloadCsv(fileName, toCsv(rows, csvColumns));
      notify({ title: t('audit.exportSuccess', { count: records.length }), tone: 'success' });
    } catch {
      notify({ title: t('audit.exportFailure'), tone: 'danger' });
    }
  };
  const resetFilters = () => {
    setSearch('');
    setActor('');
    setObject('');
    setFrom('');
    setTo('');
    setFiltersOpen(false);
    navigation.navigate(route('audit'));
  };
  const activeFilters: readonly CollectionActiveFilter[] = [
    ...(filters.q
      ? [
          {
            id: 'q',
            label: t('audit.withQuery', { value: filters.q }),
            onRemove: () => {
              setSearch('');
              apply({ q: '', page: 1 });
            },
          },
        ]
      : []),
    ...(filters.operation !== 'all'
      ? [
          {
            id: 'operation',
            label: `${t('audit.operation')}: ${t(`management.operations.${filters.operation}`)}`,
            onRemove: () => apply({ operation: 'all', page: 1 }),
          },
        ]
      : []),
    ...(filters.result !== 'all'
      ? [
          {
            id: 'result',
            label: `${t('audit.result')}: ${t(`audit.${filters.result}`)}`,
            onRemove: () => apply({ result: 'all', page: 1 }),
          },
        ]
      : []),
    ...(filters.actor
      ? [
          {
            id: 'actor',
            label: t('audit.withActor', { value: filters.actor }),
            onRemove: () => {
              setActor('');
              apply({ actor: '', page: 1 });
            },
          },
        ]
      : []),
    ...(filters.object
      ? [
          {
            id: 'object',
            label: t('audit.withObject', { value: filters.object }),
            onRemove: () => {
              setObject('');
              apply({ object: '', page: 1 });
            },
          },
        ]
      : []),
    ...(filters.from
      ? [
          {
            id: 'from',
            label: t('audit.fromFilter', { value: filters.from.slice(0, 10) }),
            onRemove: () => {
              setFrom('');
              apply({ from: '', page: 1 });
            },
          },
        ]
      : []),
    ...(filters.to
      ? [
          {
            id: 'to',
            label: t('audit.toFilter', { value: filters.to.slice(0, 10) }),
            onRemove: () => {
              setTo('');
              apply({ to: '', page: 1 });
            },
          },
        ]
      : []),
  ];
  const pages = Math.max(1, Math.ceil((result.data?.total ?? 0) / filters.pageSize));

  return (
    <Page>
      <PageHeader title={t('audit.nav')} description={t('audit.description')} />
      <IdentityModeNotice mode={port.mode} />
      <IdentityMutationError error={failure} />
      {result.error || !result.data ? (
        <IdentityQueryState error={result.error} retry={result.reload} />
      ) : (
        <Collection
          title={t('audit.records')}
          count={formatNumber(locale, result.data.total)}
          description={t('audit.readonly')}
          tools={
            <IconAction
              label={t('identityProduct.refresh')}
              tooltip
              loading={result.loading}
              onPress={result.reload}
            >
              <RefreshCw className="size-4" />
            </IconAction>
          }
          query={
            <CollectionQuery
              search={
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    apply({ q: search, page: 1 });
                  }}
                >
                  <SearchBox
                    label={t('audit.search')}
                    placeholder={t('audit.search')}
                    value={search}
                    onValueChange={(val) => {
                      setSearch(val);
                      if (!val && filters.q) {
                        apply({ q: '', page: 1 });
                      }
                    }}
                  />
                </form>
              }
              filters={
                <>
                  <SelectField
                    presentation="toolbar"
                    label={t('audit.operation')}
                    value={filters.operation}
                    options={[
                      { value: 'all', label: t('identityProduct.all') },
                      ...auditOperations.map((value) => ({
                        value,
                        label: t(`management.operations.${value}`),
                      })),
                    ]}
                    onValueChange={(value) => {
                      const operation = auditOperations.find((item) => item === value);
                      if (operation || value === 'all')
                        apply({ operation: operation ?? 'all', page: 1 });
                    }}
                  />
                  <SelectField
                    presentation="toolbar"
                    label={t('audit.result')}
                    value={filters.result}
                    options={['all', 'success', 'failure'].map((value) => ({
                      value,
                      label: t(value === 'all' ? 'identityProduct.all' : `audit.${value}`),
                    }))}
                    onValueChange={(value) => {
                      if (value === 'all' || value === 'success' || value === 'failure')
                        apply({ result: value, page: 1 });
                    }}
                  />
                </>
              }
              advanced={
                <form
                  className="grid gap-3 rounded-panel border border-border bg-surface p-4 text-sm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    apply({ q: search, actor, object, from, to, page: 1 });
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <TextField
                      label={t('audit.actor')}
                      value={actor}
                      onChange={(event) => setActor(event.target.value)}
                    />
                    <TextField
                      label={t('audit.object')}
                      value={object}
                      onChange={(event) => setObject(event.target.value)}
                    />
                    <Suspense fallback={<BusyIndicator label={t('identityProduct.loading')} />}>
                      <DatePickerField
                        label={t('audit.from')}
                        value={from ? from.slice(0, 10) : null}
                        calendarLabel={t('audit.calendar')}
                        hint={from ? timestamp(from) : t('audit.utcHint')}
                        onValueChange={(value) => setFrom(value ? value + 'T00:00:00.000Z' : '')}
                      />
                      <DatePickerField
                        label={t('audit.to')}
                        value={to ? to.slice(0, 10) : null}
                        calendarLabel={t('audit.calendar')}
                        hint={to ? timestamp(to) : t('audit.utcHint')}
                        onValueChange={(value) => setTo(value ? value + 'T23:59:59.999Z' : '')}
                      />
                    </Suspense>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <Action type="submit" size="sm">
                      {t('identityProduct.search')}
                    </Action>
                  </div>
                </form>
              }
              advancedLabel={t('audit.filters')}
              advancedOpenLabel={t('audit.advancedFiltersOpen')}
              advancedOpen={filtersOpen}
              activeFilters={activeFilters}
              activeFiltersLabel={t('audit.activeFilters')}
              onAdvancedOpenChange={setFiltersOpen}
              onResetFilters={resetFilters}
              resetFiltersLabel={t('audit.resetFilters')}
            />
          }
          toolbar={
            <CollectionToolbar
              label={t('audit.toolbar')}
              columnSettings={{
                triggerLabel: t('audit.columnSettings'),
                columns: columns.map((column) => ({
                  id: column.id,
                  label: column.label,
                  mandatory: column.id === 'operation',
                })),
                visibleOrder: visibleColumnIds,
                onChange: persistColumnOrder,
                onReset: resetColumnOrder,
                text: columnSettingsText,
              }}
              density={{
                label: t('audit.density'),
                value: tableDensity,
                labels: {
                  compact: t('audit.densityCompact'),
                  standard: t('audit.densityStandard'),
                  comfortable: t('audit.densityComfortable'),
                },
                onChange: changeDensity,
              }}
              exportMenu={{
                label: t('audit.export'),
                menuLabel: t('audit.exportMenu'),
                items: [
                  {
                    id: 'page',
                    label: t('audit.exportPage', { count: result.data?.items.length ?? 0 }),
                    onSelect: () => void exportCsv(result.data?.items ?? [], 'audit-page.csv'),
                  },
                  ...(selectedRecords.length > 0
                    ? [
                        {
                          id: 'selection',
                          label: t('audit.exportSelection', {
                            count: selectedRecords.length,
                          }),
                          onSelect: () => void exportCsv(selectedRecords, 'audit-selection.csv'),
                        },
                      ]
                    : []),
                ],
              }}
            />
          }
          content={
            <div aria-busy={result.loading || undefined}>
              {selectedRecords.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/30 px-4 py-2">
                  <span aria-live="polite" className="text-xs font-medium text-ink-muted">
                    {t('audit.selected', { count: selectedRecords.length })}
                  </span>
                  <Action size="sm" variant="quiet" onPress={() => setSelected([])}>
                    {t('identityProduct.clear')}
                  </Action>
                </div>
              ) : null}
              <Suspense fallback={<BusyIndicator label={t('identityProduct.loading')} />}>
                <AuditTable
                  columns={visibleColumns}
                  density={tableDensity}
                  rows={result.data.items}
                  selection={{
                    mode: 'multiple',
                    selectedIds: selectedRecords.map((record) => record.id),
                    onSelectionChange: setSelected,
                  }}
                />
              </Suspense>
            </div>
          }
          narrowContent={
            <ul data-reveal-items className="divide-y divide-border">
              {result.data.items.map((record) => (
                <li key={record.id} className="grid min-w-0 gap-2.5 p-4">
                  <p className="text-xs tabular-nums text-ink-muted">
                    {timestamp(record.createdAt)}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {operation(record)}
                    {status(record)}
                  </div>
                  <p className="break-words text-sm">
                    {t('audit.actor')}: {record.actorName} · {t('audit.object')}:{' '}
                    {record.objectName}
                  </p>
                </li>
              ))}
              {!result.data.items.length ? (
                <li className="p-6">
                  <IdentityEmptyState title={t('audit.empty')} description={t('audit.readonly')} />
                </li>
              ) : null}
            </ul>
          }
          pagination={
            <CollectionPagination
              summary={t('management.pagination', {
                page: formatNumber(locale, filters.page),
                pages: formatNumber(locale, pages),
                total: formatNumber(locale, result.data.total),
              })}
              pager={
                <PaginationControl
                  label={t('audit.records')}
                  page={filters.page}
                  totalPages={pages}
                  disabled={result.loading}
                  previousLabel={t('management.previous')}
                  nextLabel={t('management.next')}
                  getPageLabel={(p) => formatNumber(locale, p)}
                  onPageChange={(p) => apply({ page: p })}
                />
              }
            />
          }
        />
      )}
    </Page>
  );
}
