'use client';

import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { Panel } from '@clouddrive/ui-adapter/panel';
import {
  fileApplicationName,
  type FileApplicationDefault,
  type FileApplicationItem,
  type FileApplicationView,
} from '../../../src/files/file-applications';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';

const zh = {
  catalog: '应用列表',
  explanation: '选择内置应用的可用平台。此设置应用于本人文件的打开方式。',
  app: '应用',
  extensions: '扩展名',
  platform: '平台',
  all: '全平台',
  desktop: '桌面端',
  mobile: '移动端',
  enabled: '启用',
  enabledApp: (name: string) => `启用 ${name}`,
  defaultTitle: '默认打开方式',
  defaultHint: '扩展名关联多个可用应用时，可指定默认项。用户仍可从文件菜单另选应用。',
  defaultFor: (extension: string) => `.${extension} 的默认应用`,
  removeDefault: (extension: string) => `移除 .${extension} 的默认打开方式`,
  empty: '暂无默认打开方式。',
  add: '添加默认规则',
  save: '保存文件应用',
  reset: '恢复内置策略',
  saved: '文件应用设置已保存。',
  readonly: '当前账号只有查看权限。',
  conflict: '其他管理员已保存新的文件应用设置。请刷新后再编辑。',
};
const en: typeof zh = {
  catalog: 'Applications',
  explanation: 'Set where built-in applications are available when users open their files.',
  app: 'Application',
  extensions: 'Extensions',
  platform: 'Platform',
  all: 'All platforms',
  desktop: 'Desktop',
  mobile: 'Mobile',
  enabled: 'Enabled',
  enabledApp: (name) => `Enable ${name}`,
  defaultTitle: 'Default applications',
  defaultHint:
    'Set a default when an extension has several viewers. Users can still pick a viewer from the file menu.',
  defaultFor: (extension) => `Default for .${extension}`,
  removeDefault: (extension) => `Remove default for .${extension}`,
  empty: 'No default applications are set.',
  add: 'Add default',
  save: 'Save file applications',
  reset: 'Restore built-in policy',
  saved: 'File application settings saved.',
  readonly: 'This account has read-only access.',
  conflict: 'Another administrator saved new settings. Refresh before editing again.',
};

