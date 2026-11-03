'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { formatDate, formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
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
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { PaginationControl } from '@clouddrive/ui-adapter/navigation';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { SelectField, CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { useRef } from 'react';
import type { BatchStatusResult } from '@clouddrive/surface/identity/runtime';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { NavigationIcon } from '@clouddrive/surface/icon-presentation';
import { Plus, RefreshCw, UserCheck, UserX } from '../../../src/action-icons';
import {
  useIdentityPort,
  IdentityError,
  defaultUserQuery,
  type UserQuery,
  type DirectoryUser,
} from '@clouddrive/surface/identity/runtime';
import { route, RouteLink, usePluginNavigation } from '@clouddrive/plugin-framework/plugin';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { rehydrateStore } from '@clouddrive/state-foundation';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { useIdentityQuery } from '../../../src/identity/use-query';
import {
  IdentityQueryState,
  IdentityModeNotice,
  IdentityMutationError,
} from '../../../src/identity/query-state';
import { useUsersColumnLayoutStore } from '../stores/column-layout';
import { browserCsvExport } from './csv-export';

export function UsersPage({ query }: Readonly<{ query: UserQuery | null }>) {
  const port = useIdentityPort();
  const { t, locale } = useFrontendTranslation();
  const { notify } = useFeedback();
  const navigation = usePluginNavigation();
  const preferencesPort = usePreferencesPort<Preferences>();
  const preferences = preferencesPort.getSnapshot();
  // 表格密度 / 列布局记忆：订阅偏好（Host port 可读写，写入即持久化到偏好 store）。
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
  const [filterError, setFilterError] = useState<IdentityError | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [batchNames, setBatchNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [batchResult, setBatchResult] = useState<BatchStatusResult | null>(null);
  const [batchTarget, setBatchTarget] = useState<'active' | 'disabled' | null>(null);
  const [batchPending, setBatchPending] = useState(false);
  const batchLock = useRef(false);
  const [search, setSearch] = useState(query?.q ?? '');
  const result = useIdentityQuery(`users:${JSON.stringify(query)}`, async (service) => {
    if (!query) throw new IdentityError('validation');
    const access = await service.access();
    if (!access.permissions.includes('users.read')) throw new IdentityError('forbidden');
    const [page, roles] = await Promise.all([service.list(query), service.roles()]);
    return { access, page, roles };
  });
  function apply(patch: Partial<UserQuery>) {
    setFilterError(null);
    void (async () => {
      const { userQuerySchema } = await import('../../../src/identity/model');
      const parsed = userQuerySchema.safeParse({ ...(query ?? defaultUserQuery), ...patch });
      if (!parsed.success) return;
      const next = parsed.data;
      navigation.navigate(
        route(
          'users',
          {},
          {
            query: {
              q: next.q,
              status: next.status,
              roleId: next.roleId,
              sort: next.sort,
              direction: next.direction,
              page: String(next.page),
              pageSize: String(next.pageSize),
            },
          },
        ),
      );
    })().catch((error: unknown) => {
      setFilterError(error instanceof IdentityError ? error : new IdentityError('unavailable'));
    });
  }
  const clear = () => navigation.navigate(route('users'));
  const data = result.data;
  const selectedUsers = data?.page.items.filter((user) => selected.includes(user.id)) ?? [];
  async function submitBatch() {
    if (!batchTarget || batchLock.current || !selectedUsers.length) return;
    batchLock.current = true;
    setBatchPending(true);
    setBatchNames(new Map(selectedUsers.map((user) => [user.id, user.name])));
    try {
      const response = await port.batchStatus({
        status: batchTarget,
        items: selectedUsers.map(({ id, version }) => ({ id, version })),
      });
      setBatchResult(response);
      setSelected(response.items.filter((item) => !item.success).map((item) => item.id));
      setBatchTarget(null);
      result.reload();
    } catch (error) {
      setFilterError(error instanceof IdentityError ? error : new IdentityError('unavailable'));
      throw error;
    } finally {
      batchLock.current = false;
      setBatchPending(false);
    }
  }
  const roleLabel = (id: string) =>
    ['administrator', 'operator', 'viewer'].includes(id)
      ? t(`identityProduct.roleNames.${id}`)
      : (data?.roles.find((role) => role.id === id)?.name ?? id);
  const status = (user: DirectoryUser) => (
    <StatusPill tone={user.status === 'active' ? 'success' : 'neutral'}>
      {t(`identityProduct.${user.status}`)}
    </StatusPill>
  );
  const detailLink = (user: DirectoryUser) => (
    <RouteLink target={route('users.detail', {}, { query: { id: user.id } })}>
      {user.name}
    </RouteLink>
  );
  const columns: readonly DataColumn<DirectoryUser>[] = [
    {
      id: 'name',
      label: t('identityProduct.name'),
      rowHeader: true,
      sortable: true,
      render: detailLink,
    },
    {
      id: 'email',
      label: t('identityProduct.email'),
      sortable: true,
      render: (user) => user.email,
    },
    { id: 'status', label: t('identityProduct.status'), render: status },
    {
      id: 'roles',
      label: t('identityProduct.roles'),
      render: (user) => user.roleIds.map(roleLabel).join(' / '),
    },
    {
      id: 'createdAt',
      label: t('users.createdAt'),
      sortable: true,
      render: (user) =>
        formatDate(
          locale,
          user.createdAt,
          preferences.localeRegion.timeZone === 'auto'
            ? {}
            : { timeZone: preferences.localeRegion.timeZone },
        ),
    },
  ];
  // 列设置：用户目录列显隐/顺序按登录用户持久化（users 插件私有 store），
  // 恢复时 normalizeColumnLayout 过滤退役列并把姓名标识列固定在首位。
  const [columnOverride, setColumnOverride] = useState<readonly string[] | null>(null);
  const userId = data?.access.user.id;
  const savedColumnLayout = useUsersColumnLayoutStore((state) =>
    userId ? state.layouts[userId] : undefined,
  );
  useEffect(() => {
    rehydrateStore(useUsersColumnLayoutStore);
  }, []);
  const mandatoryColumns = new Set(['name']);
  const canonicalColumnIds = columns.map((column) => column.id);
  const visibleColumnIds =
    columnOverride ??
    normalizeColumnLayout(
      canonicalColumnIds,
      rememberColumnLayout ? savedColumnLayout?.visibleOrder : undefined,
      mandatoryColumns,
    );
  const visibleColumns = visibleColumnIds.flatMap((id) => {
    const column = columns.find((item) => item.id === id);
    return column ? [column] : [];
  });
  const persistColumnOrder = (order: readonly string[]) => {
    setColumnOverride(order);
    if (!userId || !rememberColumnLayout) return;
    useUsersColumnLayoutStore.getState().saveLayout(userId, { visibleOrder: order });
  };
  const resetColumnOrder = () => {
    setColumnOverride(null);
    if (userId) useUsersColumnLayoutStore.getState().resetLayout(userId);
  };
  const columnSettingsText: ColumnSettingsText = {
    title: t('users.columnSettingsTitle'),
    description: t('users.columnSettingsDescription'),
    mandatory: t('users.columnMandatory'),
    reset: t('users.columnReset'),
    close: t('users.columnClose'),
    moveUp: (columnLabel) => t('users.columnMoveUp', { column: columnLabel }),
    moveDown: (columnLabel) => t('users.columnMoveDown', { column: columnLabel }),
  };
  // 密度走正式 Preferences Port（Host 提供读写实现）：写入即持久化到偏好 store。
  const changeDensity = (value: DensityLevel) => {
    const outcome = preferencesPort.updateCategory('dataDisplay', { tableDensity: value });
    if (!outcome.ok) notify({ title: t('users.densityFailure'), tone: 'danger' });
  };
  const timeZone = preferences.localeRegion.timeZone;
  const csvColumns: readonly CsvColumn[] = [
    { id: 'name', label: t('identityProduct.name') },
    { id: 'email', label: t('identityProduct.email') },
    { id: 'status', label: t('identityProduct.status') },
    { id: 'roles', label: t('identityProduct.roles') },
    { id: 'createdAt', label: t('users.createdAt') },
  ];
  const exportCsv = async (users: readonly DirectoryUser[], fileName: string) => {
    try {
      const rows = users.map((user) => ({
        name: user.name,
        email: user.email,
        status: t(`identityProduct.${user.status}`),
        roles: user.roleIds.map(roleLabel).join(' / '),
        createdAt: formatDate(locale, user.createdAt, timeZone === 'auto' ? {} : { timeZone }),
      }));
      await browserCsvExport.downloadCsv(fileName, toCsv(rows, csvColumns));
      notify({ title: t('users.exportSuccess', { count: users.length }), tone: 'success' });
    } catch {
      notify({ title: t('users.exportFailure'), tone: 'danger' });
    }
  };
  const activeFilters: readonly CollectionActiveFilter[] = query
    ? [
        ...(query.q
          ? [
              {
                id: 'q',
                label: `${t('users.search')}: ${query.q}`,
                onRemove: () => {
                  setSearch('');
                  apply({ q: '', page: 1 });
                },
              },
            ]
          : []),
        ...(query.status !== 'all'
          ? [
              {
                id: 'status',
                label: `${t('identityProduct.status')}: ${t(`identityProduct.${query.status}`)}`,
                onRemove: () => apply({ status: 'all', page: 1 }),
              },
            ]
          : []),
        ...(query.roleId !== 'all'
          ? [
              {
                id: 'roleId',
                label: `${t('identityProduct.roles')}: ${roleLabel(query.roleId)}`,
                onRemove: () => apply({ roleId: 'all', page: 1 }),
              },
            ]
          : []),
      ]
    : [];
  const pages = Math.max(1, Math.ceil((data?.page.total ?? 0) / (query?.pageSize ?? 20)));
  const empty = (
    <StateSurface
      state="empty"
      icon={<NavigationIcon iconId="identity" />}
      title={t('users.empty')}
      description={t('users.emptyDescription')}
      actionLabel={t('identityProduct.clear')}
      onAction={clear}
    />
  );
  return (
    <Page>
      <PageHeader
        eyebrow={t('users.eyebrow')}
        title={t('users.title')}
        description={t('users.description')}
        actions={
          data?.access.permissions.includes('users.create') ? (
            <RouteLink
              target={route('users.create')}
              presentation="action"
              variant="primary"
              leadingIcon={<Plus className="size-4" />}
            >
              {t('users.create')}
            </RouteLink>
          ) : undefined
        }
      />
      <IdentityModeNotice mode={port.mode} />
      <IdentityMutationError error={filterError} />
      {!query ? (
        <StateSurface
          state="error"
          icon={<NavigationIcon iconId="identity" />}
          title={t('users.invalidQuery')}
          description={t('users.invalidQueryDescription')}
          actionLabel={t('identityProduct.clear')}
          onAction={clear}
        />
      ) : result.error || !data ? (
        <IdentityQueryState error={result.error} retry={result.reload} />
      ) : (
        <Collection
          title={t('users.collection')}
          count={formatNumber(locale, data.page.total)}
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
                    label={t('users.search')}
                    placeholder={t('users.searchPlaceholder')}
                    value={search}
                    onValueChange={(val) => {
                      setSearch(val);
                      if (!val && query.q) {
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
                    label={t('identityProduct.status')}
                    value={query.status}
                    options={['all', 'active', 'disabled'].map((value) => ({
                      value,
                      label: t(`identityProduct.${value}`),
                    }))}
                    onValueChange={(value) => {
                      if (value === 'all' || value === 'active' || value === 'disabled')
                        apply({ status: value, page: 1 });
                    }}
                  />
                  <SelectField
                    presentation="toolbar"
                    label={t('identityProduct.roles')}
                    value={query.roleId}
                    options={[
                      { value: 'all', label: t('identityProduct.all') },
                      ...data.roles.map((role) => ({ value: role.id, label: roleLabel(role.id) })),
                    ]}
                    onValueChange={(roleId) => apply({ roleId, page: 1 })}
                  />
                </>
              }
              advanced={
                <div className="grid gap-3 rounded-panel border border-border bg-surface p-4 text-sm sm:grid-cols-3">
                  <SelectField
                    label={t('users.sort')}
                    value={query.sort}
                    options={[
                      { value: 'name', label: t('identityProduct.name') },
                      { value: 'email', label: t('identityProduct.email') },
                      { value: 'createdAt', label: t('users.createdAt') },
                    ]}
                    onValueChange={(value) => {
                      if (value === 'name' || value === 'email' || value === 'createdAt')
                        apply({ sort: value, page: 1 });
                    }}
                  />
                  <SelectField
                    label={t('users.direction')}
                    value={query.direction}
                    options={[
                      { value: 'asc', label: t('users.ascending') },
                      { value: 'desc', label: t('users.descending') },
                    ]}
                    onValueChange={(value) => {
                      if (value === 'asc' || value === 'desc') apply({ direction: value, page: 1 });
                    }}
                  />
                  <SelectField
                    label={t('users.pageSize')}
                    value={String(query.pageSize)}
                    options={[10, 20, 50].map((value) => ({
                      value: String(value),
                      label: formatNumber(locale, value),
                    }))}
                    onValueChange={(value) => {
                      if (value === '10' || value === '20' || value === '50')
                        apply({
                          pageSize: value === '10' ? 10 : value === '20' ? 20 : 50,
                          page: 1,
                        });
                    }}
                  />
                </div>
              }
              advancedLabel={t('users.advancedFilters')}
              advancedOpenLabel={t('users.advancedFiltersOpen')}
              activeFilters={activeFilters}
              activeFiltersLabel={t('users.activeFilters')}
              onResetFilters={() => {
                setSearch('');
                clear();
              }}
              resetFiltersLabel={t('users.resetFilters')}
            />
          }
          toolbar={
            <CollectionToolbar
              label={t('users.toolbar')}
              columnSettings={{
                triggerLabel: t('users.columnSettings'),
                columns: columns.map((column) => ({
                  id: column.id,
                  label: column.label,
                  mandatory: column.id === 'name',
                })),
                visibleOrder: visibleColumnIds,
                onChange: persistColumnOrder,
                onReset: resetColumnOrder,
                text: columnSettingsText,
              }}
              density={{
                label: t('users.density'),
                value: tableDensity,
                labels: {
                  compact: t('users.densityCompact'),
                  standard: t('users.densityStandard'),
                  comfortable: t('users.densityComfortable'),
                },
                onChange: changeDensity,
              }}
              {...(data.access.permissions.includes('users.read')
                ? {
                    exportMenu: {
                      label: t('users.export'),
                      menuLabel: t('users.exportMenu'),
                      items: [
                        {
                          id: 'page',
                          label: t('users.exportPage', { count: data.page.items.length }),
                          onSelect: () => void exportCsv(data.page.items, 'users-page.csv'),
                        },
                        ...(selectedUsers.length > 0
                          ? [
                              {
                                id: 'selection',
                                label: t('users.exportSelection', {
                                  count: selectedUsers.length,
                                }),
                                onSelect: () =>
                                  void exportCsv(selectedUsers, 'users-selection.csv'),
                              },
                            ]
                          : []),
                      ],
                    },
                  }
                : {})}
            />
          }
          bulk={
            data.access.permissions.includes('users.status') ? (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-muted/30 px-4 py-2">
                <div className="flex items-center gap-3">
                  <CheckboxField
                    label={t('users.selectPage')}
                    checked={
                      Boolean(data.page.items.length) &&
                      selectedUsers.length === data.page.items.length
                    }
                    disabled={batchPending || !data.page.items.length}
                    onCheckedChange={(checked) =>
                      setSelected(checked ? data.page.items.map((u) => u.id) : [])
                    }
                  />
                  {selectedUsers.length ? (
                    <span aria-live="polite" className="text-xs font-medium text-ink-muted">
                      {t('users.selected', { count: selectedUsers.length })}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {selectedUsers.length ? (
                    <Action size="sm" variant="quiet" onPress={() => setSelected([])}>
                      {t('identityProduct.clear')}
                    </Action>
                  ) : null}
                  <Action
                    size="sm"
                    variant="secondary"
                    disabled={!selectedUsers.length || batchPending}
                    leadingIcon={<UserCheck className="size-3.5" />}
                    onPress={() => setBatchTarget('active')}
                  >
                    {t('users.batchEnable')}
                  </Action>
                  <Action
                    size="sm"
                    variant="secondary"
                    disabled={!selectedUsers.length || batchPending}
                    leadingIcon={<UserX className="size-3.5" />}
                    onPress={() => setBatchTarget('disabled')}
                  >
                    {t('users.batchDisable')}
                  </Action>
                </div>
              </div>
            ) : null
          }
          content={
            <div aria-busy={result.loading || undefined}>
              {batchResult ? (
                <div className="border-b border-border bg-surface-muted/30 p-3 text-sm">
                  <ul aria-live="polite" className="grid gap-1">
                    {batchResult.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <span className="font-medium">{batchNames.get(item.id) ?? item.id}:</span>
                        <span className={item.success ? 'text-success' : 'text-danger'}>
                          {item.success
                            ? t('users.batchSuccess')
                            : t(
                                item.reason
                                  ? `identityProduct.reasons.${item.reason}`
                                  : `identityProduct.errors.${item.code}`,
                              )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <DataTable
                label={t('users.collection')}
                columns={visibleColumns}
                rows={data.page.items}
                {...(data.access.permissions.includes('users.status')
                  ? {
                      selection: {
                        mode: 'multiple' as const,
                        // 只把当前页仍存在的选中项交给表格：刷新/翻页后自动剪除失效选择。
                        selectedIds: selectedUsers.map((user) => user.id),
                        onSelectionChange: (ids: readonly string[]) => {
                          if (!batchPending) setSelected(ids);
                        },
                      },
                    }
                  : {})}
                emptyContent={empty}
                density={tableDensity}
                pinnedColumnIds={['name']}
                rowSeparators={preferences.dataDisplay.rowSeparators}
                stickyHeader={preferences.dataDisplay.stickyHeader}
                sort={{
                  columnId: query.sort,
                  direction: query.direction === 'asc' ? 'ascending' : 'descending',
                  onSortChange: (columnId, direction) => {
                    if (columnId === 'name' || columnId === 'email' || columnId === 'createdAt')
                      apply({
                        sort: columnId,
                        direction: direction === 'ascending' ? 'asc' : 'desc',
                        page: 1,
                      });
                  },
                }}
              />
            </div>
          }
          narrowContent={
            data.page.items.length ? (
              <ul
                data-reveal-items
                className="divide-y divide-border"
                aria-label={t('users.collection')}
              >
                {data.page.items.map((user) => (
                  <li key={user.id} className="flex items-start gap-3 p-4">
                    {data.access.permissions.includes('users.status') ? (
                      <div className="pt-0.5">
                        <CheckboxField
                          label={t('users.selectUser', { name: user.name })}
                          checked={selected.includes(user.id)}
                          disabled={batchPending}
                          onCheckedChange={(checked) =>
                            setSelected((prior) =>
                              checked ? [...prior, user.id] : prior.filter((id) => id !== user.id),
                            )
                          }
                        />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1 grid gap-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{detailLink(user)}</span>
                        {status(user)}
                      </div>
                      <p className="break-words text-sm text-ink-muted">{user.email}</p>
                      <p className="text-sm text-ink-muted">
                        {user.roleIds.map(roleLabel).join(' / ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              empty
            )
          }
          pagination={
            <CollectionPagination
              summary={t('users.page', {
                page: formatNumber(locale, query.page),
                pages: formatNumber(locale, pages),
              })}
              pager={
                <PaginationControl
                  label={t('users.collection')}
                  page={query.page}
                  totalPages={pages}
                  disabled={result.loading}
                  previousLabel={t('users.previous')}
                  nextLabel={t('users.next')}
                  getPageLabel={(p) => formatNumber(locale, p)}
                  onPageChange={(p) => apply({ page: p })}
                />
              }
            />
          }
        />
      )}
      <ConfirmDialog
        triggerLabel=""
        title={t('users.batchConfirm')}
        description={t('users.batchDescription', {
          count: selectedUsers.length,
          status: t(`identityProduct.${batchTarget ?? 'active'}`),
        })}
        impact={t('users.batchProtection')}
        cancelLabel={t('users.batchCancel')}
        confirmLabel={t('users.batchApply')}
        failureMessage={t('users.batchFailure')}
        isOpen={batchTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBatchTarget(null);
        }}
        onConfirm={submitBatch}
      />
    </Page>
  );
}
