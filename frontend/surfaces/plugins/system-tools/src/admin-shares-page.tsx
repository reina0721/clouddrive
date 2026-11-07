'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { Page, PageHeader, SectionBody } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import {
  adminShareSorts,
  adminShareStatuses,
  type AdminShareItem,
  type AdminShareQuery,
} from '../../../src/files/admin-shares';
import { maxInventoryPage } from '../../../src/files/inventory';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import type { Preferences } from '../../../src/preferences-model';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';

const initialQuery: AdminShareQuery = {
  ownerId: '',
  rootId: '',
  status: '',
  sort: 'created',
  direction: 'desc',
  page: 1,
};

const zh = {
  description: '查看跨账号的分享链接及使用情况。浏览和下载授权从启用统计后累计。',
  filter: '过滤',
  filterHint: '按分享者、源文件或链接状态查找。',
  reset: '重置',
  apply: '应用',
  all: '全部',
  empty: '没有符合条件的分享',
  owner: '分享者 ID',
  rootId: '源文件 ID',
  source: '源文件',
  missing: '源文件不存在',
  title: '分享名称',
  views: '浏览',
  downloads: '下载授权',
  created: '分享于',
  expires: '自动过期',
  revokedAt: '撤销时间',
  status: '链接状态',
  states: { active: '启用', paused: '暂停', expired: '已到期', revoked: '已撤销' },
  details: '分享详情',
  detailHint: '查看链接状态、来源及累计活动。',
  protected: '密码保护',
  yes: '是',
  no: '否',
  revoke: '撤销分享',
  revokeSelected: '撤销选中分享',
  selectPage: '选择本页可撤销分享',
  selectShare: '选择分享',
  revokeHint: '撤销后链接和已签发的下载授权会失效，源文件保留。',
  revokeFailure: '无法撤销分享，请重试。',
  conflict: '链接已更改，请刷新列表后重新选择。',
  result: (count: number) => `已撤销 ${count} 个分享`,
  pagination: (page: number, pages: number, total: number) =>
    `第 ${page} / ${pages} 页，共 ${total} 项`,
};
const en: typeof zh = {
  description:
    'Review share links across accounts. Views and download grants are counted since tracking began.',
  filter: 'Filter',
  filterHint: 'Filter by sharer, source item, or link status.',
  reset: 'Reset',
  apply: 'Apply',
  all: 'All',
  empty: 'No shares match the filters',
  owner: 'Sharer ID',
  rootId: 'Source item ID',
  source: 'Source item',
  missing: 'Source item is missing',
  title: 'Share name',
  views: 'Views',
  downloads: 'Download grants',
  created: 'Shared at',
  expires: 'Expires',
  revokedAt: 'Revoked at',
  status: 'Link status',
  states: { active: 'Active', paused: 'Paused', expired: 'Expired', revoked: 'Revoked' },
  details: 'Share details',
  detailHint: 'Review link status, its source, and activity totals.',
  protected: 'Password protected',
  yes: 'Yes',
  no: 'No',
  revoke: 'Revoke share',
  revokeSelected: 'Revoke selected shares',
  selectPage: 'Select revocable shares on this page',
  selectShare: 'Select share',
  revokeHint: 'Revocation invalidates links and existing download grants. Source files are kept.',
  revokeFailure: 'Unable to revoke shares. Try again.',
  conflict: 'The share changed. Refresh and select it again.',
  result: (count) => `Shares revoked: ${count}`,
  pagination: (page, pages, total) => `Page ${page} of ${pages}, ${total} items`,
};

