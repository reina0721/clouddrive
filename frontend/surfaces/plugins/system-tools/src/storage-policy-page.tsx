'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { Page, PageHeader } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { formatFileBytes } from '../../../src/files/format';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import type { StoragePolicy, StoragePolicyInput } from '../../../src/files/storage-policy';
import type { Preferences } from '../../../src/preferences-model';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';
import { StorageNameRulesPanel } from './storage-name-rules-panel';

const fields = ['maxFileBytes', 'chunkBytes'] as const;
const zh = {
  description: '查看默认发布后端、文件 Blob 用量和上传限额。',
  current: '默认存储策略',
  backends: { local: '本机存储', s3: 'S3 兼容', minio: 'MinIO', disabled: '存储已禁用' },
  metrics: 'Blob 用量',
  load: '加载统计数据',
  refreshStats: '刷新统计',
  checked: '统计时间',
  scope: '用量来自文件元数据。同一对象只计一次。',
  blobCount: '已引用 Blob',
  blobBytes: '已引用大小',
  currentReferences: '当前文件引用',
  historyReferences: '历史版本引用',
  pendingCount: '登记待回收 Blob',
  pendingBytes: '登记待回收大小',
  upload: '存储与上传',
  maxFileBytes: '单文件上限（字节）',
  chunkBytes: '上传分片上限（字节）',
  inherit: '使用部署默认值',
  values: (active: string, configured: string, defaults: string) =>
    `当前 ${active} · 下次生效 ${configured} · 部署 ${defaults}`,
  range: (max: number) => `输入 1 至 ${max} 字节的整数，留空恢复部署默认值。`,
  pending: '已保存的限额将在服务重启后生效。',
  applied: '当前生效值与已保存的限额一致。',
  readonly: '当前账号具有只读权限。',
  save: '保存上传限额',
  confirm: '确认上传限额',
  confirmHint: '新的应用实例会使用保存的限额，现有文件仍保留。',
  conflict: '另一处已保存新版本。刷新后再编辑。',
  failure: '未能保存上传限额，请重试。',
};
const en: typeof zh = {
  description: 'Review the default storage backend, Blob usage and upload limits.',
  current: 'Default storage policy',
  backends: {
    local: 'Local storage',
    s3: 'S3 compatible',
    minio: 'MinIO',
    disabled: 'Storage disabled',
  },
  metrics: 'Blob usage',
  load: 'Load usage statistics',
  refreshStats: 'Refresh statistics',
  checked: 'Checked at',
  scope: 'Usage comes from file metadata. Each object is counted once.',
  blobCount: 'Referenced Blobs',
  blobBytes: 'Referenced size',
  currentReferences: 'Current file references',
  historyReferences: 'Version references',
  pendingCount: 'Blobs registered for reclamation',
  pendingBytes: 'Size registered for reclamation',
  upload: 'Storage and uploads',
  maxFileBytes: 'Maximum file size (bytes)',
  chunkBytes: 'Maximum upload chunk size (bytes)',
  inherit: 'Use deployment default',
  values: (active, configured, defaults) =>
    `Active ${active} · Next startup ${configured} · Deployment ${defaults}`,
  range: (max) => `Enter an integer from 1 to ${max} bytes, or leave blank to inherit.`,
  pending: 'Saved limits take effect after the service restarts.',
  applied: 'The saved limits are active.',
  readonly: 'This account has read-only access.',
  save: 'Save upload limits',
  confirm: 'Confirm upload limits',
  confirmHint: 'The next application instance applies the saved limits. Existing files are kept.',
  conflict: 'New limits were saved elsewhere. Refresh before editing again.',
  failure: 'Could not save the upload limits. Try again.',
};

function UsageSnapshot({ labels }: { labels: typeof zh }) {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  const usage = useCatalogRequest(useCallback((signal) => files.readStorageUsage(signal), [files]));
  if (!usage.result) return <p role="status">{t('administration.loading')}</p>;
  if ('error' in usage.result)
    return <CatalogFailure error={usage.result.error} retry={usage.refresh} />;
  const value = usage.result.value;
  const number = (value: number) => formatNumber(locale, value);
  return (
    <>
      <dl className="space-y-2 text-sm">
        {(
          [
            [labels.blobCount, number(value.blobCount)],
            [labels.blobBytes, formatFileBytes(value.blobBytes)],
            [labels.currentReferences, number(value.currentReferences)],
            [labels.historyReferences, number(value.historyReferences)],
            [labels.pendingCount, number(value.pendingCount)],
            [labels.pendingBytes, formatFileBytes(value.pendingBytes)],
            [labels.checked, formatInstant(locale, region, value.checkedAt)],
          ] as const
        ).map(([label, item]) => (
          <div key={label} className="flex flex-wrap justify-between gap-2">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="font-medium">{item}</dd>
          </div>
        ))}
      </dl>
      <Action variant="secondary" onPress={usage.refresh}>
        {labels.refreshStats}
      </Action>
    </>
  );
}

