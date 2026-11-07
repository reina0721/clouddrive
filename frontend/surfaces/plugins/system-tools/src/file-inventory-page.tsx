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
import { formatFileBytes } from '../../../src/files/format';
import {
  inventoryKinds,
  inventorySorts,
  inventoryTrashStates,
  maxInventoryPage,
  type InventoryItem,
  type InventoryQuery,
} from '../../../src/files/inventory';
import { CatalogFailure } from './catalog-failure';
import { useFiles } from '../../../src/files/runtime';
import type { Preferences } from '../../../src/preferences-model';
import { useCatalogRequest } from './use-catalog-request';

const initialQuery: InventoryQuery = {
  ownerId: '',
  name: '',
  kind: '',
  trash: 'any',
  hasShare: false,
  hasDirectLink: false,
  sort: 'created',
  direction: 'desc',
  page: 1,
};

const zh = {
  description: '跨账号查阅已发布文件的元数据、逻辑占用及关联链接。',
  filter: '过滤',
  filterHint: '设置条件后应用，列表会从第一页重新查询。',
  filterName: '搜索文件名',
  reset: '重置',
  apply: '应用',
  owner: '所有者 ID',
  name: '文件名',
  size: '大小',
  quota: '逻辑占用',
  created: '创建于',
  updated: '更新于',
  type: '类型',
  trash: '回收标记',
  trashed: '直接回收时间',
  expiry: '回收期限',
  parent: '父目录 ID',
  root: '根目录',
  revision: '内容版本',
  history: '历史版本数',
  share: '存在关联分享',
  directLink: '存在直链',
  yes: '是',
  no: '否',
  all: '全部',
  kind: { file: '文件', folder: '目录', shortcut: '快捷方式' },
  trashState: { any: '全部', direct: '已直接回收', unmarked: '未标直接回收' },
  noResults: '没有符合条件的文件',
  detail: '文件详情',
  detailHint: '查阅条目归属、版本、时间及关联链接。',
  pagination: (page: number, pages: number, total: number) =>
    `第 ${page} / ${pages} 页，共 ${total} 项`,
};
const en: typeof zh = {
  description:
    'Review published file metadata, logical usage, and associated links across accounts.',
  filter: 'Filter',
  filterHint: 'Apply filters to run a new query from the first page.',
  filterName: 'Search file name',
  reset: 'Reset',
  apply: 'Apply',
  owner: 'Owner ID',
  name: 'File name',
  size: 'Size',
  quota: 'Logical usage',
  created: 'Created',
  updated: 'Updated',
  type: 'Type',
  trash: 'Trash marker',
  trashed: 'Directly trashed at',
  expiry: 'Trash expires',
  parent: 'Parent folder ID',
  root: 'Root folder',
  revision: 'Content revision',
  history: 'Historical versions',
  share: 'Has share',
  directLink: 'Has direct link',
  yes: 'Yes',
  no: 'No',
  all: 'All',
  kind: { file: 'File', folder: 'Folder', shortcut: 'Shortcut' },
  trashState: { any: 'All', direct: 'Directly trashed', unmarked: 'No direct trash marker' },
  noResults: 'No files match the filters',
  detail: 'File details',
  detailHint: 'Review ownership, revisions, timestamps, and associated links.',
  pagination: (page: number, pages: number, total: number) =>
    `Page ${page} of ${pages}, ${total} items`,
};

