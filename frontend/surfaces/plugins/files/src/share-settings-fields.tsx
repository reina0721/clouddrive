'use client';
import { resolveShareExpiry, type ShareExpiryDraft } from './share-expiry';
import { wallTimeInstant } from '@clouddrive/i18n/temporal';
import { useFileTime } from './use-file-time';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DatePickerField } from '@clouddrive/ui-adapter/date-picker-field';
import {
  readOnlySharePermissions,
  uploadOnlySharePermissions,
  editorSharePermissions,
  sharePermissionPreset,
  sharePermissionsValid,
  type SharePermissions,
} from '../../../src/files/sharing';

export function SharePermissionFields({
  value,
  onChange,
  rootKind = 'folder',
  policyScope = 'share-root',
}: Readonly<{
  value: SharePermissions;
  onChange(value: SharePermissions): void;
  rootKind?: 'file' | 'folder' | 'shortcut' | 'unavailable';
  policyScope?: 'share-root' | 'entry';
}>) {
  const { t } = useFrontendTranslation();
  const [custom, setCustom] = useState(false);
  let inferredPreset = sharePermissionPreset(value);
  // 同为“可编辑”，分享根文件与目录子项的能力不同，不能用宽泛说明覆盖具体策略。
  if (rootKind === 'folder' && inferredPreset === 'editor' && !Object.values(value).every(Boolean))
    inferredPreset = 'custom';
  if (rootKind === 'file' && policyScope === 'entry') {
    const itemEditor = (Object.keys(editorSharePermissions) as (keyof SharePermissions)[]).every(
      (key) =>
        value[key] === (key === 'create' || key === 'upload' ? false : editorSharePermissions[key]),
    );
    if (itemEditor) inferredPreset = 'editor';
    else if (inferredPreset === 'editor') inferredPreset = 'custom';
  }
  const preset = custom ? 'custom' : inferredPreset;
  const permissionHint =
    preset === 'editor' && rootKind === 'file'
      ? policyScope === 'entry'
        ? 'editorItem'
        : 'editorFile'
      : preset;
  const names: readonly (keyof SharePermissions)[] =
    rootKind === 'file' && policyScope === 'entry'
      ? ['browse', 'preview', 'download', 'modify', 'rename', 'move', 'copy', 'delete']
      : rootKind !== 'folder'
        ? ['preview', 'download', 'modify']
        : [
            'browse',
            'preview',
            'download',
            'create',
            'upload',
            'modify',
            'rename',
            'move',
            'copy',
            'delete',
          ];
  return (
    <section className="space-y-3" aria-label={t('files.collaboration.permissions')}>
      <SelectField
        label={t('files.collaboration.permissions')}
        value={preset}
        options={[
          { value: 'read-only', label: t('files.collaboration.presets.read-only') },
          ...(rootKind === 'folder'
            ? [{ value: 'upload-only', label: t('files.collaboration.presets.upload-only') }]
            : []),
          { value: 'editor', label: t('files.collaboration.presets.editor') },
          { value: 'custom', label: t('files.collaboration.presets.custom') },
        ]}
        onValueChange={(next) => {
          setCustom(next === 'custom');
          if (next === 'read-only') onChange({ ...readOnlySharePermissions });
          else if (next === 'upload-only') onChange({ ...uploadOnlySharePermissions });
          else if (next === 'editor')
            onChange(
              rootKind === 'file'
                ? policyScope === 'entry'
                  ? { ...editorSharePermissions, create: false, upload: false }
                  : { ...readOnlySharePermissions, modify: true }
                : { ...editorSharePermissions },
            );
          else if (preset !== 'custom') onChange({ ...value });
        }}
      />
      <p className="text-sm text-ink-muted">
        {t(`files.collaboration.permissionHints.${permissionHint}`)}
      </p>
      {preset === 'custom' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {names.map((name) => (
            <div key={name} className="w-fit">
              <CheckboxField
                label={t(`files.collaboration.rights.${name}`)}
                checked={value[name]}
                onCheckedChange={(checked) => onChange({ ...value, [name]: checked })}
              />
            </div>
          ))}
        </div>
      ) : null}
      {value.preview && !value.download ? (
        <p className="text-xs text-ink-muted">{t('files.collaboration.permissionHint')}</p>
      ) : null}
      {!sharePermissionsValid(value) ? (
        <p role="alert" className="text-sm text-danger">
          {t('files.collaboration.invalidPermissions')}
        </p>
      ) : null}
    </section>
  );
}

export function ShareExpiryFields({
  value,
  onChange,
  current,
}: Readonly<{
  value: ShareExpiryDraft;
  onChange(value: ShareExpiryDraft): void;
  current?: string;
}>) {
  const { t } = useFrontendTranslation();
  const time = useFileTime();
  const resolved = resolveShareExpiry(value, current);
  const ambiguity = value.mode === 'custom' ? wallTimeInstant(value, 'reject') : undefined;
  return (
    <section className="space-y-3">
      <SelectField
        label={t('files.shareValidity')}
        value={value.mode}
        options={[
          current
            ? { value: 'keep', label: t('files.collaboration.keepExpiry') }
            : { value: 'default', label: t('files.defaultShareValidity') },
          ...[1, 24, 168, 720].map((hours) => ({
            value: String(hours),
            label: t('files.validityHours', { count: hours }),
          })),
          { value: 'custom', label: t('files.collaboration.customExpiry') },
        ]}
        onValueChange={(mode) => onChange({ ...value, mode: mode as ShareExpiryDraft['mode'] })}
      />
      {value.mode === 'custom' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <DatePickerField
            label={t('files.collaboration.expiryDay')}
            calendarLabel={t('files.collaboration.expiryCalendar')}
            value={value.day || null}
            onValueChange={(day) => onChange({ ...value, day: day ?? '', occurrence: 'reject' })}
          />
          <TextField
            label={t('files.collaboration.expiryClock')}
            hint={t('files.collaboration.expiryClockHint')}
            value={value.clock}
            onChange={(event) =>
              onChange({ ...value, clock: event.target.value, occurrence: 'reject' })
            }
          />
        </div>
      ) : null}
      {value.mode === 'custom' ? (
        <>
          <p className="text-xs text-ink-muted">
            {t('files.time.inputZone', { zone: value.timeZone })}
          </p>
          {ambiguity && !ambiguity.ok && ambiguity.code === 'overlap' ? (
            <SelectField
              label={t('files.time.occurrence')}
              value={value.occurrence}
              options={[
                { value: 'reject', label: t('files.time.chooseOccurrence') },
                { value: 'earlier', label: t('files.time.earlier', { value: ambiguity.earlier }) },
                { value: 'later', label: t('files.time.later', { value: ambiguity.later }) },
              ]}
              onValueChange={(occurrence) => {
                if (occurrence === 'reject' || occurrence === 'earlier' || occurrence === 'later')
                  onChange({ ...value, occurrence });
              }}
            />
          ) : null}
          {!resolved.ok ? (
            <p role="alert" className="text-sm text-danger">
              {t('files.time.' + resolved.code)}
            </p>
          ) : resolved.value ? (
            <p role="status" className="break-words text-xs text-ink-muted">
              {t('files.time.preview', {
                value: time.full(resolved.value),
                instant: resolved.value,
              })}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
