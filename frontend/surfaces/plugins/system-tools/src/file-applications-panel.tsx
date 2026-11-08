'use client';

import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextAreaField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import {
  fileApplicationName,
  maxWebFileApplications,
  maxFileApplicationExtensions,
  parseFileApplicationExtensions,
  type FileApplicationDefault,
  type FileApplicationID,
  type FileApplicationItem,
  type FileApplicationView,
  type WebFileApplication,
} from '../../../src/files/file-applications';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';
import { FileCreationMappingsDialog } from './file-creation-mappings-dialog';
import { WebFileApplicationDialog } from './web-file-application-dialog';

const zh = {
  catalog: '应用列表',
  explanation: '设置本人文件的内置和网页应用。',
  addWeb: '添加网页应用',
  editWeb: (name: string) => `编辑 ${name}`,
  removeWeb: (name: string) => `移除 ${name}`,
  webKind: '网页应用',
  app: '应用',
  extensions: '扩展名',
  inheritedExtensions: '内置关联',
  customExtensions: '自定义关联',
  noExtensions: '无关联扩展名',
  editExtensions: '编辑扩展名',
  extensionTitle: (name: string) => `${name}的扩展名`,
  restoreExtensions: '恢复内置扩展名',
  extensionHint: `可用逗号或空格分隔，最多 ${maxFileApplicationExtensions} 项。清空后该应用无关联扩展名。`,
  extensionErrors: {
    count: '扩展名数量超出限制。',
    format: '请检查扩展名格式。',
    duplicate: '同一应用的扩展名不能重复。',
  },
  removedDefaults: '已从草稿移除不再适用的默认打开方式。',
  applyExtensions: '应用到草稿',
  platform: '平台',
  newFiles: '新建文件映射',
  mappingCount: (count: number) => `${count} 个`,
  mappingUnavailable: '不适用',
  editMappings: '编辑映射',
  restoreMappings: '恢复内置映射',
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
  explanation: 'Manage built-in and web applications for personal files.',
  addWeb: 'Add web application',
  editWeb: (name) => `Edit ${name}`,
  removeWeb: (name) => `Remove ${name}`,
  webKind: 'Web application',
  app: 'Application',
  extensions: 'Extensions',
  inheritedExtensions: 'Built-in associations',
  customExtensions: 'Custom associations',
  noExtensions: 'No associated extensions',
  editExtensions: 'Edit extensions',
  extensionTitle: (name) => `${name} extensions`,
  restoreExtensions: 'Restore built-in extensions',
  extensionHint: `Separate up to ${maxFileApplicationExtensions} entries with commas or spaces. Clear the list to remove all associations for this application.`,
  extensionErrors: {
    count: 'Too many extensions.',
    format: 'Check the extension format.',
    duplicate: 'An extension can appear only once per application.',
  },
  removedDefaults: 'Default applications that no longer apply have been removed from the draft.',
  applyExtensions: 'Apply to draft',
  platform: 'Platform',
  newFiles: 'New-file mappings',
  mappingCount: (count) => `${count} mappings`,
  mappingUnavailable: 'Unavailable',
  editMappings: 'Edit mappings',
  restoreMappings: 'Restore built-in mappings',
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
  const [webApps, setWebApps] = useState(initial.webApps);
  const [webEdit, setWebEdit] = useState<WebFileApplication | 'new'>();
  const [defaults, setDefaults] = useState(initial.defaults);
  const [extension, setExtension] = useState('');
  const [extensionEdit, setExtensionEdit] = useState<{ id: FileApplicationID; value: string }>();
  const [mappingID, setMappingID] = useState<FileApplicationID>();
  const [removedDefaults, setRemovedDefaults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const locked = !view.canSave || saving || conflict;
  const editedItem = items.find((item) => item.id === extensionEdit?.id);
  const mappingItem = items.find((item) => item.id === mappingID);
  const parsedExtensions = extensionEdit && parseFileApplicationExtensions(extensionEdit.value);
  const modified =
    JSON.stringify(items) !== JSON.stringify(view.items) ||
    JSON.stringify(webApps) !== JSON.stringify(view.webApps) ||
    JSON.stringify(defaults) !== JSON.stringify(view.defaults);
  const applications = [...items, ...webApps];
  const enabledFor = (suffix: string) =>
    applications.filter((item) => item.enabled && item.extensions.includes(suffix));
  const available = [...new Set(applications.flatMap((item) => item.extensions))]
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
    const mappings = item.customNewFiles
      ? item.newFiles
      : (view.builtInItems.find((candidate) => candidate.id === item.id)?.newFiles ?? []);
    item = {
      ...item,
      newFiles: mappings.filter((mapping) => item.extensions.includes(mapping.extension)),
    };
    const next = items.map((candidate) => (candidate.id === item.id ? item : candidate));
    setItems(next);
    reconcileDefaults([...next, ...webApps]);
  }

  function reconcileDefaults(next: typeof applications) {
    const valid = defaults.filter((rule) => {
      const associated = next.filter((candidate) => candidate.extensions.includes(rule.extension));
      return (
        associated.length > 1 &&
        associated.some((candidate) => candidate.id === rule.app && candidate.enabled)
      );
    });
    if (valid.length !== defaults.length) {
      setDefaults(valid);
      setRemovedDefaults(true);
    }
    setSaved(false);
  }

  function changeWebApps(next: WebFileApplication[]) {
    setWebApps(next);
    reconcileDefaults([...items, ...next]);
  }

  function applyWebApp(app: WebFileApplication) {
    changeWebApps(
      webEdit === 'new'
        ? [...webApps, app]
        : webApps.map((candidate) => (candidate.id === app.id ? app : candidate)),
    );
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
        apps: items.flatMap(
          ({ id, enabled, platform, customExtensions, extensions, customNewFiles, newFiles }) =>
            enabled && platform === 'all' && !customExtensions && !customNewFiles
              ? []
              : [
                  {
                    id,
                    enabled,
                    platform,
                    ...(customExtensions ? { extensions } : {}),
                    ...(customNewFiles ? { newFiles } : {}),
                  },
                ],
        ),
        defaults,
        webApps: webApps.map((app) => {
          const input = { ...app };
          delete input.origin;
          return input;
        }),
      });
      setView(next);
      setItems(next.items);
      setWebApps(next.webApps);
      setDefaults(next.defaults);
      setRemovedDefaults(false);
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
        <Action
          variant="secondary"
          size="sm"
          disabled={locked || webApps.length >= maxWebFileApplications}
          onPress={() => setWebEdit('new')}
        >
          {labels.addWeb}
        </Action>
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
                  {labels.newFiles}
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
                      <p>
                        {item.extensions.map((suffix) => `.${suffix}`).join(', ') ||
                          labels.noExtensions}
                      </p>
                      <p className="text-xs">
                        {item.customExtensions
                          ? labels.customExtensions
                          : labels.inheritedExtensions}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Action
                          size="sm"
                          variant="quiet"
                          disabled={locked}
                          onPress={() =>
                            setExtensionEdit({ id: item.id, value: item.extensions.join(', ') })
                          }
                        >
                          {labels.editExtensions}
                        </Action>
                        {item.customExtensions ? (
                          <Action
                            size="sm"
                            variant="quiet"
                            disabled={locked}
                            onPress={() => {
                              const builtIn = view.builtInItems.find(
                                (candidate) => candidate.id === item.id,
                              );
                              if (builtIn)
                                changeItem({
                                  ...item,
                                  extensions: builtIn.extensions,
                                  customExtensions: false,
                                });
                            }}
                          >
                            {labels.restoreExtensions}
                          </Action>
                        ) : null}
                      </div>
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
                      {item.canCreate ? (
                        <>
                          <p>{labels.mappingCount(item.newFiles.length)}</p>
                          <div className="flex flex-wrap gap-2">
                            <Action
                              size="sm"
                              variant="quiet"
                              disabled={locked}
                              onPress={() => setMappingID(item.id)}
                            >
                              {labels.editMappings}
                            </Action>
                            {item.customNewFiles ? (
                              <Action
                                size="sm"
                                variant="quiet"
                                disabled={locked}
                                onPress={() => changeItem({ ...item, customNewFiles: false })}
                              >
                                {labels.restoreMappings}
                              </Action>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <p>{labels.mappingUnavailable}</p>
                      )}
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
              {webApps.map((app) => (
                <tr key={app.id} className="border-b border-border">
                  <th className="p-2 text-left" scope="row">
                    <div className="flex items-center gap-2">
                      {app.iconUrl ? (
                        <img
                          src={app.iconUrl}
                          alt=""
                          width={20}
                          height={20}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      {app.name}
                    </div>
                    <p className="text-xs text-ink-muted">{labels.webKind}</p>
                  </th>
                  <td className="p-2 text-ink-muted">
                    <p>{app.extensions.map((suffix) => `.${suffix}`).join(', ')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Action
                        variant="quiet"
                        size="sm"
                        disabled={locked}
                        onPress={() => setWebEdit(app)}
                      >
                        {labels.editWeb(app.name)}
                      </Action>
                      <Action
                        variant="quiet"
                        size="sm"
                        disabled={locked}
                        onPress={() =>
                          changeWebApps(webApps.filter((candidate) => candidate.id !== app.id))
                        }
                      >
                        {labels.removeWeb(app.name)}
                      </Action>
                    </div>
                  </td>
                  <td className="p-2">{labels[app.platform]}</td>
                  <td className="p-2">{labels.mappingUnavailable}</td>
                  <td className="p-2">
                    <CheckboxField
                      label={labels.enabledApp(app.name)}
                      checked={app.enabled}
                      presentation="control-only"
                      disabled={locked}
                      onCheckedChange={(enabled) =>
                        changeWebApps(
                          webApps.map((candidate) =>
                            candidate.id === app.id ? { ...app, enabled } : candidate,
                          ),
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel className="min-w-0 space-y-3 p-3" aria-label={labels.defaultTitle}>
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
                  label: 'name' in item ? item.name : fileApplicationName(item.id, chinese),
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
      {removedDefaults ? <p role="status">{labels.removedDefaults}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Action variant="secondary" onPress={refresh} disabled={saving}>
          {t('files.refresh')}
        </Action>
        <Action
          variant="secondary"
          disabled={locked}
          onPress={() => {
            setItems(view.builtInItems);
            changeDefaults(view.builtInDefaults);
            setRemovedDefaults(false);
            setError('');
          }}
        >
          {labels.reset}
        </Action>
        <Action disabled={locked || !modified} loading={saving} onPress={() => void save()}>
          {labels.save}
        </Action>
      </div>
      {mappingItem ? (
        <FileCreationMappingsDialog
          item={mappingItem}
          onClose={() => setMappingID(undefined)}
          onApply={(newFiles) => changeItem({ ...mappingItem, newFiles, customNewFiles: true })}
        />
      ) : null}
      {webEdit ? (
        <WebFileApplicationDialog
          application={webEdit === 'new' ? undefined : webEdit}
          platforms={platforms}
          onClose={() => setWebEdit(undefined)}
          onApply={applyWebApp}
        />
      ) : null}
      {editedItem && extensionEdit && parsedExtensions ? (
        <DialogSurface
          isOpen
          triggerLabel={labels.editExtensions}
          title={labels.extensionTitle(fileApplicationName(editedItem.id, chinese))}
          description={labels.extensionHint}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.applyExtensions}
          confirmDisabled={'error' in parsedExtensions}
          onOpenChange={(open) => {
            if (!open) setExtensionEdit(undefined);
          }}
          onConfirm={() => {
            if ('extensions' in parsedExtensions)
              changeItem({
                ...editedItem,
                extensions: parsedExtensions.extensions,
                customExtensions: true,
              });
          }}
        >
          <TextAreaField
            label={labels.extensions}
            value={extensionEdit.value}
            rows={4}
            {...('error' in parsedExtensions
              ? { error: labels.extensionErrors[parsedExtensions.error] }
              : {})}
            onChange={(event) => setExtensionEdit({ ...extensionEdit, value: event.target.value })}
          />
        </DialogSurface>
      ) : null}
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
