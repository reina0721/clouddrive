'use client';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { Page, PageHeader, SectionBody } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import {
  blobReferenceFilters,
  blobSorts,
  blobStorageFilters,
  type BlobCandidate,
  type BlobItem,
  type BlobQuery,
} from '../../../src/files/blobs';
import { formatFileBytes } from '../../../src/files/format';
import { maxInventoryPage } from '../../../src/files/inventory';
import { useFiles } from '../../../src/files/runtime';
import type { Preferences } from '../../../src/preferences-model';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';

const initialQuery: BlobQuery = {
  ownerId: '',
  reference: 'any',
  storage: 'any',
  sort: 'references',
  direction: 'desc',
  page: 1,
};

const zh = {
  description: '查看已引用的内容对象、版本和主存储存在状态。',
  filter: '过滤',
  filterHint: '所有者匹配其文件引用，结果保留对象的全局引用次数。',
  owner: '引用所有者 ID',
  reference: '引用类型',
  storage: '存储策略',
  storageNames: { any: '全部', primary: '主存储' },
  referenceNames: {
    any: '全部',
    current: '包含当前引用',
    history: '包含历史引用',
    'history-only': '仅历史引用',
  },
  apply: '应用',
  reset: '重置',
  size: '大小',
  references: '引用次数',
  owners: '关联账号数',
  firstFile: '最早关联文件创建于',
  empty: '没有符合条件的 Blob',
  detail: 'Blob 详情',
  detailHint: '查看对象存在状态，以及仍引用它的文件和版本。',
  exists: '对象存在于主存储',
  missing: '主存储中缺少该对象',
  current: '当前引用',
  history: '历史引用',
  trashed: '直接回收',
  version: '版本',
  fileId: '文件 ID',
  noReferences: '本页没有引用',
  reclamation: '待回收',
  referencesTab: '已引用',
  reclamationHint: '只有失去所有引用且超过保护期的 Blob 才能永久清理。',
  noCandidates: '没有待回收的 Blob',
  detached: '解除引用时间',
  readyAt: '最早回收时间',
  waiting: '保护期内',
  ready: '可以回收',
  status: '状态',
  autoOn: '已开启自动回收',
  autoOff: '自动回收已关闭',
  reclaim: '永久清理',
  reclaimHint: '确认后会删除主存储中的这个对象。此操作无法撤销。',
  reclaimFailure: '未能清理该对象。请刷新并确认它仍可回收。',
  reclaimed: '已清理 Blob',
  page: (current: number, pages: number, total: number) =>
    `第 ${current} / ${pages} 页，共 ${total} 项`,
};
const en: typeof zh = {
  description: 'Inspect referenced content objects, versions, and presence in primary storage.',
  filter: 'Filter',
  filterHint: 'Match objects by a file owner while keeping the global reference counts.',
  owner: 'Reference owner ID',
  reference: 'Reference type',
  storage: 'Storage policy',
  storageNames: { any: 'All', primary: 'Primary storage' },
  referenceNames: {
    any: 'All',
    current: 'Has current references',
    history: 'Has historical references',
    'history-only': 'Historical references only',
  },
  apply: 'Apply',
  reset: 'Reset',
  size: 'Size',
  references: 'References',
  owners: 'Referencing accounts',
  firstFile: 'Earliest referencing file created',
  empty: 'No blobs match the filters',
  detail: 'Blob details',
  detailHint: 'Inspect storage presence and the files and versions that reference this object.',
  exists: 'Object exists in primary storage',
  missing: 'Object is missing in primary storage',
  current: 'Current references',
  history: 'Historical references',
  trashed: 'Directly trashed',
  version: 'Revision',
  fileId: 'File ID',
  noReferences: 'No references on this page',
  reclamation: 'Pending reclamation',
  referencesTab: 'Referenced',
  reclamationHint: 'Only blobs past the grace period with no remaining references can be removed.',
  noCandidates: 'No blobs pending reclamation',
  detached: 'Detached',
  readyAt: 'Eligible after',
  waiting: 'In grace period',
  ready: 'Ready',
  status: 'Status',
  autoOn: 'Automatic reclamation is on',
  autoOff: 'Automatic reclamation is off',
  reclaim: 'Permanently remove',
  reclaimHint: 'This deletes the selected object from primary storage and cannot be undone.',
  reclaimFailure: 'Could not remove the object. Refresh to confirm it is still eligible.',
  reclaimed: 'Blob removed',
  page: (current: number, pages: number, total: number) =>
    `Page ${current} of ${pages}, ${total} items`,
};