function FileApplicationsForm({
  initial,
  refresh,
  chinese,
}: {
  initial: FileApplicationView;
  refresh: () => void;
  chinese: boolean;
}) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const labels = chinese ? zh : en;
  const [view, setView] = useState(initial);
  const [items, setItems] = useState(initial.items);
  const [defaults, setDefaults] = useState(initial.defaults);
  const [extension, setExtension] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const locked = !view.canSave || saving || conflict;
  const modified =
    JSON.stringify(items) !== JSON.stringify(view.items) ||
    JSON.stringify(defaults) !== JSON.stringify(view.defaults);
  const enabledFor = (suffix: string) =>
    items.filter((item) => item.enabled && item.extensions.includes(suffix));
  const available = [...new Set(items.flatMap((item) => item.extensions))]
    .filter(
      (suffix) =>
        enabledFor(suffix).length > 1 && !defaults.some((rule) => rule.extension === suffix),
    )
    .sort();
  const platforms = (['all', 'desktop', 'mobile'] as const).map((value) => ({
    value,
    label: labels[value],
  }));

  function changeItem(item: FileApplicationItem) {
    setItems((current) =>
      current.map((candidate) => (candidate.id === item.id ? item : candidate)),
    );
    if (!item.enabled) setDefaults((current) => current.filter((rule) => rule.app !== item.id));
    setSaved(false);
  }

  function changeDefaults(next: FileApplicationDefault[]) {
    setDefaults(next);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const next = await files.saveFileApplications({
        revision: view.revision,
        apps: items.flatMap(({ id, enabled, platform }) =>
          enabled && platform === 'all' ? [] : [{ id, enabled, platform }],
        ),
        defaults,
      });
      setView(next);
      setItems(next.items);
      setDefaults(next.defaults);
      setSaved(true);
    } catch (cause) {
      const code = cause instanceof FilesError ? cause.code : 'unavailable';
      setConflict(code === 'conflict');
      setError(code === 'conflict' ? labels.conflict : t(`files.errors.${code}`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <Panel className="min-w-0 space-y-3 p-3">
        <div>
          <h2 className="text-lg font-semibold">{labels.catalog}</h2>
          <p className="text-sm text-ink-muted">{labels.explanation}</p>
        </div>
        <div className="overflow-auto">
          <table
            className="w-full text-sm"
            style={{ minWidth: '36rem' }}
            aria-label={labels.catalog}
          >
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="p-2" scope="col">
                  {labels.app}
                </th>
                <th className="p-2" scope="col">
                  {labels.extensions}
                </th>
                <th className="p-2" scope="col">
                  {labels.platform}
                </th>
                <th className="p-2" scope="col">
                  {labels.enabled}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const name = fileApplicationName(item.id, chinese);
                return (
                  <tr key={item.id} className="border-b border-border">
                    <th className="p-2 text-left" scope="row">
                      {name}
                    </th>
                    <td className="p-2 text-ink-muted">
                      {item.extensions.map((suffix) => `.${suffix}`).join(', ')}
                    </td>
                    <td className="p-2" style={{ minWidth: '9rem' }}>
                      <SelectField
                        label={labels.platform}
                        value={item.platform}
                        options={platforms}
                        disabled={locked || !item.enabled}
                        onValueChange={(value) => {
                          if (value === 'all' || value === 'desktop' || value === 'mobile')
                            changeItem({ ...item, platform: value });
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <CheckboxField
                        label={labels.enabledApp(name)}
                        checked={item.enabled}
                        presentation="control-only"
                        disabled={locked}
                        onCheckedChange={(enabled) => changeItem({ ...item, enabled })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel className="min-w-0 space-y-3 p-3">
        <div>
          <h2 className="text-lg font-semibold">{labels.defaultTitle}</h2>
          <p className="text-sm text-ink-muted">{labels.defaultHint}</p>
        </div>
        <div className="space-y-4">
          {defaults.length === 0 ? <p>{labels.empty}</p> : null}
          {defaults.map((rule) => (
            <div className="flex flex-wrap items-end gap-2" key={rule.extension}>
              <SelectField
                label={labels.defaultFor(rule.extension)}
                value={rule.app}
                disabled={locked}
                options={enabledFor(rule.extension).map((item) => ({
                  value: item.id,
                  label: fileApplicationName(item.id, chinese),
                }))}
                onValueChange={(id) => {
                  const item = enabledFor(rule.extension).find((candidate) => candidate.id === id);
                  if (item)
                    changeDefaults(
                      defaults.map((current) =>
                        current === rule ? { ...rule, app: item.id } : current,
                      ),
                    );
                }}
              />
              <Action
                size="sm"
                variant="secondary"
                disabled={locked}
                onPress={() => changeDefaults(defaults.filter((current) => current !== rule))}
              >
                {labels.removeDefault(rule.extension)}
              </Action>
            </div>
          ))}
          {available.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <SelectField
                label={labels.extensions}
                value={available.includes(extension) ? extension : ''}
                options={available.map((suffix) => ({ label: `.${suffix}`, value: suffix }))}
                disabled={locked}
                onValueChange={setExtension}
              />
              <Action
                size="sm"
                variant="secondary"
                disabled={locked || !available.includes(extension)}
                onPress={() => {
                  const app = enabledFor(extension)[0];
                  if (app) {
                    changeDefaults([...defaults, { extension, app: app.id }]);
                    setExtension('');
                  }
                }}
              >
                {labels.add}
              </Action>
            </div>
          ) : null}
        </div>
      </Panel>
      {!view.canSave ? <p>{labels.readonly}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? <p role="status">{labels.saved}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Action variant="secondary" onPress={refresh} disabled={saving}>
          {t('files.refresh')}
        </Action>
        <Action
          variant="secondary"
          disabled={locked}
          onPress={() => {
            setItems(items.map((item) => ({ ...item, enabled: true, platform: 'all' })));
            changeDefaults(view.builtInDefaults);
            setError('');
          }}
        >
          {labels.reset}
        </Action>
        <Action disabled={locked || !modified} loading={saving} onPress={() => void save()}>
          {labels.save}
        </Action>
      </div>
    </div>
  );
}

export function FileApplicationsPanel() {
  const files = useFiles();
  const { locale, t } = useFrontendTranslation();
  const request = useCatalogRequest(
    useCallback((signal) => files.readFileApplications(signal), [files]),
  );
  if (!request.result) return <p role="status">{t('administration.loading')}</p>;
  if ('error' in request.result)
    return <CatalogFailure error={request.result.error} retry={request.refresh} />;
  return (
    <FileApplicationsForm
      initial={request.result.value}
      refresh={request.refresh}
      chinese={locale.startsWith('zh')}
    />
  );
}
