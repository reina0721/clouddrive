'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { FilesError, type FileListing, type UploadCandidate } from '../../../src/files/model';
import { useFiles, useTransfers } from '../../../src/files/runtime';
import { TextDialog } from './text-dialog';
export type CreateAction = 'folder' | 'text' | 'markdown' | 'upload' | 'directory';
export function WorkspaceCreate({
  action,
  initialParent,
  candidates,
  onClose,
  onChanged,
}: {
  action: CreateAction;
  initialParent: string;
  candidates?: readonly UploadCandidate[];
  onClose: () => void;
  onChanged: (queued: boolean) => void;
}) {
  const port = useFiles(),
    transfers = useTransfers(),
    { t } = useFrontendTranslation();
  const [parent, setParent] = useState(initialParent),
    [directoryResult, setDirectoryResult] = useState<{
      parent: string;
      page: number;
      listing: FileListing;
    }>(),
    [failure, setFailure] = useState(''),
    [name, setName] = useState(''),
    [textTarget, setTextTarget] = useState<{ parent: string; maxBytes: number }>();
  const [retry, setRetry] = useState(0),
    [folderPage, setFolderPage] = useState(1);
  const listing =
    directoryResult?.parent === parent && directoryResult.page === folderPage
      ? directoryResult.listing
      : undefined;
  const transitioning = useRef(false);
  const errorText = (error: unknown) =>
    t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable'));
  useEffect(() => {
    const controller = new AbortController();
    void port
      .list(
        {
          parent,
          category: '',
          trash: false,
          search: '',
          sort: 'name',
          desc: false,
          page: folderPage,
        },
        controller.signal,
      )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (parent && (!result.breadcrumbs.length || result.breadcrumbs.at(-1)?.id !== parent))
          throw new FilesError('missing');
        setDirectoryResult({ parent, page: folderPage, listing: result });
        setFailure('');
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setFailure(
            t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
          );
      });
    return () => controller.abort();
  }, [port, parent, folderPage, retry, t]);
  // 候选句柄只在此对话框拥有，enqueue同步接收后由传输运行域接管。
  useEffect(
    () => () => {
      for (const candidate of candidates ?? []) port.releaseCandidate(candidate.id);
    },
    [candidates, port],
  );
  const title = t(
    action === 'folder'
      ? 'files.newFolder'
      : action === 'text'
        ? 'files.newText'
        : action === 'markdown'
          ? 'files.newMarkdown'
          : action === 'directory'
            ? 'files.uploadDirectory'
            : 'files.upload',
  );
  if (textTarget && (action === 'text' || action === 'markdown'))
    return (
      <TextDialog
        request={{ mode: action, parentId: textTarget.parent }}
        maxBytes={textTarget.maxBytes}
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
          } else if (action === 'text' || action === 'markdown') {
            transitioning.current = true;
            setTextTarget({ parent, maxBytes: listing.maxTextBytes });
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
          setFailure(errorText(error));
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
        <h2 className="text-sm font-semibold">{t('files.workspace.target')}</h2>
        <p className="break-words text-sm">
          {[t('files.nav'), ...(listing?.breadcrumbs.map((entry) => entry.name) ?? [])].join(' / ')}
        </p>
        {parent ? (
          <Action
            size="sm"
            variant="quiet"
            onPress={() => {
              setDirectoryResult(undefined);
              setFailure('');
              setFolderPage(1);
              setParent('');
            }}
          >
            {t('files.nav')}
          </Action>
        ) : null}
        {parent ? (
          <Action
            size="sm"
            variant="quiet"
            disabled={!listing}
            onPress={() => {
              setDirectoryResult(undefined);
              setFailure('');
              setFolderPage(1);
              setParent(listing?.breadcrumbs.at(-2)?.id ?? '');
            }}
          >
            {t('files.workspace.up')}
          </Action>
        ) : null}
        {!listing ? (
          <p role="status">{failure ? t('files.workspace.unknown') : t('files.previewLoading')}</p>
        ) : null}
        {failure ? (
          <Action size="sm" variant="secondary" onPress={() => setRetry((value) => value + 1)}>
            {t('files.workspace.retry')}
          </Action>
        ) : null}
        {listing && listing.total > listing.pageSize ? (
          <div className="flex gap-2">
            <Action
              size="sm"
              variant="quiet"
              disabled={folderPage === 1}
              onPress={() => {
                setDirectoryResult(undefined);
                setFailure('');
                setFolderPage((value) => value - 1);
              }}
            >
              {t('files.previousPage')}
            </Action>
            <Action
              size="sm"
              variant="quiet"
              disabled={folderPage * listing.pageSize >= listing.total}
              onPress={() => {
                setDirectoryResult(undefined);
                setFailure('');
                setFolderPage((value) => value + 1);
              }}
            >
              {t('files.nextPage')}
            </Action>
          </div>
        ) : null}
        <div className="max-h-60 overflow-y-auto space-y-2">
          {listing?.items
            .filter((entry) => entry.kind === 'folder')
            .map((entry) => (
              <Action
                key={entry.id}
                size="sm"
                variant="quiet"
                onPress={() => {
                  setFailure('');
                  setFolderPage(1);
                  setParent(entry.id);
                }}
              >
                {t('files.workspace.openFolder', { name: entry.name })}
              </Action>
            ))}
          {listing && !listing.items.some((entry) => entry.kind === 'folder') ? (
            <p className="text-sm text-ink-muted">{t('files.workspace.emptyFolders')}</p>
          ) : null}
        </div>
        {candidates ? (
          <p>{t('files.workspace.dropped', { count: candidates.length })}</p>
        ) : action === 'upload' || action === 'directory' ? (
          <p className="text-sm text-ink-muted">{t('files.workspace.chooseBeforeUpload')}</p>
        ) : null}
      </div>
    </DialogSurface>
  );
}