export function BlobCatalogPage() {
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const title = t('systemTools.nav.blobs');
  const [showCandidates, setShowCandidates] = useState(false);
  return showCandidates ? (
    <BlobReclamationPanel
      title={title}
      labels={labels}
      switchView={() => setShowCandidates(false)}
    />
  ) : (
    <ReferencedBlobCatalog
      title={title}
      labels={labels}
      switchView={() => setShowCandidates(true)}
    />
  );
}

type BlobViewProps = { title: string; labels: typeof zh; switchView: () => void };

function ReferencedBlobCatalog({ title, labels, switchView }: BlobViewProps) {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  const [query, setQuery] = useState(initialQuery);
  const [draft, setDraft] = useState<BlobQuery>();
  const [id, setID] = useState<string>();
  const state = useCatalogRequest(
    useCallback((signal) => files.listBlobs(query, signal), [files, query]),
  );
  const page = state.result && 'value' in state.result ? state.result.value : undefined;

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
            <Action variant="secondary" onPress={switchView}>
              {labels.reclamation}
            </Action>
          </>
        }
      />
      <Panel className="surface-route-region overflow-hidden">
        <SectionBody>
          {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
          {state.result && 'error' in state.result ? (
            <CatalogFailure error={state.result.error} retry={state.refresh} />
          ) : null}
          {page ? (
            <>
              <DataTable<BlobItem>
                label={title}
                density="compact"
                rows={page.items}
                emptyContent={labels.empty}
                sort={{
                  columnId: query.sort,
                  direction: query.direction === 'asc' ? 'ascending' : 'descending',
                  onSortChange: (column, direction) => {
                    const sort = blobSorts.find((value) => value === column);
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
                    rowHeader: true,
                    sortable: true,
                    render: (row) => (
                      <Action size="sm" variant="quiet" onPress={() => setID(row.id)}>
                        {row.id}
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
                    id: 'storage',
                    label: labels.storage,
                    render: (row) => labels.storageNames[row.storage],
                  },
                  {
                    id: 'references',
                    label: labels.references,
                    sortable: true,
                    render: (row) => row.referenceCount,
                  },
                  { id: 'owners', label: labels.owners, render: (row) => row.ownerCount },
                  {
                    id: 'first-file',
                    label: labels.firstFile,
                    sortable: true,
                    render: (row) => formatInstant(locale, region, row.firstFileCreated),
                  },
                ]}
              />
              <BlobPager
                page={page.page}
                pageSize={page.pageSize}
                total={page.total}
                labels={labels}
                change={(next) => setQuery({ ...query, page: next })}
              />
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
            <SelectField
              label={labels.reference}
              value={draft.reference}
              options={blobReferenceFilters.map((value) => ({
                value,
                label: labels.referenceNames[value],
              }))}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  reference: blobReferenceFilters.find((option) => option === value) ?? 'any',
                })
              }
            />
            <SelectField
              label={labels.storage}
              value={draft.storage}
              options={blobStorageFilters.map((value) => ({
                value,
                label: labels.storageNames[value],
              }))}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  storage: blobStorageFilters.find((option) => option === value) ?? 'any',
                })
              }
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
      {id ? <BlobDetails id={id} labels={labels} onClose={() => setID(undefined)} /> : null}
    </Page>
  );
}