const toDraft = ({ maxFileBytes, chunkBytes }: StoragePolicyInput['overrides']) => ({
  maxFileBytes: String(maxFileBytes ?? ''),
  chunkBytes: String(chunkBytes ?? ''),
});

function PolicyCards({
  initial,
  labels,
  refresh,
}: {
  initial: StoragePolicy;
  labels: typeof zh;
  refresh: () => void;
}) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const [view, setView] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial.overrides));
  const [usage, setUsage] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [conflict, setConflict] = useState(false);
  const current = toDraft(view.overrides);
  const invalid = fields.filter((key) => {
    const raw = draft[key];
    return (
      raw !== '' && (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > view.defaults[key])
    );
  });
  const canSave =
    view.canSave &&
    !conflict &&
    invalid.length === 0 &&
    fields.some((key) => draft[key] !== current[key]);
  const save = async () => {
    const overrides: StoragePolicyInput['overrides'] = {};
    for (const key of fields) {
      if (draft[key] !== '') overrides[key] = Number(draft[key]);
    }
    try {
      const saved = await files.saveStoragePolicy({ revision: view.revision, overrides });
      setView(saved);
      setDraft(toDraft(saved.overrides));
    } catch (error) {
      setConflict(error instanceof FilesError && error.code === 'conflict');
      throw error;
    }
  };
  return (
    <>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Panel className="min-w-0 space-y-4 p-4" appearance="outlined" aria-label={labels.current}>
          <h2 className="font-semibold">{labels.current}</h2>
          <p>{labels.backends[view.backend]}</p>
          <h3 className="font-semibold">{labels.metrics}</h3>
          <p className="text-sm text-ink-muted">{labels.scope}</p>
          {usage ? (
            <UsageSnapshot labels={labels} />
          ) : (
            <Action variant="secondary" onPress={() => setUsage(true)}>
              {labels.load}
            </Action>
          )}
        </Panel>
        <Panel className="min-w-0 space-y-4 p-4" appearance="outlined" aria-label={labels.upload}>
          <h2 className="font-semibold">{labels.upload}</h2>
          <p role="status" className="text-sm text-ink-muted">
            {view.pendingRestart ? labels.pending : labels.applied}
          </p>
          {!view.canSave ? <p>{labels.readonly}</p> : null}
          {conflict ? <p role="alert">{labels.conflict}</p> : null}
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canSave) setConfirm(true);
            }}
          >
            {fields.map((key) => (
              <TextField
                key={key}
                label={labels[key]}
                hint={labels.values(
                  formatFileBytes(view.active[key]),
                  formatFileBytes(view.configured[key]),
                  formatFileBytes(view.defaults[key]),
                )}
                placeholder={labels.inherit}
                value={draft[key]}
                maxLength={12}
                inputMode="numeric"
                disabled={!view.canSave || conflict}
                {...(invalid.includes(key) ? { error: labels.range(view.defaults[key]) } : {})}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              />
            ))}
            {view.canSave ? (
              <Action type="submit" disabled={!canSave}>
                {labels.save}
              </Action>
            ) : null}
          </form>
        </Panel>
      </div>
      {confirm ? (
        <DialogSurface
          isOpen
          title={labels.confirm}
          triggerLabel={labels.confirm}
          description={labels.confirmHint}
          confirmLabel={labels.save}
          confirmDisabled={!canSave}
          failureMessage={conflict ? labels.conflict : labels.failure}
          cancelLabel={t('files.cancel')}
          onConfirm={save}
          onOpenChange={(open) => setConfirm(open)}
        >
          {conflict ? (
            <Action variant="secondary" onPress={refresh}>
              {t('files.refresh')}
            </Action>
          ) : (
            <ul className="space-y-2 text-sm">
              {fields.map((key) => (
                <li key={key}>
                  {labels[key]} ·{' '}
                  {draft[key] === '' ? labels.inherit : formatFileBytes(Number(draft[key]))}
                </li>
              ))}
            </ul>
          )}
        </DialogSurface>
      ) : null}
    </>
  );
}

export function StoragePolicyPage() {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const policy = useCatalogRequest(
    useCallback((signal) => files.readStoragePolicy(signal), [files]),
  );
  return (
    <Page>
      <PageHeader
        title={t('systemTools.nav.storage')}
        description={labels.description}
        actions={
          <Action variant="secondary" onPress={policy.refresh}>
            {t('files.refresh')}
          </Action>
        }
      />
      {!policy.result ? <p role="status">{t('administration.loading')}</p> : null}
      {policy.result && 'error' in policy.result ? (
        <CatalogFailure error={policy.result.error} retry={policy.refresh} />
      ) : null}
      {policy.result && 'value' in policy.result ? (
        <>
          <PolicyCards initial={policy.result.value} labels={labels} refresh={policy.refresh} />
          <StorageNameRulesPanel />
        </>
      ) : null}
    </Page>
  );
}
