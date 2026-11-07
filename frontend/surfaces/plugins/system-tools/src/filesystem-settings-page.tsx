'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, SectionBody } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { TabsView } from '@clouddrive/ui-adapter/data-display';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import type {
  FilesystemSettings,
  FilesystemSettingsInput,
} from '../../../src/files/filesystem-settings';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { CatalogFailure } from './catalog-failure';
import { PropertyDefinitionsPanel } from './property-definitions-panel';
import { useCatalogRequest } from './use-catalog-request';

const groups = [
  ['paginationGroup', ['pagination', 'maxPageSize']],
  ['files', ['textBytes', 'batchEntries']],
  ['versions', ['historyEnabled', 'historyPerFile']],
  ['reclamation', ['trashScanSeconds', 'blobScanSeconds', 'automaticBlob']],
] as const;
type Field = (typeof groups)[number][1][number];
const fields = groups.flatMap(([, keys]) => [...keys]);
const numericFields = [
  'maxPageSize',
  'textBytes',
  'batchEntries',
  'historyPerFile',
  'trashScanSeconds',
  'blobScanSeconds',
] as const;
const booleanFields = ['historyEnabled', 'automaticBlob'] as const;
type NumberField = (typeof numericFields)[number];
type Draft = Record<Field, string>;

const zh = {
  description: '管理文件操作、版本和存储回收参数。保存的变更在服务重启后生效。',
  files: '文件操作',
  paginationGroup: '文件列表',
  pagination: '文件列表分页方式',
  maxPageSize: '最大分页大小（项）',
  numbered: '页码分页',
  cursor: '游标分页',
  searchPagination: '文件搜索和高级筛选使用游标分页。',
  versions: '历史版本',
  reclamation: '回收任务',
  textBytes: '在线文本大小上限（字节）',
  batchEntries: '批量文件操作上限（项）',
  historyEnabled: '保留后续历史版本',
  historyPerFile: '每个文件的历史版本上限',
  trashScanSeconds: '回收站扫描间隔（秒）',
  blobScanSeconds: '文件 Blob 回收间隔（秒）',
  automaticBlob: '自动回收文件 Blob',
  inherit: '继承部署值',
  enabled: '开启',
  disabled: '关闭',
  pending: '已保存的参数等待服务重启。',
  current: '已保存的参数当前生效。',
  saved: '参数已保存。',
  readonly: '当前账号只有查看权限。',
  trashUnavailable: '回收站任务已由部署配置禁用。',
  blobUnavailable: 'Blob 回收任务已由部署配置禁用。',
  values: (active: string, fallback: string, next: string) =>
    `当前 ${active} · 部署 ${fallback} · 已保存 ${next}`,
  range: (min: number, max: number) => `请输入 ${min} 至 ${max} 之间的整数，或留空以继承。`,
  reset: '全部恢复继承',
  save: '保存参数',
  confirm: '确认保存文件系统参数',
  confirmHint: '保存不会重启服务。新应用实例会统一应用参数。',
  autoHint: '开启自动回收后，超过保护期且失去全部引用的对象将按计划永久清理。',
  failure: '保存失败。请核对输入或稍后重试。',
  conflict: '其他管理员已保存新的参数。请刷新后重新编辑。',
};
const en: typeof zh = {
  description:
    'Manage file operations, versions, and reclamation. Saved changes take effect after restart.',
  files: 'File operations',
  paginationGroup: 'File listing',
  pagination: 'File list pagination',
  maxPageSize: 'Maximum page size (items)',
  numbered: 'Numbered pages',
  cursor: 'Cursor pages',
  searchPagination: 'File search and advanced filters use cursor pagination.',
  versions: 'Version history',
  reclamation: 'Reclamation tasks',
  textBytes: 'Online text limit (bytes)',
  batchEntries: 'Batch file limit (items)',
  historyEnabled: 'Keep future file versions',
  historyPerFile: 'Historical versions per file',
  trashScanSeconds: 'Trash scan interval (seconds)',
  blobScanSeconds: 'Blob reclamation interval (seconds)',
  automaticBlob: 'Automatically reclaim blobs',
  inherit: 'Inherit deployment value',
  enabled: 'On',
  disabled: 'Off',
  pending: 'Saved settings are waiting for a restart.',
  current: 'Saved settings are currently active.',
  saved: 'Settings saved.',
  readonly: 'Your account has read-only access.',
  trashUnavailable: 'Trash scanning is disabled in the deployment configuration.',
  blobUnavailable: 'Blob reclamation is disabled in the deployment configuration.',
  values: (active, fallback, next) => `Active ${active} · Deployment ${fallback} · Saved ${next}`,
  range: (min, max) => `Enter an integer from ${min} to ${max}, or leave blank to inherit.`,
  reset: 'Inherit all deployment values',
  save: 'Save settings',
  confirm: 'Confirm file system settings',
  confirmHint:
    'Saving does not restart the service. A new application instance applies the settings together.',
  autoHint:
    'Automatic reclamation permanently removes unreferenced objects once the grace period has elapsed.',
  failure: 'Could not save the settings. Check the values and try again.',
  conflict: 'Another administrator saved new settings. Refresh before editing again.',
};

