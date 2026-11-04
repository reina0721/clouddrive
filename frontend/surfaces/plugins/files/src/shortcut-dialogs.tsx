'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useFiles, useFileNavigation } from '../../../src/files/runtime';
import { FilesError, type FileEntry, type FileListing } from '../../../src/files/model';

/** FolderPicker 仅从账户文件契约读取目录，切换目录时取消旧请求。 */
export function FolderPicker({
  parent,
  onChange,
  onReady,
}: {
  parent: string;
  onChange: (id: string) => void;
  onReady: (ready: boolean) => void;
}) {
  const files = useFiles(),
    { t } = useFrontendTranslation();
  const [listing, setListing] = useState<FileListing>(),
    [failure, setFailure] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    onReady(false);
    void files
      .list(
        { parent, category: '', search: '', trash: false, sort: 'name', desc: false },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) {
          setListing(value);
          onReady(true);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      });
    return () => controller.abort();
  }, [files, parent, revision, t, onReady]);
  return (
    <section
      className="rounded-control border border-border p-3"
      aria-label={t('files.navigation.folder')}
    >
      <h2 className="font-semibold">{t('files.navigation.folder')}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        <Action variant="secondary" onPress={() => onChange('')}>
          /
        </Action>
        {listing?.breadcrumbs.map((entry) => (
          <Action key={entry.id} variant="secondary" onPress={() => onChange(entry.id)}>
            {entry.name}
          </Action>
        ))}
      </div>
      <p className="my-3 break-words text-sm">
        {t('files.navigation.selectedFolder')}: /
        {listing?.breadcrumbs.map((entry) => entry.name).join('/')}
      </p>
      {failure ? (
        <p role="alert" className="text-danger">
          {failure}
        </p>
      ) : null}
      {!listing ? (
        <Action variant="quiet" onPress={() => setRevision((value) => value + 1)}>
          {t('files.refresh')}
        </Action>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-auto">
          {listing.items
            .filter((entry) => entry.kind === 'folder')
            .map((entry) => (
              <li key={entry.id}>
                <Action variant="secondary" onPress={() => onChange(entry.id)}>
                  {entry.name}/
                </Action>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

export function SaveShortcutDialog({
  address = '',
  parentId = '',
  onClose,
  onSaved,
}: {
  address?: string;
  parentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const nav = useFileNavigation(),
    { t } = useFrontendTranslation();
  const [link, setLink] = useState(address),
    [name, setName] = useState(''),
    [parent, setParent] = useState(parentId),
    [ready, setReady] = useState(false),
    [failure, setFailure] = useState('');
  return (
    <DialogSurface
      triggerLabel={t('files.navigation.save')}
      title={t('files.navigation.save')}
      description={t('files.navigation.subtitle')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.save')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      confirmDisabled={!link.trim() || !name.trim() || !ready}
      failureMessage={failure}
      onConfirm={async () => {
        setFailure('');
        try {
          await nav.saveShortcut({ address: link, parentId: parent, name });
          onSaved();
        } catch (error) {
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        <TextField
          label={t('files.navigation.address')}
          value={link}
          onChange={(event) => setLink(event.target.value)}
          autoComplete="off"
        />
        <TextField
          label={t('files.navigation.alias')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <FolderPicker
          key={parent}
          parent={parent}
          onChange={(id) => {
            setReady(false);
            setParent(id);
          }}
          onReady={setReady}
        />
        <p className="text-sm text-ink-muted">{t('files.navigation.duplicateHint')}</p>
      </div>
    </DialogSurface>
  );
}

export type ShortcutAction = 'rename' | 'move' | 'copy' | 'remove' | 'purge';
export function ShortcutActionDialog({
  entry,
  action,
  onClose,
  onChanged,
}: {
  entry: FileEntry;
  action: ShortcutAction;
  onClose: () => void;
  onChanged: () => void;
}) {
  const files = useFiles(),
    nav = useFileNavigation(),
    { t } = useFrontendTranslation();
  const [name, setName] = useState(
      action === 'copy' ? t('files.copyName', { name: entry.name }) : entry.name,
    ),
    [parent, setParent] = useState(entry.parentId),
    [ready, setReady] = useState(false),
    [failure, setFailure] = useState('');
  const needsFolder = action === 'move' || action === 'copy',
    needsName = action === 'rename' || action === 'copy';
  const title = t(action === 'purge' ? 'files.navigation.purge' : `files.${action}`);
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={action === 'purge' ? t('files.navigation.purgeHint') : entry.name}
      cancelLabel={t('files.cancel')}
      confirmLabel={title}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      confirmDisabled={(needsFolder && !ready) || (needsName && !name.trim())}
      failureMessage={failure}
      onConfirm={async () => {
        setFailure('');
        try {
          if (action === 'rename')
            await files.update(entry.id, { name, expectedRevision: entry.contentRevision });
          else if (action === 'move')
            await files.update(entry.id, {
              parentId: parent,
              expectedRevision: entry.contentRevision,
            });
          else if (action === 'copy') await files.copy(entry.id, parent, name);
          else if (action === 'remove') await files.trash(entry.id);
          else await nav.purgeShortcut(entry);
          onChanged();
        } catch (error) {
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        {needsName ? (
          <TextField
            label={t('files.navigation.alias')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        ) : null}
        {needsFolder ? (
          <FolderPicker
            key={parent}
            parent={parent}
            onChange={(id) => {
              setReady(false);
              setParent(id);
            }}
            onReady={setReady}
          />
        ) : null}
      </div>
    </DialogSurface>
  );
}
