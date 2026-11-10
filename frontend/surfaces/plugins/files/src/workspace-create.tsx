'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { FilesError, type FileListing, type UploadCandidate } from '../../../src/files/model';
import { useFiles, useTransfers } from '../../../src/files/runtime';
import type { CreationTemplate } from '../../../src/files/file-applications';
import { TextDialog } from './text-dialog';
import { OwnFolderPicker } from './own-folder-picker';
const DrawioDialog = lazy(() => import('./drawio-dialog'));
export type CreateAction = 'folder' | 'text' | 'markdown' | 'drawio' | 'upload' | 'directory';
export function WorkspaceCreate({
  action,
  initialParent,
  candidates,
  template,
  onClose,
  onChanged,
}: {
  action: CreateAction;
  initialParent: string;
  candidates?: readonly UploadCandidate[];
  template?: CreationTemplate;
  onClose: () => void;
  onChanged: (queued: boolean) => void;
}) {
  const port = useFiles(),
    transfers = useTransfers(),
    { t } = useFrontendTranslation();
  const [parent, setParent] = useState(initialParent),
    [listing, setListing] = useState<FileListing>(),
    [failure, setFailure] = useState(''),
    [name, setName] = useState(''),
    [editorTarget, setEditorTarget] = useState<{ parent: string; maxBytes: number }>();
  const transitioning = useRef(false);
  // 对话框仍拥有候选，enqueue完成接管后关闭；取消或换账号释放句柄。
  useEffect(
    () => () => {
      for (const candidate of candidates ?? []) port.releaseCandidate(candidate.id);
    },
    [candidates, port],
  );
  const title =
    template?.title ??
    t(
      action === 'folder'
        ? 'files.newFolder'
        : action === 'text'
          ? 'files.newText'
          : action === 'markdown'
            ? 'files.newMarkdown'
            : action === 'drawio'
              ? 'files.newDrawio'
              : action === 'directory'
                ? 'files.uploadDirectory'
                : 'files.upload',
    );
  if (editorTarget && action === 'drawio')
    return (
      <Suspense fallback={<p role="status">{t('files.mediaLoading')}</p>}>
        <DrawioDialog
          request={{ parentId: editorTarget.parent, extension: template?.extension ?? 'drawio' }}
          maxBytes={editorTarget.maxBytes}
          onClose={onClose}
          onSaved={() => onChanged(false)}
        />
      </Suspense>
    );
  if (editorTarget && (action === 'text' || action === 'markdown'))
    return (
      <TextDialog
        request={{ mode: action, parentId: editorTarget.parent, ...(template ? { template } : {}) }}
        maxBytes={editorTarget.maxBytes}
        onClose={onClose}
        onSaved={() => onChanged(false)}
      />
    );
  return (
    <DialogSurface
      isOpen
      triggerLabel={title}
      title={title}
      description={t('files.workspace.targetHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={action === 'folder' ? t('files.confirm') : t('files.workspace.chooseHere')}
      confirmDisabled={!listing || (action === 'folder' && !name.trim())}
      onOpenChange={(open) => {
        if (!open && !transitioning.current) onClose();
      }}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        if (!listing) throw new FilesError('unavailable');
        setFailure('');
        try {
          if (parent) {
            const current = await port.detail(parent);
            if (current.entry.kind !== 'folder' || current.entry.trashedAt)
              throw new FilesError('missing');
          }
          if (action === 'folder') {
            await port.folder(parent, name);
            onChanged(false);
          } else if (action === 'text' || action === 'markdown' || action === 'drawio') {
            transitioning.current = true;
            setEditorTarget({ parent, maxBytes: listing.maxTextBytes });
          } else {
            const chosen =
              candidates ??
              (await (action === 'directory' ? port.chooseDirectory() : port.chooseFiles()));
            if (!chosen.length) return;
            try {
              await transfers.enqueue(chosen, parent);
            } catch (error) {
              for (const candidate of chosen) port.releaseCandidate(candidate.id);
              throw error;
            }
            onChanged(true);
          }
        } catch (error) {
          setFailure(
            t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
          );
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        {action === 'folder' ? (
          <TextField
            label={t('files.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        ) : null}
        <OwnFolderPicker value={parent} onChange={setParent} onListing={setListing} />
        {candidates ? (
          <p>{t('files.workspace.dropped', { count: candidates.length })}</p>
        ) : action === 'upload' || action === 'directory' ? (
          <p className="text-sm text-ink-muted">{t('files.workspace.chooseBeforeUpload')}</p>
        ) : null}
      </div>
    </DialogSurface>
  );
}