function ShareDetail({
  id,
  labels,
  time,
  close,
}: {
  id: string;
  labels: typeof zh;
  time: (value: string) => string;
  close: () => void;
}) {
  const { t } = useFrontendTranslation();
  const files = useFiles();
  const state = useCatalogRequest(
    useCallback((signal) => files.readAdminShare(id, signal), [files, id]),
  );
  const item = state.result && 'value' in state.result ? state.result.value : undefined;
  const rows = item
    ? [
        ['ID', item.id],
        [labels.title, item.title || '—'],
        [labels.source, item.rootName ?? labels.missing],
        [labels.rootId, item.rootId],
        [labels.owner, item.ownerId],
        [labels.status, labels.states[item.status]],
        [labels.protected, item.hasPassword ? labels.yes : labels.no],
        [labels.views, item.views],
        [labels.downloads, item.downloads],
        [labels.created, time(item.createdAt)],
        [labels.expires, time(item.expiresAt)],
        [labels.revokedAt, item.revokedAt ? time(item.revokedAt) : '—'],
      ]
    : [];
  return (
    <DialogSurface
      isOpen
      triggerLabel={labels.details}
      title={labels.details}
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
          {rows.map(([label, value]) => (
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

export function AdminSharesPage() {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const title = t('systemTools.nav.shares');
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  const time = (value: string) => formatInstant(locale, region, value);
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState<AdminShareQuery>();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [detail, setDetail] = useState<string>();
  const [targets, setTargets] = useState<AdminShareItem[]>([]);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<number>();
  const state = useCatalogRequest(
    useCallback((signal) => files.listAdminShares(query, signal), [files, query]),
  );
  const page = state.result && 'value' in state.result ? state.result.value : undefined;
  const pages = page
    ? Math.max(1, Math.min(maxInventoryPage, Math.ceil(page.total / page.pageSize)))
    : 1;
  const revocable = page?.canRevoke ? page.items.filter((row) => row.status !== 'revoked') : [];
  const selectedRows = revocable.filter((row) => selected.includes(row.id));
  const apply = (next: AdminShareQuery) => {
    setSelected([]);
    setNotice(undefined);
    setQuery(next);
  };
  const refresh = () => {
    setSelected([]);
    setNotice(undefined);
    state.refresh();
  };
  const beginRevoke = (rows: AdminShareItem[]) => {
    setConflict(false);
    setTargets(rows);
  };
  const revoke = async () => {
    try {
      const count = await files.revokeAdminShares(
        targets.map(({ id, revision }) => ({ id, revision })),
      );
      refresh();
      setNotice(count);
    } catch (error) {
      if (error instanceof FilesError && (error.code === 'conflict' || error.code === 'missing'))
        setConflict(true);
      throw error;
    }
  };

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
            {page?.canRevoke && selectedRows.length > 0 ? (
              <Action variant="danger" onPress={() => beginRevoke(selectedRows)}>
                {labels.revokeSelected} ({selectedRows.length})
              </Action>
            ) : null}
          </>
        }
      />
      <Panel className="surface-route-region overflow-hidden">
        <SectionBody>
          {notice !== undefined ? <p role="status">{labels.result(notice)}</p> : null}
          {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
          {state.result && 'error' in state.result ? (
            <CatalogFailure error={state.result.error} retry={refresh} />
          ) : null}
          {page ? (
            <>
              {revocable.length > 0 ? (
                <CheckboxField
                  label={labels.selectPage}
                  checked={selectedRows.length === revocable.length}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? revocable.map((row) => row.id) : [])
                  }
                />
              ) : null}
              <DataTable<AdminShareItem>
                label={title}
                density="compact"
                rows={page.items}
                emptyContent={labels.empty}
                sort={{
                  columnId: query.sort,
                  direction: query.direction === 'asc' ? 'ascending' : 'descending',
                  onSortChange: (column, direction) => {
                    const sort = adminShareSorts.find((candidate) => candidate === column);
                    if (sort)
                      apply({
                        ...query,
                        sort,
                        direction: direction === 'ascending' ? 'asc' : 'desc',
                        page: 1,
                      });
                  },
                }}
                columns={[
                  ...(revocable.length > 0
                    ? [
                        {
                          id: 'select',
                          label: labels.selectShare,
                          render: (row: AdminShareItem) =>
                            row.status === 'revoked' ? null : (
                              <CheckboxField
                                label={`${labels.selectShare} ${row.id}`}
                                presentation="control-only"
                                checked={selected.includes(row.id)}
                                onCheckedChange={(checked) =>
                                  setSelected((previous) =>
                                    checked
                                      ? [...previous, row.id]
                                      : previous.filter((id) => id !== row.id),
                                  )
                                }
                              />
                            ),
                        },
                      ]
                    : []),
                  {
                    id: 'id',
                    label: 'ID',
                    sortable: true,
                    render: (row) => <span title={row.id}>{row.id.slice(0, 8)}</span>,
                  },
                  {
                    id: 'source',
                    label: labels.source,
                    rowHeader: true,
                    render: (row) => (
                      <div className="flex flex-wrap gap-2">
                        <Action size="sm" variant="quiet" onPress={() => setDetail(row.id)}>
                          {row.rootName ?? labels.missing}
                        </Action>
                        {page.canRevoke && row.status !== 'revoked' ? (
                          <Action size="sm" variant="quiet" onPress={() => beginRevoke([row])}>
                            {labels.revoke}
                          </Action>
                        ) : null}
                      </div>
                    ),
                  },
                  { id: 'views', label: labels.views, sortable: true, render: (row) => row.views },
                  {
                    id: 'downloads',
                    label: labels.downloads,
                    sortable: true,
                    render: (row) => row.downloads,
                  },
                  {
                    id: 'status',
                    label: labels.status,
                    render: (row) => labels.states[row.status],
                  },
                  { id: 'expires', label: labels.expires, render: (row) => time(row.expiresAt) },
                  {
                    id: 'owner',
                    label: labels.owner,
                    render: (row) => <span title={row.ownerId}>{row.ownerId.slice(0, 8)}</span>,
                  },
                  {
                    id: 'created',
                    label: labels.created,
                    sortable: true,
                    render: (row) => time(row.createdAt),
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
          description={labels.filterHint}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.apply}
          onConfirm={() => apply({ ...draft, page: 1 })}
          onOpenChange={(open) => {
            if (!open) setDraft(undefined);
          }}
        >
          <div className="min-w-0 space-y-4">
            <TextField
              label={labels.owner}
              value={draft.ownerId}
              maxLength={128}
              onChange={(event) => setDraft({ ...draft, ownerId: event.target.value })}
            />
            <TextField
              label={labels.rootId}
              value={draft.rootId}
              maxLength={36}
              onChange={(event) => setDraft({ ...draft, rootId: event.target.value })}
            />
            <SelectField
              label={labels.status}
              value={draft.status}
              options={[
                { value: '', label: labels.all },
                ...adminShareStatuses.map((value) => ({ value, label: labels.states[value] })),
              ]}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  status: adminShareStatuses.find((item) => item === value) ?? '',
                })
              }
            />
            <Action
              variant="secondary"
              onPress={() => {
                apply(initialQuery);
                setDraft(undefined);
              }}
            >
              {labels.reset}
            </Action>
          </div>
        </DialogSurface>
      ) : null}
      {detail ? (
        <ShareDetail id={detail} labels={labels} time={time} close={() => setDetail(undefined)} />
      ) : null}
      {targets.length ? (
        <DialogSurface
          isOpen
          triggerLabel={labels.revoke}
          title={labels.revoke}
          description={labels.revokeHint}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.revoke}
          onConfirm={revoke}
          confirmDisabled={conflict}
          failureMessage={conflict ? labels.conflict : labels.revokeFailure}
          onOpenChange={(open) => {
            if (!open) setTargets([]);
          }}
        >
          <ul className="space-y-2 text-sm">
            {targets.map((row) => (
              <li className="break-all" key={row.id}>
                {row.rootName ?? labels.missing} · {row.id}
              </li>
            ))}
          </ul>
          {conflict ? (
            <Action
              variant="secondary"
              onPress={() => {
                setTargets([]);
                refresh();
              }}
            >
              {t('files.refresh')}
            </Action>
          ) : null}
        </DialogSurface>
      ) : null}
    </Page>
  );
}
