'use client';
import type { ShareExpiryDraft } from './share-expiry';
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
}: Readonly<{
  value: SharePermissions;
  onChange(value: SharePermissions): void;
  rootKind?: 'file' | 'folder' | 'shortcut' | 'unavailable';
}>) {
  const { t } = useFrontendTranslation();
  const [custom, setCustom] = useState(false);
  const preset = custom ? 'custom' : sharePermissionPreset(value);
  const names: readonly (keyof SharePermissions)[] =
    rootKind !== 'folder'
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
                ? { ...readOnlySharePermissions, modify: true }
                : { ...editorSharePermissions },
            );
          else if (preset !== 'custom') onChange({ ...value });
        }}
      />
      <p className="text-sm text-ink-muted">{t('files.collaboration.permissionHint')}</p>
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
            onValueChange={(day) => onChange({ ...value, day: day ?? '' })}
          />
          <TextField
            label={t('files.collaboration.expiryClock')}
            hint={t('files.collaboration.expiryClockHint')}
            value={value.clock}
            onChange={(event) => onChange({ ...value, clock: event.target.value })}
          />
        </div>
      ) : null}
    </section>
  );
}