export function FileInventoryPage() {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const title = t('systemTools.nav.files');
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  const time = (value: string) => formatInstant(locale, region, value);
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState<InventoryQuery>();
  const [entry, setEntry] = useState<string>();
  const state = useCatalogRequest(
    useCallback((signal) => files.listInventory(query, signal), [files, query]),
  );
  const page = state.result && 'value' in state.result ? state.result.value : undefined;
  const failure = state.result && 'error' in state.result ? state.result.error : undefined;
  const pageCount = page
    ? Math.max(1, Math.min(maxInventoryPage, Math.ceil(page.total / page.pageSize)))
    : 1;

  return (
    <Page>
      <PageHeader
        title={title}
        description={labels.description}
        actions={
          <>
            <Action variant="secondary" onPress={state.refresh}>
              {t('files.refresh')}
            </Action>
            <Action variant="secondary" onPress={() => setDraft(query)}>
              {labels.filter}
            </Action>
          </>
        }
      />
      <Panel className="surface-route-region overflow-hidden">
        <SectionBody>
          {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
          {failure !== undefined ? <CatalogFailure error={failure} retry={state.refresh} /> : null}
          {page ? (
            <>
              <DataTable<InventoryItem>
                label={title}
                density="compact"
                rows={page.items}
                emptyContent={labels.noResults}
                sort={{
                  columnId: query.sort,
                  direction: query.direction === 'asc' ? 'ascending' : 'descending',
                  onSortChange: (column, direction) => {
                    const sort = inventorySorts.find((value) => value === column);
                    if (sort)
                      setQuery({
                        ...query,
                        sort,
                        direction: direction === 'ascending' ? 'asc' : 'desc',
                        page: 1,
                      });
                  },
                }}
                columns={[
                  {
                    id: 'id',
                    label: 'ID',
                    sortable: true,
                    render: (row) => <span title={row.id}>{row.id.slice(0, 8)}</span>,
                  },
                  {
                    id: 'name',
                    label: labels.name,
                    rowHeader: true,
                    sortable: true,
                    render: (row) => (
                      <Action size="sm" variant="quiet" onPress={() => setEntry(row.id)}>
                        {row.name}
                      </Action>
                    ),
                  },
                  {
                    id: 'size',
                    label: labels.size,
                    sortable: true,
                    render: (row) => formatFileBytes(row.sizeBytes),
                  },
                  {
                    id: 'quota',
                    label: labels.quota,
                    render: (row) => formatFileBytes(row.quotaBytes),
                  },
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
                  onPress={() => setQuery({ ...query, page: query.page - 1 })}
                >
                  {t('administration.previous')}
                </Action>
                <p role="status">{labels.pagination(page.page, pageCount, page.total)}</p>
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={query.page >= pageCount}
                  onPress={() => setQuery({ ...query, page: query.page + 1 })}
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
          onOpenChange={(open) => {
            if (!open) setDraft(undefined);
          }}
          onConfirm={() => setQuery({ ...draft, page: 1 })}
        >
          <div className="min-w-0 space-y-4">
            <TextField
              label={labels.owner}
              value={draft.ownerId}
              maxLength={128}
              onChange={(event) => setDraft({ ...draft, ownerId: event.target.value })}
            />
            <TextField
              label={labels.filterName}
              value={draft.name}
              maxLength={255}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <SelectField
              label={labels.type}
              value={draft.kind}
              options={[
                { value: '', label: labels.all },
                ...inventoryKinds.map((value) => ({ value, label: labels.kind[value] })),
              ]}
              onValueChange={(value) =>
                setDraft({ ...draft, kind: inventoryKinds.find((kind) => kind === value) ?? '' })
              }
            />
            <SelectField
              label={labels.trash}
              value={draft.trash}
              options={inventoryTrashStates.map((value) => ({
                value,
                label: labels.trashState[value],
              }))}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  trash: inventoryTrashStates.find((status) => status === value) ?? 'any',
                })
              }
            />
            <CheckboxField
              label={labels.share}
              checked={draft.hasShare}
              onCheckedChange={(hasShare) => setDraft({ ...draft, hasShare })}
            />
            <CheckboxField
              label={labels.directLink}
              checked={draft.hasDirectLink}
              onCheckedChange={(hasDirectLink) => setDraft({ ...draft, hasDirectLink })}
            />
            <Action
              variant="secondary"
              onPress={() => {
                setQuery(initialQuery);
                setDraft(undefined);
              }}
            >
              {labels.reset}
            </Action>
          </div>
        </DialogSurface>
      ) : null}
      {entry ? (
        <InventoryDetail
          id={entry}
          labels={labels}
          time={time}
          onClose={() => setEntry(undefined)}
        />
      ) : null}
    </Page>
  );
}

function InventoryDetail({
  id,
  labels,
  time,
  onClose,
}: {
  id: string;
  labels: typeof zh;
  time: (value: string) => string;
  onClose: () => void;
}) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const state = useCatalogRequest(
    useCallback((signal) => files.readInventory(id, signal), [files, id]),
  );
  const entry = state.result && 'value' in state.result ? state.result.value : undefined;
  const rows = entry
    ? ([
        ['ID', entry.id],
        [labels.name, entry.name],
        [labels.type, labels.kind[entry.kind]],
        [labels.owner, entry.ownerId],
        [labels.parent, entry.parentId || labels.root],
        [labels.size, formatFileBytes(entry.sizeBytes)],
        [labels.quota, formatFileBytes(entry.quotaBytes)],
        [labels.revision, entry.revision],
        [labels.history, entry.historyCount],
        [labels.created, time(entry.createdAt)],
        [labels.updated, time(entry.updatedAt)],
        [labels.trashed, entry.trashedAt ? time(entry.trashedAt) : '—'],
        [labels.expiry, entry.expiresAt ? time(entry.expiresAt) : '—'],
        [labels.share, entry.hasShare ? labels.yes : labels.no],
        [labels.directLink, entry.hasDirectLink ? labels.yes : labels.no],
      ] as const)
    : [];
  return (
    <DialogSurface
      isOpen
      triggerLabel={labels.detail}
      title={labels.detail}
      description={labels.detailHint}
      cancelLabel={t('files.close')}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
      {state.result && 'error' in state.result ? (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      ) : null}
      {entry ? (
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
