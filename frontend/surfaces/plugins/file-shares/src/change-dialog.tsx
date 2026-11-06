'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { usePublicFiles } from '../../../src/files/runtime';
import {
  FilesError,
  type PublicFileEntry,
  type SharedItemAction,
  type SharedBatchResult,
} from '../../../src/files/model';
import { PublicFolderPicker } from './folder-picker';

export type PublicChange = Readonly<{
  action: SharedItemAction;
  entries: readonly PublicFileEntry[];
  batch: boolean;
}>;
export function PublicChangeDialog({
  change,
  root,
  parent,
  onClose,
  onApplied,
}: Readonly<{
  change: PublicChange;
  root: PublicFileEntry;
  parent: string;
  onClose(): void;
  onApplied(result: SharedBatchResult): void;
}>) {
  const port = usePublicFiles(),
    { t } = useFrontendTranslation();
  const [name, setName] = useState(
      change.action === 'rename' ? (change.entries[0]?.name ?? '') : '',
    ),
    [destination, setDestination] = useState(parent || root.id),
    [failure, setFailure] = useState('');
  const [destinationAllowed, setDestinationAllowed] = useState(false);
  const title = t(`publicFiles.collaboration.${change.action}`);
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={
        change.action === 'trash'
          ? t('publicFiles.collaboration.trashHint')
          : t('publicFiles.collaboration.scopeHint')
      }
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      cancelLabel={t('publicFiles.collaboration.cancel')}
      confirmLabel={t('publicFiles.collaboration.confirm')}
      confirmDisabled={
        (change.action === 'rename' && !name.trim()) ||
        ((change.action === 'move' || change.action === 'copy') && !destinationAllowed)
      }
      failureMessage={failure}
      onConfirm={async () => {
        try {
          let result: SharedBatchResult;
          if (change.batch && change.action !== 'rename')
            result = await port.batch(
              change.entries,
              change.action,
              change.action === 'trash' ? '' : destination,
            );
          else {
            const original = change.entries[0];
            if (!original) throw new FilesError('invalid');
            const entry = await port.changeItem(original, change.action, {
              ...(change.action === 'rename' || change.action === 'copy' ? { name } : {}),
              ...(change.action === 'move' || change.action === 'copy'
                ? { parentId: destination }
                : {}),
            });
            result = { items: [{ id: original.id, entry, errorCode: '' }] };
          }
          onApplied(result);
        } catch (error) {
          setFailure(
            t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          );
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        <ul className="space-y-2">
          {change.entries.map((entry) => (
            <li key={entry.id} className="break-words">
              {entry.name}
            </li>
          ))}
        </ul>
        {!change.batch && (change.action === 'rename' || change.action === 'copy') ? (
          <TextField
            label={t('publicFiles.collaboration.newName')}
            {...(change.action === 'copy'
              ? { hint: t('publicFiles.collaboration.copyNameHint') }
              : {})}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        ) : null}
        {change.action === 'move' || change.action === 'copy' ? (
          <PublicFolderPicker
            root={root}
            value={destination}
            onChange={setDestination}
            onAllowedChange={setDestinationAllowed}
          />
        ) : null}
      </div>
    </DialogSurface>
  );
}
