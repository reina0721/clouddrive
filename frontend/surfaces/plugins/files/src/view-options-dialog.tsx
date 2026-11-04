'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { CheckboxField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  fileColumnKeys,
  filePageSizes,
  type FileViewPreferences,
} from '../../../src/files/view-options';

export function ViewOptionsDialog({
  preferences,
  onClose,
  onSave,
}: {
  preferences: FileViewPreferences;
  onClose: () => void;
  onSave: (value: FileViewPreferences) => void;
}) {
  const { t } = useFrontendTranslation(),
    [draft, setDraft] = useState(preferences);
  return (
    <DialogSurface
      triggerLabel={t('files.discovery.viewOptions')}
      title={t('files.discovery.viewOptions')}
      description={t('files.discovery.viewHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.save')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() => onSave(draft)}
    >
      <div className="space-y-5">
        <CheckboxField
          label={t('files.discovery.thumbnails')}
          checked={draft.thumbnails}
          onCheckedChange={(value) => setDraft((current) => ({ ...current, thumbnails: value }))}
        />
        <CheckboxField
          label={t('files.discovery.foldersFirst')}
          checked={draft.foldersFirst}
          onCheckedChange={(value) => setDraft((current) => ({ ...current, foldersFirst: value }))}
        />
        <SelectField
          label={t('files.discovery.pageSize')}
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
      </div>
    </DialogSurface>
  );
}
