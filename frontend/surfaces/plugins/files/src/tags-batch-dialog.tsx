'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { FilesError } from '../../../src/files/model';
import {
  annotationTagNamesSchema,
  annotationValuesSchema,
  type FileAnnotationTag,
  type FileAnnotationSummary,
  type FileAnnotationLimits,
} from '../../../src/files/annotation-values';
import { useFiles } from '../../../src/files/runtime';
import { TagsEditor, TagNamesInput } from './annotation-fields';

export function TagsBatchDialog({
  mode,
  targets,
  limits,
  onClose,
  onUpdated,
}: {
  mode: 'add' | 'remove';
  targets: readonly FileAnnotationSummary[];
  limits: FileAnnotationLimits;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const port = useFiles().annotations,
    { t } = useFrontendTranslation(),
    [tags, setTags] = useState<FileAnnotationTag[]>([]),
    [names, setNames] = useState<string[]>([]),
    [failure, setFailure] = useState('');
  return (
    <DialogSurface
      triggerLabel={t(
        mode === 'add' ? 'files.annotations.batchAdd' : 'files.annotations.batchRemove',
      )}
      title={t(mode === 'add' ? 'files.annotations.batchAdd' : 'files.annotations.batchRemove')}
      description={t('files.annotations.batchHint', { count: targets.length })}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.save')}
      failureMessage={failure}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={async () => {
        try {
          if (!targets.length || targets.length > limits.maxBatchEntries)
            throw new FilesError('large');
          const add =
              mode === 'add'
                ? annotationValuesSchema.parse({ tags, properties: [], emoji: '', folderColor: '' })
                    .tags
                : [],
            remove = mode === 'remove' ? annotationTagNamesSchema.parse(names) : [];
          if (mode === 'add' && !add.length) throw new FilesError('invalid');
          await port.changeTags({
            targets: targets.map((value) => ({ id: value.entryId, revision: value.revision })),
            add,
            remove,
          });
          onUpdated();
        } catch (error) {
          setFailure(
            t(
              error instanceof FilesError && ['conflict', 'large'].includes(error.code)
                ? 'files.annotations.' + error.code
                : 'files.annotations.invalid',
            ),
          );
          throw error;
        }
      }}
    >
      {mode === 'add' ? (
        <TagsEditor
          value={tags}
          onChange={setTags}
          defaultColor={limits.defaultTagColor}
          maxTags={limits.maxTags}
        />
      ) : (
        <TagNamesInput value={names} onChange={setNames} />
      )}
    </DialogSurface>
  );
}
