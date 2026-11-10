'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { FilesError, type FileListing } from '../../../src/files/model';
import { useFiles, type ImageCopyDestinationProps } from '../../../src/files/runtime';

/** OwnFolderPicker 由创建与解压共同使用，分页读取本人有效目录。 */
export function OwnFolderPicker({
  value,
  onChange,
  onListing,
}: {
  value: string;
  onChange: (parent: string) => void;
  onListing: (listing: FileListing | undefined) => void;
}) {
  const port = useFiles(),
    { t } = useFrontendTranslation();
  const [cursor, setCursor] = useState({ parent: value, page: 1 }),
    [result, setResult] = useState<{ parent: string; page: number; listing: FileListing }>(),
    [failure, setFailure] = useState(''),
    [retry, setRetry] = useState(0);
  const page = cursor.parent === value ? cursor.page : 1;
  const listing = result?.parent === value && result.page === page ? result.listing : undefined;
  useEffect(() => {
    const controller = new AbortController();
    void port
      .list(
        { parent: value, category: '', trash: false, search: '', sort: 'name', desc: false, page },
        controller.signal,
      )
      .then((listing) => {
        if (controller.signal.aborted) return;
        if (value && listing.breadcrumbs.at(-1)?.id !== value) throw new FilesError('missing');
        setResult({ parent: value, page, listing });
        setFailure('');
        onListing(listing);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFailure(
            t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
          );
          onListing(undefined);
        }
      });
    return () => controller.abort();
  }, [port, value, page, retry, t, onListing]);
  function move(parent: string, nextPage = 1) {
    setResult(undefined);
    setFailure('');
    setCursor({ parent, page: nextPage });
    onListing(undefined);
    onChange(parent);
  }
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">{t('files.workspace.target')}</h2>
      <p className="break-words text-sm">
        {[t('files.nav'), ...(listing?.breadcrumbs.map((entry) => entry.name) ?? [])].join(' / ')}
      </p>
      {value ? (
        <div className="flex gap-2">
          <Action size="sm" variant="quiet" onPress={() => move('')}>
            {t('files.nav')}
          </Action>
          <Action
            size="sm"
            variant="quiet"
            disabled={!listing}
            onPress={() => move(listing?.breadcrumbs.at(-2)?.id ?? '')}
          >
            {t('files.workspace.up')}
          </Action>
        </div>
      ) : null}
      {!listing ? (
        <p role="status">{failure ? t('files.workspace.unknown') : t('files.previewLoading')}</p>
      ) : null}
      {failure ? <p role="alert">{failure}</p> : null}
      {failure ? (
        <Action
          size="sm"
          variant="secondary"
          onPress={() => {
            setResult(undefined);
            onListing(undefined);
            setRetry((value) => value + 1);
          }}
        >
          {t('files.workspace.retry')}
        </Action>
      ) : null}
      {listing && listing.total > listing.pageSize ? (
        <div className="flex gap-2">
          <Action
            size="sm"
            variant="quiet"
            disabled={page === 1}
            onPress={() => move(value, page - 1)}
          >
            {t('files.previousPage')}
          </Action>
          <Action
            size="sm"
            variant="quiet"
            disabled={page * listing.pageSize >= listing.total}
            onPress={() => move(value, page + 1)}
          >
            {t('files.nextPage')}
          </Action>
        </div>
      ) : null}
      <div className="max-h-60 overflow-y-auto space-y-2">
        {listing?.items
          .filter((entry) => entry.kind === 'folder')
          .map((entry) => (
            <Action key={entry.id} size="sm" variant="quiet" onPress={() => move(entry.id)}>
              {t('files.workspace.openFolder', { name: entry.name })}
            </Action>
          ))}
        {listing && !listing.items.some((entry) => entry.kind === 'folder') ? (
          <p className="text-sm text-ink-muted">{t('files.workspace.emptyFolders')}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ImageCopyDestinationDialog({
  initialParentId,
  onSelect,
  onClose,
}: ImageCopyDestinationProps) {
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const title = chinese ? '选择副本保存位置' : 'Choose copy destination';
  const [parent, setParent] = useState(initialParentId);
  const [listing, setListing] = useState<FileListing>();
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={
        chinese
          ? '选择本人文件夹，副本会使用导出设置中的名称。'
          : 'Select a folder. The copy uses the name in export settings.'
      }
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.workspace.chooseHere')}
      confirmDisabled={!listing}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() => {
        if (!listing) return;
        onSelect({
          id: parent,
          path: [t('files.nav'), ...listing.breadcrumbs.map(({ name }) => name)].join(' / '),
        });
      }}
    >
      <OwnFolderPicker value={parent} onChange={setParent} onListing={setListing} />
    </DialogSurface>
  );
}
