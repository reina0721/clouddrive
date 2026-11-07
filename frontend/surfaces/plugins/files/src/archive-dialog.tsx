'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import {
  CheckboxField,
  PasswordField,
  SelectField,
  TextField,
} from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { FilesError, type FileEntry, type FileListing } from '../../../src/files/model';
import type {
  ArchiveAccess,
  ArchiveConflict,
  ArchiveImageLease,
  ArchiveManifest,
  ArchiveMember,
  ArchiveReceipt,
  ArchiveSelection,
  ArchiveTask,
} from '../../../src/files/archives';
import { useArchives, useFiles } from '../../../src/files/runtime';
import { formatFileBytes as bytes } from '../../../src/files/format';
import { FileGlyph } from '../../../src/files/icons';
import { OwnFolderPicker } from './own-folder-picker';

function parentPath(name: string) {
  const slash = name.lastIndexOf('/');
  return slash < 0 ? '' : name.slice(0, slash);
}
function ArchiveMemberPreview({
  access,
  member,
  kind,
  manifest,
  onClose,
}: {
  access: ArchiveAccess;
  member: ArchiveMember;
  kind: 'text' | 'image';
  manifest: ArchiveManifest;
  onClose: () => void;
}) {
  const port = useArchives(),
    { t } = useFrontendTranslation();
  const [result, setResult] = useState<{ text?: string; image?: string; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    let owned: ArchiveImageLease | undefined;
    void (async () => {
      try {
        if (kind === 'text') {
          const text = await port.text(access, member, manifest.maxTextBytes, controller.signal);
          if (!controller.signal.aborted) setResult({ text });
        } else {
          const lease = await port.image(access, member, manifest.maxImageBytes, controller.signal);
          if (controller.signal.aborted) {
            lease.release();
            return;
          }
          owned = lease;
          setResult({ image: lease.url });
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            error: t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
          });
      }
    })();
    return () => {
      controller.abort();
      owned?.release();
    };
  }, [port, access, member, kind, manifest.maxTextBytes, manifest.maxImageBytes, t]);
  return (
    <section
      aria-label={t('files.preview')}
      className="space-y-3 rounded-panel border border-border p-3"
    >
      <h3 className="break-words font-semibold">{member.path}</h3>
      {!result ? (
        <p role="status">{t('files.previewLoading')}</p>
      ) : result.error ? (
        <p role="alert">{result.error}</p>
      ) : result.image ? (
        <img
          src={result.image}
          alt={member.path}
          className="max-h-screen max-w-full object-contain"
          onError={() => setResult({ error: t('files.archives.imageFailed') })}
        />
      ) : (
        <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm">
          {result.text}
        </pre>
      )}
      <Action size="sm" variant="quiet" onPress={onClose}>
        {t('files.archives.closePreview')}
      </Action>
    </section>
  );
}
function ArchiveExtractDialog({
  access,
  selection,
  initialParent,
  onClose,
  onSaved,
  onQueued,
}: {
  access: ArchiveAccess;
  selection: ArchiveSelection;
  initialParent: string;
  onClose: () => void;
  onSaved: (receipt: ArchiveReceipt) => void;
  onQueued: (task: ArchiveTask) => void;
}) {
  const port = useArchives(),
    { t } = useFrontendTranslation();
  const [parent, setParent] = useState(initialParent),
    [listing, setListing] = useState<FileListing>(),
    [folderName, setFolderName] = useState(''),
    [conflict, setConflict] = useState<ArchiveConflict>('reject'),
    [background, setBackground] = useState(false),
    [failure, setFailure] = useState('');
  const controller = useRef<AbortController | undefined>(undefined);
  const submission = useRef<{ request: string; key: string } | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  return (
    <DialogSurface
      isOpen
      triggerLabel={t('files.archives.extract')}
      title={t('files.archives.extract')}
      description={t('files.archives.targetHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t(background ? 'files.archives.tasks.queue' : 'files.archives.confirm')}
      confirmDisabled={!listing}
      failureMessage={failure}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={async () => {
        controller.current?.abort();
        const pending = new AbortController();
        controller.current = pending;
        setFailure('');
        try {
          const input = { selection, parentId: parent, folderName, conflict };
          if (background && !access.password) {
            const source = { id: access.id, expectedRevision: access.expectedRevision };
            const request = JSON.stringify([source, input]);
            if (submission.current?.request !== request) {
              submission.current = { request, key: port.newTaskKey() };
            }
            const task = await port.queue(source, input, submission.current.key, pending.signal);
            if (!pending.signal.aborted) onQueued(task);
            return;
          }
          const receipt = await port.extract(access, input, pending.signal);
          if (!pending.signal.aborted) onSaved(receipt);
        } catch (error) {
          if (!pending.signal.aborted)
            setFailure(
              t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
            );
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        <OwnFolderPicker value={parent} onChange={setParent} onListing={setListing} />
        <TextField
          label={t('files.archives.folderName')}
          value={folderName}
          onChange={(event) => setFolderName(event.target.value)}
        />
        <SelectField
          label={t('files.archives.conflict')}
          value={conflict}
          onValueChange={(value) => {
            if (value === 'reject' || value === 'skip' || value === 'rename') setConflict(value);
          }}
          options={(['reject', 'skip', 'rename'] as const).map((value) => ({
            value,
            label: t('files.archives.' + value),
          }))}
        />
        {access.password ? null : (
          <CheckboxField
            label={t('files.archives.tasks.background')}
            checked={background}
            onCheckedChange={setBackground}
          />
        )}
        <p className="text-sm text-ink-muted">
          {t(background ? 'files.archives.tasks.queueHint' : 'files.archives.noAutomaticRetry')}
        </p>
      </div>
    </DialogSurface>
  );
}
export function ArchiveDialog({
  entry,
  onClose,
  onChanged,
}: {
  entry: FileEntry;
  onClose: () => void;
  onChanged: () => void;
}) {
  const port = useArchives(),
    files = useFiles(),
    { t } = useFrontendTranslation();
  const [password, setPassword] = useState(''),
    [appliedPassword, setAppliedPassword] = useState(''),
    [attempt, setAttempt] = useState(0),
    [manifest, setManifest] = useState<ArchiveManifest>(),
    [failure, setFailure] = useState(''),
    [folder, setFolder] = useState(''),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('name-asc'),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [extract, setExtract] = useState<ArchiveSelection>(),
    [receipt, setReceipt] = useState<ArchiveReceipt>(),
    [queued, setQueued] = useState<ArchiveTask>(),
    [preview, setPreview] = useState<{ member: ArchiveMember; kind: 'text' | 'image' }>();
  const pending = useRef<AbortController | undefined>(undefined);
  const access = useMemo<ArchiveAccess>(
    () => ({ id: entry.id, expectedRevision: entry.contentRevision, password: appliedPassword }),
    [entry.id, entry.contentRevision, appliedPassword],
  );
  const errorText = useCallback(
    (error: unknown) =>
      error instanceof FilesError && error.code === 'conflict'
        ? t('files.archives.sourceConflict')
        : t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
    [t],
  );
  useEffect(() => {
    const controller = new AbortController();
    void port
      .inspect(access, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setManifest(result);
          setFailure('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setFailure(errorText(error));
      });
    return () => controller.abort();
  }, [port, access, attempt, errorText]);
  useEffect(() => () => pending.current?.abort(), []);
  const visible = (manifest?.members ?? [])
    .filter((member) =>
      search
        ? member.path.toLocaleLowerCase().includes(search.toLocaleLowerCase())
        : parentPath(member.path) === folder,
    )
    .sort((a, b) => {
      const order = sort.startsWith('size')
        ? a.sizeBytes - b.sizeBytes || a.path.localeCompare(b.path)
        : a.path.localeCompare(b.path);
      return sort.endsWith('desc') ? -order : order;
    });
  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setNotice('');
    try {
      await action(controller.signal);
      if (!controller.signal.aborted) setNotice(t('files.operationDone'));
    } catch (error) {
      if (!controller.signal.aborted) setNotice(errorText(error));
    } finally {
      if (pending.current === controller) pending.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function move(name: string) {
    setFolder(name);
    setSearch('');
    setPreview(undefined);
  }
  const selection: ArchiveSelection = { mode: 'selected', paths: selected };
  return (
    <>
      <DialogSurface
        isOpen
        triggerLabel={t('files.archives.title')}
        title={entry.name}
        size="cover"
        description={t('files.archives.hint')}
        cancelLabel={t('files.close')}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <div className="space-y-4">
          {manifest?.format === '7z' || /\.7z$/i.test(entry.name) ? (
            <PasswordField
              label={t('files.archives.password')}
              purpose="transient"
              showLabel={t('files.archives.showPassword')}
              hideLabel={t('files.archives.hidePassword')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          ) : null}
          <Action
            size="sm"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setAppliedPassword(password);
              setAttempt((value) => value + 1);
              setManifest(undefined);
              setFailure('');
              setPreview(undefined);
            }}
          >
            {t(manifest ? 'files.archives.refresh' : 'files.archives.open')}
          </Action>
          {failure ? (
            <p role="alert">{failure}</p>
          ) : !manifest ? (
            <p role="status">{t('files.archives.working')}</p>
          ) : null}
          {notice ? <p role="status">{notice}</p> : null}
          {manifest ? (
            <>
              <p className="text-sm">
                {t('files.archives.format', {
                  format: manifest.format.toUpperCase(),
                  count: manifest.members.length,
                  bytes: bytes(manifest.totalBytes),
                })}
              </p>
              <p className="text-xs text-ink-muted">
                {t('files.archives.limits', {
                  bytes: bytes(manifest.maxBytes),
                  count: manifest.maxMembers,
                })}
              </p>
              <nav aria-label={t('files.archives.root')} className="flex flex-wrap gap-2">
                <Action size="sm" variant="quiet" onPress={() => move('')}>
                  {t('files.archives.root')}
                </Action>
                {folder
                  .split('/')
                  .filter(Boolean)
                  .map((name, index, parts) => (
                    <Action
                      key={parts.slice(0, index + 1).join('/')}
                      size="sm"
                      variant="quiet"
                      onPress={() => move(parts.slice(0, index + 1).join('/'))}
                    >
                      {name}
                    </Action>
                  ))}
              </nav>
              {folder ? (
                <Action size="sm" variant="quiet" onPress={() => move(parentPath(folder))}>
                  {t('files.archives.up')}
                </Action>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <SearchBox
                  label={t('files.archives.search')}
                  placeholder={t('files.archives.search')}
                  value={search}
                  onValueChange={setSearch}
                />
                <SelectField
                  label={t('files.archives.sort')}
                  value={sort}
                  onValueChange={(value) => {
                    if (['name-asc', 'name-desc', 'size-asc', 'size-desc'].includes(value))
                      setSort(value);
                  }}
                  options={(['name-asc', 'name-desc', 'size-asc', 'size-desc'] as const).map(
                    (value) => ({
                      value,
                      label: t(
                        'files.archives.' +
                          {
                            'name-asc': 'nameAsc',
                            'name-desc': 'nameDesc',
                            'size-asc': 'sizeAsc',
                            'size-desc': 'sizeDesc',
                          }[value],
                      ),
                    }),
                  )}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Action
                  size="sm"
                  variant="quiet"
                  disabled={busy || !visible.length}
                  onPress={() =>
                    setSelected((current) =>
                      Array.from(new Set([...current, ...visible.map((member) => member.path)])),
                    )
                  }
                >
                  {t('files.archives.selectAll')}
                </Action>
                <Action
                  size="sm"
                  variant="quiet"
                  disabled={busy || !selected.length}
                  onPress={() => setSelected([])}
                >
                  {t('files.archives.clear')}
                </Action>
                <span className="text-sm">
                  {t('files.archives.selected', { count: selected.length })}
                </span>
              </div>
              <ul className="space-y-3">
                {visible.map((member) => (
                  <li
                    key={member.path}
                    data-archive-path={member.path}
                    className="space-y-2 rounded-control border border-border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0">
                        <CheckboxField
                          presentation="control-only"
                          label={t('files.archives.select', { name: member.path })}
                          checked={selected.includes(member.path)}
                          onCheckedChange={(checked) =>
                            setSelected((current) =>
                              checked
                                ? [...current.filter((value) => value !== member.path), member.path]
                                : current.filter((value) => value !== member.path),
                            )
                          }
                        />
                      </span>
                      <FileGlyph kind={member.kind} mediaType="" size="small" />
                      <Action
                        size="sm"
                        variant="quiet"
                        disabled={busy}
                        onPress={() =>
                          member.kind === 'folder'
                            ? move(member.path)
                            : setPreview({ member, kind: 'text' })
                        }
                      >
                        {search ? member.path : member.path.split('/').at(-1)}
                      </Action>
                      <span className="text-xs text-ink-muted">{bytes(member.sizeBytes)}</span>
                    </div>
                    {member.kind === 'file' ? (
                      <div className="flex flex-wrap gap-2">
                        <Action
                          size="sm"
                          variant="quiet"
                          disabled={busy}
                          onPress={() => setPreview({ member, kind: 'text' })}
                        >
                          {t('files.archives.previewText')}
                        </Action>
                        <Action
                          size="sm"
                          variant="quiet"
                          disabled={busy}
                          onPress={() => setPreview({ member, kind: 'image' })}
                        >
                          {t('files.archives.previewImage')}
                        </Action>
                        <Action
                          size="sm"
                          variant="quiet"
                          disabled={busy}
                          onPress={() =>
                            void perform((signal) => port.download(access, member, signal))
                          }
                        >
                          {t('files.archives.download')}
                        </Action>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {!visible.length ? <p>{t('files.archives.empty')}</p> : null}
              {preview ? (
                <ArchiveMemberPreview
                  key={preview.member.path + ':' + preview.kind}
                  {...preview}
                  access={access}
                  manifest={manifest}
                  onClose={() => setPreview(undefined)}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={busy || !selected.length}
                  onPress={() =>
                    void perform((signal) => port.downloadSelection(access, selection, signal))
                  }
                >
                  {t('files.archives.downloadSelected')}
                </Action>
                <Action
                  size="sm"
                  disabled={busy || !manifest.members.length}
                  onPress={() => setExtract({ mode: 'all', paths: [] })}
                >
                  {t('files.archives.extractAll')}
                </Action>
                <Action
                  size="sm"
                  disabled={busy || !selected.length}
                  onPress={() => setExtract(selection)}
                >
                  {t('files.archives.extractSelected')}
                </Action>
              </div>
            </>
          ) : null}
          {queued ? (
            <section className="mt-4 space-y-2 rounded-panel border border-border p-3">
              <p role="status">
                {t('files.archives.tasks.submitted', { name: queued.sourceName })}
              </p>
              <Action
                variant="secondary"
                onPress={() => {
                  files.navigate('tasks');
                  onClose();
                }}
              >
                {t('files.archives.tasks.open')}
              </Action>
            </section>
          ) : null}
          {receipt ? (
            <section
              aria-label={t('files.archives.receipt')}
              className="space-y-3 rounded-panel border border-border p-3"
            >
              <h2 className="font-semibold">{t('files.archives.receipt')}</h2>
              <p>{t('files.archives.created', { count: receipt.created.length })}</p>
              <p>{t('files.archives.skipped', { count: receipt.skipped.length })}</p>
              <p>{t('files.archives.renamed', { count: receipt.renamed.length })}</p>
              <ul className="max-h-60 overflow-y-auto text-sm">
                {receipt.skipped.map((name) => (
                  <li key={name}>{name}</li>
                ))}
                {receipt.renamed.map((item) => (
                  <li key={item.path}>{t('files.archives.renamePath', item)}</li>
                ))}
              </ul>
              <Action
                variant="secondary"
                onPress={() => {
                  files.openFolder(receipt.destinationId);
                  onClose();
                }}
              >
                {t('files.archives.openTarget')}
              </Action>
            </section>
          ) : null}
        </div>
      </DialogSurface>
      {extract ? (
        <ArchiveExtractDialog
          access={access}
          selection={extract}
          initialParent={entry.parentId}
          onClose={() => setExtract(undefined)}
          onSaved={(result) => {
            setQueued(undefined);
            setReceipt(result);
            onChanged();
            setExtract(undefined);
          }}
          onQueued={(task) => {
            setReceipt(undefined);
            setQueued(task);
            setExtract(undefined);
          }}
        />
      ) : null}
    </>
  );
}
