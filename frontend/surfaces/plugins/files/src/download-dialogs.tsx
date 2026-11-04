'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextAreaField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useDownloads, useFiles } from '../../../src/files/runtime';
import { FilesError, type FileListing } from '../../../src/files/model';
import {
  downloadBatchError,
  type DownloadCreate,
  type OfflineDownload,
} from '../../../src/files/downloads';

function DownloadFolders({
  parent,
  onChange,
  onReady,
}: Readonly<{ parent: string; onChange(value: string): void; onReady(ready: boolean): void }>) {
  const files = useFiles(),
    { t } = useFrontendTranslation();
  const [page, setPage] = useState(1),
    [listing, setListing] = useState<FileListing>(),
    [failure, setFailure] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void files
      .list(
        {
          parent,
          search: '',
          category: '',
          trash: false,
          sort: 'name',
          desc: false,
          filters: { kinds: ['folder'], scope: 'folder' },
          page,
          pageSize: 20,
        },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) {
          setListing(value);
          onReady(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailure(true);
          onReady(false);
        }
      });
    return () => controller.abort();
  }, [files, parent, page, retry, onReady]);
  function open(id: string) {
    setListing(undefined);
    setFailure(false);
    setPage(1);
    onReady(false);
    onChange(id);
    if (id === parent) setRetry((value) => value + 1);
  }
  function paginate(value: number) {
    setListing(undefined);
    setFailure(false);
    onReady(false);
    setPage(value);
  }
  return (
    <section
      className="rounded-control border border-border p-3"
      aria-label={t('files.downloads.destination')}
    >
      <h2 className="font-semibold">{t('files.downloads.destination')}</h2>
      <div className="my-2 flex flex-wrap gap-2">
        <Action variant="quiet" onPress={() => open('')}>
          {t('files.downloads.root')}
        </Action>
        {listing?.breadcrumbs.map((entry) => (
          <Action key={entry.id} variant="quiet" onPress={() => open(entry.id)}>
            {entry.name}/
          </Action>
        ))}
      </div>
      {!listing ? (
        <p role={failure ? 'alert' : 'status'} className="text-sm text-ink-muted">
          {t(failure ? 'files.downloads.directoryUnavailable' : 'files.downloads.directoryLoading')}
        </p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-auto">
          {listing.items.map((entry) => (
            <li key={entry.id}>
              <Action variant="secondary" onPress={() => open(entry.id)}>
                {entry.name}/
              </Action>
            </li>
          ))}
          {!listing.items.length ? (
            <li className="text-sm text-ink-muted">{t('files.downloads.directoryEmpty')}</li>
          ) : null}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Action variant="quiet" onPress={() => open(parent)}>
          {t('files.refresh')}
        </Action>
        <Action variant="quiet" disabled={!listing || page <= 1} onPress={() => paginate(page - 1)}>
          {t('files.downloads.previous')}
        </Action>
        <Action
          variant="quiet"
          disabled={!listing || page * listing.pageSize >= listing.total}
          onPress={() => paginate(page + 1)}
        >
          {t('files.downloads.next')}
        </Action>
      </div>
    </section>
  );
}

export function DownloadCreateDialog({
  initialParent = '',
  limit,
  onClose,
  onCreated,
}: Readonly<{ initialParent?: string; limit: number; onClose(): void; onCreated(): void }>) {
  const port = useDownloads(),
    { t } = useFrontendTranslation();
  const [links, setLinks] = useState(''),
    [name, setName] = useState(''),
    [parent, setParent] = useState(initialParent),
    [ready, setReady] = useState(false),
    [failure, setFailure] = useState('');
  const pendingInputs = useRef<readonly DownloadCreate[] | undefined>(undefined);
  const [itemFailures, setItemFailures] = useState<
    readonly { key: string; position: number; message: string }[]
  >([]);
  const lines = links
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const changed = () => {
    pendingInputs.current = undefined;
    setFailure('');
    setItemFailures([]);
  };
  return (
    <DialogSurface
      triggerLabel={t('files.downloads.create')}
      title={t('files.downloads.create')}
      description={t('files.downloads.createHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.downloads.confirm')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      confirmDisabled={!ready || !lines.length || lines.length > limit}
      failureMessage={failure}
      onConfirm={async () => {
        let partial = false;
        try {
          const inputs =
            pendingInputs.current ??
            lines.map((uri) => ({
              uri,
              parentId: parent,
              name: lines.length === 1 ? name : '',
              clientKey: port.newClientKey(),
            }));
          pendingInputs.current = inputs;
          const results = await port.create(inputs);
          const failedKeys = new Set(
            results.items.filter((item) => item.errorCode).map((item) => item.clientKey),
          );
          const failed = inputs.filter((input) => failedKeys.has(input.clientKey));
          setItemFailures(
            results.items
              .filter((item) => item.errorCode)
              .map((item) => ({
                key: item.clientKey,
                position: inputs.findIndex((input) => input.clientKey === item.clientKey) + 1,
                message: t(`files.errors.${downloadBatchError(item.errorCode)}`),
              })),
          );
          onCreated();
          if (failed.length) {
            pendingInputs.current = failed;
            setLinks(failed.map((input) => input.uri).join('\n'));
            setFailure(t('files.downloads.createPartial'));
            partial = true;
            throw new FilesError('conflict');
          }
        } catch (error) {
          if (!partial)
            setFailure(
              t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
            );
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        {itemFailures.length ? (
          <ul role="status" className="space-y-2 text-sm text-danger">
            {itemFailures.map((item) => (
              <li key={item.key}>
                {item.position}. {item.message}
              </li>
            ))}
          </ul>
        ) : null}
        <TextAreaField
          label={t('files.downloads.links')}
          placeholder={t('files.downloads.linksPlaceholder')}
          value={links}
          rows={4}
          onChange={(event) => {
            changed();
            setLinks(event.target.value);
          }}
        />
        {lines.length > limit ? (
          <p role="alert" className="text-danger">
            {t('files.downloads.limit', { count: limit })}
          </p>
        ) : null}
        {lines.length <= 1 ? (
          <TextField
            label={t('files.downloads.name')}
            hint={t('files.downloads.nameHint')}
            value={name}
            onChange={(event) => {
              changed();
              setName(event.target.value);
            }}
          />
        ) : null}
        <DownloadFolders
          parent={parent}
          onChange={(value) => {
            changed();
            setParent(value);
          }}
          onReady={setReady}
        />
      </div>
    </DialogSurface>
  );
}

export function DownloadTargetDialog({
  task,
  onClose,
  onSaved,
}: Readonly<{ task: OfflineDownload; onClose(): void; onSaved(): void }>) {
  const port = useDownloads(),
    { t } = useFrontendTranslation();
  const [parent, setParent] = useState(task.parentId),
    [name, setName] = useState(task.name),
    [ready, setReady] = useState(false),
    [failure, setFailure] = useState('');
  const [current, setCurrent] = useState(task);
  return (
    <DialogSurface
      triggerLabel={t('files.downloads.retarget')}
      title={t('files.downloads.retarget')}
      description={t('files.downloads.retargetHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.downloads.confirm')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      confirmDisabled={!ready || !name.trim()}
      failureMessage={failure}
      onConfirm={async () => {
        try {
          await port.retarget(current, parent, name);
          onSaved();
        } catch (error) {
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        <TextField
          label={t('files.downloads.targetName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <DownloadFolders parent={parent} onChange={setParent} onReady={setReady} />
        <Action
          variant="secondary"
          onPress={() => {
            void port
              .read(current)
              .then((value) => {
                setCurrent(value);
                setFailure('');
              })
              .catch((error: unknown) =>
                setFailure(
                  t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
                ),
              );
          }}
        >
          {t('files.downloads.readLatest')}
        </Action>
      </div>
    </DialogSurface>
  );
}
