'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import type { ArchiveTask } from '../../../src/files/archives';
import { FilesError, type FileEntry, type FileListing } from '../../../src/files/model';
import { useArchives } from '../../../src/files/runtime';
import { OwnFolderPicker } from './own-folder-picker';

function defaultZIPName(entries: readonly FileEntry[]) {
  const entry = entries.length === 1 ? entries[0] : undefined;
  if (!entry) return 'archive.zip';
  const extension = entry.name.lastIndexOf('.');
  const basename =
    entry.kind === 'file' && extension > 0 ? entry.name.slice(0, extension) : entry.name;
  return basename + '.zip';
}

export function ArchiveCreateDialog({
  entries,
  initialParent,
  onClose,
  onCreated,
}: {
  entries: readonly FileEntry[];
  initialParent: string;
  onClose: () => void;
  onCreated: (task: ArchiveTask) => void;
}) {
  const port = useArchives();
  const { t } = useFrontendTranslation();
  const [name, setName] = useState(() => defaultZIPName(entries));
  const [parent, setParent] = useState(initialParent);
  const [listing, setListing] = useState<FileListing>();
  const [failure, setFailure] = useState('');
  const pending = useRef<AbortController | undefined>(undefined);
  const requestKey = useRef<{ serialized: string; key: string } | undefined>(undefined);
  useEffect(() => () => pending.current?.abort(), []);
  return (
    <DialogSurface
      isOpen
      triggerLabel={t('files.archives.createZIP.title')}
      title={t('files.archives.createZIP.title')}
      description={t('files.archives.createZIP.hint', { count: entries.length })}
      confirmLabel={t('files.archives.createZIP.submit')}
      cancelLabel={t('files.cancel')}
      confirmDisabled={!listing || !name.trim()}
      failureMessage={failure}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={async () => {
        setFailure('');
        const controller = new AbortController();
        pending.current = controller;
        try {
          const request = {
            name: name.trim(),
            parentId: parent,
            sourceIds: entries.map((entry) => entry.id),
          };
          const serialized = JSON.stringify(request);
          if (requestKey.current?.serialized !== serialized) {
            requestKey.current = { serialized, key: port.newTaskKey() };
          }
          const task = await port.createZIP(request, requestKey.current.key, controller.signal);
          if (!controller.signal.aborted) onCreated(task);
        } catch (error) {
          if (!controller.signal.aborted)
            setFailure(
              t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
            );
          throw error;
        } finally {
          if (pending.current === controller) pending.current = undefined;
        }
      }}
    >
      <div className="space-y-4">
        <TextField
          label={t('files.archives.createZIP.name')}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setFailure('');
          }}
        />
        <OwnFolderPicker
          value={parent}
          onChange={(next) => {
            setParent(next);
            setFailure('');
          }}
          onListing={setListing}
        />
      </div>
    </DialogSurface>
  );
}
