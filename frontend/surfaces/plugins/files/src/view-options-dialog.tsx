'use client';
import { useState, type SetStateAction } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { CheckboxField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Action } from '@clouddrive/ui-adapter/action';
import { FilesError } from '../../../src/files/model';
import {
  changeFileView,
  resolveFileView,
  type FilePreferenceSnapshot,
  type FilePreferences,
} from '../../../src/files/preferences';
import {
  fileColumnKeys,
  filePageSizes,
  type FileViewPreferences,
} from '../../../src/files/view-options';

export function ViewOptionsDialog({
  preferences,
  maxPageSize,
  snapshot,
  parentId,
  busy,
  failure,
  onLoadServer,
  onClose,
  onSave,
}: {
  preferences: FileViewPreferences;
  maxPageSize: number | undefined;
  snapshot: FilePreferenceSnapshot;
  parentId: string | undefined;
  busy: boolean;
  failure: string;
  onLoadServer: () => Promise<void>;
  onClose: () => void;
  onSave: (value: FilePreferenceSnapshot) => Promise<boolean>;
}) {
  const { t, locale } = useFrontendTranslation(),
    [draft, setDraftValue] = useState(preferences),
    [settings, setSettings] = useState(snapshot),
    [saveCurrent, setSaveCurrent] = useState(true),
    [validationFailure, setValidationFailure] = useState(''),
    [saveFailed, setSaveFailed] = useState(false);
  const setDraft = (update: SetStateAction<FileViewPreferences>) => {
    setSaveCurrent(true);
    setDraftValue(update);
  };
  return (
    <DialogSurface
      triggerLabel={t('files.discovery.viewOptions')}
      title={t('files.discovery.viewOptions')}
      description={t('files.discovery.viewHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.save')}
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      confirmDisabled={busy}
      failureMessage={failure || validationFailure}
      onConfirm={async () => {
        setValidationFailure('');
        setSaveFailed(false);
        let document: FilePreferences;
        try {
          document = saveCurrent
            ? changeFileView(settings.configuration, draft, parentId)
            : settings.configuration;
        } catch (error) {
          setValidationFailure(t('files.preferences.limit'));
          setSaveFailed(true);
          throw error;
        }
        if (!(await onSave({ ...settings, configuration: document }))) {
          setSaveFailed(true);
          throw new FilesError('unavailable');
        }
      }}
    >
      <div className="space-y-5">
        {failure && !saveFailed ? (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        ) : null}
        {busy ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('files.preferences.saving')}
          </p>
        ) : null}
        <fieldset disabled={busy} className="space-y-4">
          <CheckboxField
            label={t('files.preferences.sync')}
            checked={settings.sync}
            onCheckedChange={(sync) => setSettings((current) => ({ ...current, sync }))}
          />
          <p className="text-xs text-ink-muted">{t('files.preferences.syncHint')}</p>
          <Action
            size="sm"
            variant="secondary"
            onPress={() => {
              void onLoadServer();
            }}
          >
            {t('files.preferences.useServer')}
          </Action>
          <CheckboxField
            label={t('files.preferences.remember')}
            checked={settings.configuration.rememberFolders}
            onCheckedChange={(rememberFolders) =>
              setSettings((current) => ({
                ...current,
                configuration: { ...current.configuration, rememberFolders },
              }))
            }
          />
          <SelectField
            label={t('files.preferences.click')}
            value={settings.configuration.folderClick}
            options={(['open', 'select'] as const).map((value) => ({
              value,
              label: t('files.preferences.' + value),
            }))}
            onValueChange={(folderClick) => {
              if (folderClick === 'open' || folderClick === 'select')
                setSettings((current) => ({
                  ...current,
                  configuration: { ...current.configuration, folderClick },
                }));
            }}
          />
          <p className="text-xs text-ink-muted">
            {t('files.preferences.savedFolders', { count: settings.configuration.folders.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Action
              size="sm"
              variant="secondary"
              onPress={() =>
                setSettings((current) => ({
                  ...current,
                  configuration: { ...current.configuration, defaults: draft },
                }))
              }
            >
              {t('files.preferences.makeDefault')}
            </Action>
            <Action
              size="sm"
              variant="quiet"
              disabled={parentId === undefined}
              onPress={() => {
                const document = {
                  ...settings.configuration,
                  folders: settings.configuration.folders.filter(
                    (folder) => folder.parentId !== parentId,
                  ),
                };
                setSettings({ ...settings, configuration: document });
                setDraftValue(resolveFileView(document, parentId));
                setSaveCurrent(false);
              }}
            >
              {t('files.preferences.resetFolder')}
            </Action>
            <Action
              size="sm"
              variant="quiet"
              disabled={settings.configuration.folders.length === 0}
              onPress={() => {
                setSettings({
                  ...settings,
                  configuration: { ...settings.configuration, folders: [] },
                });
                setDraftValue(settings.configuration.defaults);
                setSaveCurrent(false);
              }}
            >
              {t('files.preferences.resetAll')}
            </Action>
          </div>
        </fieldset>
        <fieldset disabled={busy} className="space-y-5">
          <CheckboxField
            label={t('files.discovery.thumbnails')}
            checked={draft.thumbnails}
            onCheckedChange={(value) => setDraft((current) => ({ ...current, thumbnails: value }))}
          />
          <CheckboxField
            label={t('files.discovery.foldersFirst')}
            checked={draft.foldersFirst}
            onCheckedChange={(value) =>
              setDraft((current) => ({ ...current, foldersFirst: value }))
            }
          />
          <SelectField
            label={t('files.discovery.pageSize')}
            {...(maxPageSize && draft.pageSize > maxPageSize
              ? {
                  hint: locale.startsWith('zh')
                    ? `当前服务每页最多显示 ${maxPageSize} 项。你的原偏好会保留。`
                    : `The service currently shows up to ${maxPageSize} items per page. Your preference is kept.`,
                }
              : {})}
            value={String(draft.pageSize)}
            disabled={draft.view === 'gallery'}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                pageSize: Number(value) as FileViewPreferences['pageSize'],
              }))
            }
            options={filePageSizes.map((value) => ({ value: String(value), label: String(value) }))}
          />
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-semibold">{t('files.discovery.columns')}</legend>
            {fileColumnKeys.map((column) => (
              <CheckboxField
                key={column}
                label={t(`files.discovery.${column}`)}
                checked={draft.columns.includes(column)}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    columns: checked
                      ? [...current.columns, column]
                      : current.columns.filter((value) => value !== column),
                  }))
                }
              />
            ))}
          </fieldset>
        </fieldset>
      </div>
    </DialogSurface>
  );
}