function BlobReclamationPanel({ title, labels, switchView }: BlobViewProps) {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  const [pageNumber, setPageNumber] = useState(1);
  const [candidate, setCandidate] = useState<BlobCandidate>();
  const [removed, setRemoved] = useState(false);
  const state = useCatalogRequest(
    useCallback((signal) => files.listBlobCandidates(pageNumber, signal), [files, pageNumber]),
  );
  const page = state.result && 'value' in state.result ? state.result.value : undefined;
  return (
    <Page>
      <PageHeader
        title={`${title} · ${labels.reclamation}`}
        description={labels.reclamationHint}
        actions={
          <>
            <Action variant="secondary" onPress={state.refresh}>
              {t('files.refresh')}
            </Action>
            <Action variant="secondary" onPress={switchView}>
              {labels.referencesTab}
            </Action>
          </>
        }
      />
      <Panel className="surface-route-region overflow-hidden">
        <SectionBody>
          {removed ? <p role="status">{labels.reclaimed}</p> : null}
          {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
          {state.result && 'error' in state.result ? (
            <CatalogFailure error={state.result.error} retry={state.refresh} />
          ) : null}
          {page ? (
            <>
              <p className="text-sm text-ink-muted">
                {page.automatic ? labels.autoOn : labels.autoOff}
              </p>
              <DataTable<BlobCandidate>
                label={labels.reclamation}
                density="compact"
                rows={page.items}
                emptyContent={labels.noCandidates}
                columns={[
                  { id: 'id', label: 'ID', rowHeader: true, render: (row) => row.id },
                  {
                    id: 'size',
                    label: labels.size,
                    render: (row) => formatFileBytes(row.sizeBytes),
                  },
                  {
                    id: 'detached',
                    label: labels.detached,
                    render: (row) => formatInstant(locale, region, row.detachedAt),
                  },
                  {
                    id: 'readyAt',
                    label: labels.readyAt,
                    render: (row) => formatInstant(locale, region, row.readyAt),
                  },
                  {
                    id: 'status',
                    label: labels.status,
                    render: (row) =>
                      row.ready && page.canReclaim ? (
                        <Action
                          variant="quiet"
                          size="sm"
                          onPress={() => {
                            setRemoved(false);
                            setCandidate(row);
                          }}
                        >
                          {labels.reclaim}
                        </Action>
                      ) : row.ready ? (
                        labels.ready
                      ) : (
                        labels.waiting
                      ),
                  },
                ]}
              />
              <BlobPager
                page={page.page}
                pageSize={page.pageSize}
                total={page.total}
                labels={labels}
                change={setPageNumber}
              />
            </>
          ) : null}
        </SectionBody>
      </Panel>
      {candidate ? (
        <DialogSurface
          isOpen
          triggerLabel={labels.reclaim}
          title={labels.reclaim}
          description={labels.reclaimHint}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.reclaim}
          failureMessage={labels.reclaimFailure}
          onOpenChange={(open) => {
            if (!open) setCandidate(undefined);
          }}
          onConfirm={async () => {
            await files.reclaimBlob(candidate.id);
            setRemoved(true);
            if (page?.items.length === 1 && pageNumber > 1) setPageNumber(pageNumber - 1);
            else state.refresh();
          }}
        >
          <p className="break-all">{candidate.id}</p>
        </DialogSurface>
      ) : null}
    </Page>
  );
}

function BlobPager({
  page,
  pageSize,
  total,
  labels,
  change,
}: {
  page: number;
  pageSize: number;
  total: number;
  labels: typeof zh;
  change: (page: number) => void;
}) {
  const { t } = useFrontendTranslation();
  const pages = Math.max(1, Math.min(maxInventoryPage, Math.ceil(total / pageSize)));
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <Action size="sm" variant="secondary" disabled={page <= 1} onPress={() => change(page - 1)}>
        {t('administration.previous')}
      </Action>
      <p role="status">{labels.page(page, pages, total)}</p>
      <Action
        size="sm"
        variant="secondary"
        disabled={page >= pages}
        onPress={() => change(page + 1)}
      >
        {t('administration.next')}
      </Action>
    </div>
  );
}

function BlobDetails({
  id,
  labels,
  onClose,
}: {
  id: string;
  labels: typeof zh;
  onClose: () => void;
}) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const [page, setPage] = useState(1);
  const state = useCatalogRequest(
    useCallback((signal) => files.readBlob(id, page, signal), [files, id, page]),
  );
  const detail = state.result && 'value' in state.result ? state.result.value : undefined;
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
      {detail ? (
        <div className="min-w-0 space-y-4">
          <p className="break-all text-sm">{detail.blob.id}</p>
          <p role="status">{detail.exists ? labels.exists : labels.missing}</p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt>{labels.size}</dt>
              <dd>{formatFileBytes(detail.blob.sizeBytes)}</dd>
            </div>
            <div>
              <dt>{labels.current}</dt>
              <dd>{detail.blob.currentCount}</dd>
            </div>
            <div>
              <dt>{labels.history}</dt>
              <dd>{detail.blob.historyCount}</dd>
            </div>
          </dl>
          {detail.references.length ? (
            <ul className="space-y-2">
              {detail.references.map((reference) => (
                <li
                  key={reference.fileId + ':' + reference.revision}
                  className="space-y-1 rounded-control border border-border p-2 text-sm"
                >
                  <p className="break-all font-medium">{reference.name}</p>
                  <p>
                    {reference.current ? labels.current : labels.history} · {labels.version}{' '}
                    {reference.revision}
                    {reference.trashed ? ' · ' + labels.trashed : ''}
                  </p>
                  <p className="break-all">
                    {labels.fileId} {reference.fileId}
                  </p>
                  <p className="break-all">
                    {labels.owner} {reference.ownerId}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>{labels.noReferences}</p>
          )}
          <BlobPager
            page={page}
            pageSize={detail.pageSize}
            total={detail.blob.referenceCount}
            labels={labels}
            change={setPage}
          />
        </div>
      ) : null}
    </DialogSurface>
  );
}