function toDraft(overrides: FilesystemSettingsInput['overrides']): Draft {
  return Object.fromEntries(
    fields.map((field) => [field, String(overrides[field] ?? '')]),
  ) as Draft;
}

function numberBounds(field: NumberField, defaults: FilesystemSettings['defaults']) {
  return field === 'trashScanSeconds' || field === 'blobScanSeconds'
    ? { min: 60, max: 86400 }
    : { min: 1, max: defaults[field] };
}

function FilesystemSettingsForm({
  initial,
  refresh,
  labels,
}: {
  initial: FilesystemSettings;
  refresh: () => void;
  labels: typeof zh;
}) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const [view, setView] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial.overrides));
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conflict, setConflict] = useState(false);
  const currentDraft = toDraft(view.overrides);
  const dirty = fields.some((key) => draft[key] !== currentDraft[key]);
  const invalidFields = numericFields.filter((key) => {
    const raw = draft[key];
    const { min, max } = numberBounds(key, view.defaults);
    return raw !== '' && (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max);
  });
  const canSubmit = view.canSave && dirty && invalidFields.length === 0 && !conflict;

  const save = async () => {
    const overrides: FilesystemSettingsInput['overrides'] = {};
    if (draft.pagination === 'cursor' || draft.pagination === 'numbered')
      overrides.pagination = draft.pagination;
    for (const key of numericFields) {
      if (draft[key] !== '') overrides[key] = Number(draft[key]);
    }
    for (const key of booleanFields) {
      if (draft[key] !== '') overrides[key] = draft[key] === 'true';
    }
    try {
      const updated = await files.saveFilesystemSettings({ revision: view.revision, overrides });
      setView(updated);
      setDraft(toDraft(updated.overrides));
      setSaved(true);
    } catch (error) {
      setConflict(error instanceof FilesError && error.code === 'conflict');
      throw error;
    }
  };

  const display = (value: FilesystemSettings['active'][Field]) => {
    if (typeof value === 'string') return labels[value];
    if (typeof value === 'number') return String(value);
    return value ? labels.enabled : labels.disabled;
  };
  return (
    <>
      <p role="status" className="text-sm text-ink-muted">
        {saved ? `${labels.saved} ` : ''}
        {view.pendingRestart ? labels.pending : labels.current}
      </p>
      {!view.canSave ? <p>{labels.readonly}</p> : null}
      {conflict ? <p role="alert">{labels.conflict}</p> : null}
      <form
        className="min-w-0 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) setConfirm(true);
        }}
      >
        {groups.map(([title, keys]) => (
          <Panel key={title} className="surface-route-region">
            <SectionBody>
              <div className="min-w-0 max-w-md space-y-4">
                <h2 className="text-lg font-semibold">{labels[title]}</h2>
                {title === 'paginationGroup' ? (
                  <p className="text-sm text-ink-muted">{labels.searchPagination}</p>
                ) : null}
                {title === 'reclamation' && !view.trashSchedulerAvailable ? (
                  <p className="text-sm text-ink-muted">{labels.trashUnavailable}</p>
                ) : null}
                {title === 'reclamation' && !view.blobSchedulerAvailable ? (
                  <p className="text-sm text-ink-muted">{labels.blobUnavailable}</p>
                ) : null}
                {keys.map((key) => {
                  const hint = labels.values(
                    display(view.active[key]),
                    display(view.defaults[key]),
                    display(view.configured[key]),
                  );
                  const update = (value: string) => {
                    setSaved(false);
                    setDraft({ ...draft, [key]: value });
                  };
                  if (key === 'pagination') {
                    return (
                      <SelectField
                        key={key}
                        label={labels[key]}
                        hint={hint}
                        value={draft[key] || 'inherit'}
                        disabled={!view.canSave}
                        options={[
                          { value: 'inherit', label: labels.inherit },
                          { value: 'numbered', label: labels.numbered },
                          { value: 'cursor', label: labels.cursor },
                        ]}
                        onValueChange={(value) => update(value === 'inherit' ? '' : value)}
                      />
                    );
                  }
                  if (key === 'historyEnabled' || key === 'automaticBlob') {
                    return (
                      <SelectField
                        key={key}
                        label={labels[key]}
                        hint={hint}
                        value={draft[key] || 'inherit'}
                        disabled={!view.canSave}
                        options={[
                          { value: 'inherit', label: labels.inherit },
                          {
                            value: 'true',
                            label: labels.enabled,
                            disabled: key === 'historyEnabled' && !view.defaults.historyEnabled,
                          },
                          { value: 'false', label: labels.disabled },
                        ]}
                        onValueChange={(value) => update(value === 'inherit' ? '' : value)}
                      />
                    );
                  }
                  const { min, max } = numberBounds(key, view.defaults);
                  return (
                    <TextField
                      key={key}
                      label={labels[key]}
                      hint={hint}
                      inputMode="numeric"
                      value={draft[key]}
                      disabled={!view.canSave}
                      maxLength={12}
                      placeholder={labels.inherit}
                      {...(invalidFields.includes(key) ? { error: labels.range(min, max) } : {})}
                      onChange={(event) => update(event.target.value)}
                    />
                  );
                })}
              </div>
            </SectionBody>
          </Panel>
        ))}
        {view.canSave ? (
          <div className="flex flex-wrap gap-2">
            <Action type="submit" disabled={!canSubmit}>
              {labels.save}
            </Action>
            <Action
              variant="secondary"
              onPress={() => {
                setSaved(false);
                setDraft(toDraft({}));
              }}
            >
              {labels.reset}
            </Action>
          </div>
        ) : null}
      </form>
      {confirm ? (
        <DialogSurface
          isOpen
          triggerLabel={labels.confirm}
          title={labels.confirm}
          description={labels.confirmHint}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.save}
          confirmDisabled={conflict}
          failureMessage={conflict ? labels.conflict : labels.failure}
          onOpenChange={(open) => {
            if (!open) setConfirm(false);
          }}
          onConfirm={save}
        >
          {draft.automaticBlob === 'true' ||
          (draft.automaticBlob === '' && view.defaults.automaticBlob) ? (
            <p>{labels.autoHint}</p>
          ) : null}
          {conflict ? (
            <Action variant="secondary" onPress={refresh}>
              {t('files.refresh')}
            </Action>
          ) : null}
        </DialogSurface>
      ) : null}
    </>
  );
}

function FilesystemSettingsBody() {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const state = useCatalogRequest(
    useCallback((signal) => files.readFilesystemSettings(signal), [files]),
  );
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <p>{labels.description}</p>
        <Action variant="secondary" onPress={state.refresh}>
          {t('files.refresh')}
        </Action>
      </div>
      {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
      {state.result && 'error' in state.result ? (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      ) : null}
      {state.result && 'value' in state.result ? (
        <FilesystemSettingsForm
          initial={state.result.value}
          refresh={state.refresh}
          labels={labels}
        />
      ) : null}
    </div>
  );
}

export function FilesystemSettingsPage() {
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const title = t('systemTools.nav.filesystem');
  return (
    <Page>
      <PageHeader
        title={title}
        description={
          chinese
            ? '管理文件系统参数与全局属性。'
            : 'Manage file system settings and global properties.'
        }
      />
      <TabsView
        label={title}
        items={[
          {
            id: 'parameters',
            label: chinese ? '参数设置' : 'Settings',
            content: <FilesystemSettingsBody />,
          },
          {
            id: 'properties',
            label: chinese ? '自定义属性' : 'Custom properties',
            content: <PropertyDefinitionsPanel />,
          },
        ]}
      />
    </Page>
  );
}
