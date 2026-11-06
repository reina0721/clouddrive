'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFileTime } from './use-file-time';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DrawerSurface, DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useFiles, FileMedia } from '../../../src/files/runtime';
import { FilesError, type FileEntry } from '../../../src/files/model';
import {
  type FileVersion,
  type FileVersionPage,
  type VersionOrder,
} from '../../../src/files/versions';
import { formatFileBytes as bytes } from '../../../src/files/format';

import { isPDFDocument } from '../../../src/files/pdf-contract';
const PdfDialog = lazy(() =>
  import('./pdf-dialog').then((module) => ({ default: module.PdfDialog })),
);
type Props = { entry: FileEntry; onClose: () => void; onSaved: () => void };
type Confirmation =
  | { kind: 'restore'; version: FileVersion }
  | { kind: 'copy'; version: FileVersion }
  | { kind: 'delete'; mode: 'selected' | 'all-history'; revisions: number[] };
type Preview = { mode: 'text' | 'compare' | 'media' | 'pdf'; version: FileVersion };
const readableText = (v: Pick<FileVersion, 'mediaType' | 'name'>) =>
  v.mediaType.startsWith('text/') || /\.(txt|md|json|csv|xml|html|css|js|log)$/i.test(v.name);

export function VersionsPanel(props: Props) {
  const [revision, setRevision] = useState(0);
  return (
    <VersionPanelContent
      key={props.entry.id + ':' + revision}
      {...props}
      onRefresh={() => setRevision((value) => value + 1)}
    />
  );
}
function VersionPanelContent({
  entry,
  onClose,
  onSaved,
  onRefresh,
}: Props & { onRefresh: () => void }) {
  const port = useFiles().versions,
    { t } = useFrontendTranslation();
  const time = useFileTime();
  const [snapshot, setSnapshot] = useState<FileVersionPage>(),
    [page, setPage] = useState(1),
    [order, setOrder] = useState<VersionOrder>('newest'),
    [reading, setReading] = useState(true),
    [failure, setFailure] = useState<unknown>(),
    [selected, setSelected] = useState<number[]>([]),
    [confirmation, setConfirmation] = useState<Confirmation>(),
    [preview, setPreview] = useState<Preview>(),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  useEffect(() => {
    const controller = new AbortController();
    void port
      .read(entry.id, page, order, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        const last = Math.max(1, Math.ceil(value.total / value.pageSize));
        if (page > last) {
          setPage(last);
          return;
        }
        setSnapshot(value);
        setReading(false);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setFailure(error);
          setReading(false);
        }
      });
    return () => controller.abort();
  }, [entry.id, port, page, order]);
  const chosen = confirmation;
  const pages = snapshot ? Math.max(1, Math.ceil(snapshot.total / snapshot.pageSize)) : 1;
  const rowEntries = snapshot?.items.filter((item) => !item.current) ?? [];
  const mutation = snapshot
    ? {
        expectedContentRevision: snapshot.contentRevision,
        expectedHistoryRevision: snapshot.historyRevision,
      }
    : undefined;
  async function confirm() {
    if (!chosen || !mutation || !snapshot || pending.current) return;
    pending.current = true;
    setBusy(true);
    setFailure(undefined);
    try {
      if (chosen.kind === 'restore')
        await port.restore(entry.id, chosen.version.revision, mutation);
      else if (chosen.kind === 'copy')
        await port.copy(entry.id, chosen.version.revision, snapshot.entry.parentId, name);
      else
        await port.remove(entry.id, {
          ...mutation,
          mode: chosen.mode,
          revisions: chosen.revisions,
        });
      onSaved();
      onRefresh();
    } catch (error) {
      setFailure(error);
      throw error;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function copy(version: FileVersion) {
    setName(t('files.copyName', { name: version.name }));
    setFailure(undefined);
    setConfirmation({ kind: 'copy', version });
  }
  return (
    <>
      <DrawerSurface
        triggerLabel={t('files.versions.title')}
        title={snapshot?.entry.name ?? entry.name}
        description={t('files.versions.privateHint')}
        closeLabel={t('files.close')}
        isOpen
        onOpenChange={(open) => {
          if (!open && !pending.current) onClose();
        }}
      >
        <div className="min-w-0 space-y-4">
          <h2 className="text-lg font-semibold">{t('files.versions.title')}</h2>
          {failure !== undefined ? (
            <p role="alert" className="text-sm text-danger">
              {errorText(failure)}
            </p>
          ) : null}
          <Action size="sm" variant="quiet" disabled={busy} onPress={onRefresh}>
            {t('files.versions.refresh')}
          </Action>
          {reading ? <p role="status">{t('files.versions.loading')}</p> : null}
          {snapshot ? (
            <>
              <div className="space-y-2 rounded-control border border-border p-3 text-xs text-ink-muted">
                <p>
                  {t(
                    snapshot.historyApplies
                      ? 'files.retention.applies'
                      : 'files.retention.excluded',
                  )}
                </p>
                <p>
                  {snapshot.historyPreferences.maxVersions > 0
                    ? t('files.retention.count', { count: snapshot.historyPreferences.maxVersions })
                    : t('files.retention.unlimited')}
                </p>
                <p>
                  {t('files.versions.storage', {
                    current: bytes(snapshot.entry.sizeBytes),
                    history: bytes(snapshot.fileHistoryBytes),
                    ownerHistory: bytes(snapshot.ownerHistoryBytes),
                    used: bytes(snapshot.ownerUsedBytes),
                    quota: bytes(snapshot.quotaBytes),
                  })}
                </p>
                <p>
                  {t('files.versions.limits', {
                    perFile: snapshot.perFile,
                    perOwner: snapshot.perOwner,
                  })}
                </p>
              </div>
              <SelectField
                label={t('files.versions.order')}
                value={order}
                disabled={reading}
                onValueChange={(value) => {
                  if (value === order && page === 1) return;
                  setReading(true);
                  setPage(1);
                  setOrder(value as VersionOrder);
                }}
                options={[
                  { value: 'newest', label: t('files.versions.newest') },
                  { value: 'oldest', label: t('files.versions.oldest') },
                ]}
              />
              <CheckboxField
                label={t('files.versions.selectPage')}
                disabled={reading || !rowEntries.length}
                checked={
                  !!rowEntries.length &&
                  rowEntries.every((item) => selected.includes(item.revision))
                }
                onCheckedChange={(checked) =>
                  setSelected((current) =>
                    checked
                      ? [...new Set([...current, ...rowEntries.map((item) => item.revision)])]
                      : current.filter(
                          (revision) => !rowEntries.some((item) => item.revision === revision),
                        ),
                  )
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs">
                  {t('files.versions.selected', { count: selected.length })}
                </span>
                <Action
                  size="sm"
                  variant="danger"
                  disabled={reading || !selected.length}
                  onPress={() => {
                    setFailure(undefined);
                    setConfirmation({ kind: 'delete', mode: 'selected', revisions: [...selected] });
                  }}
                >
                  {t('files.versions.removeSelected')}
                </Action>
                <Action
                  size="sm"
                  variant="quiet"
                  disabled={reading || snapshot.total < 2}
                  onPress={() => {
                    setFailure(undefined);
                    setConfirmation({ kind: 'delete', mode: 'all-history', revisions: [] });
                  }}
                >
                  {t('files.versions.clear')}
                </Action>
              </div>
              <ol className="space-y-3" aria-label={t('files.versions.title')}>
                {snapshot.items.map((version) => (
                  <li
                    key={version.revision}
                    data-file-version={version.revision}
                    className="space-y-3 rounded-panel border border-border p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        {t('files.versions.version', { revision: version.revision })}
                      </h3>
                      {version.current ? (
                        <span className="rounded-control bg-brand-soft px-2 py-1 text-xs text-brand">
                          {t('files.versions.current')}
                        </span>
                      ) : (
                        <CheckboxField
                          label={t('files.versions.select', { revision: version.revision })}
                          presentation="control-only"
                          checked={selected.includes(version.revision)}
                          disabled={reading}
                          onCheckedChange={(checked) =>
                            setSelected((current) =>
                              checked
                                ? [...new Set([...current, version.revision])]
                                : current.filter((value) => value !== version.revision),
                            )
                          }
                        />
                      )}
                    </div>
                    <p className="break-words text-xs text-ink-muted">
                      {t('files.versions.metadata', {
                        name: version.name,
                        size: bytes(version.sizeBytes),
                        type: version.mediaType,
                      })}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {t('files.versions.time')}：{time.full(version.updatedAt)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Action
                        size="sm"
                        variant="secondary"
                        disabled={reading}
                        onPress={() => {
                          void port
                            .download(entry.id, version)
                            .catch((error: unknown) => setFailure(error));
                        }}
                      >
                        {t('files.versions.download')}
                      </Action>
                      <Action
                        size="sm"
                        variant="quiet"
                        disabled={reading}
                        onPress={() =>
                          setPreview({
                            mode: isPDFDocument(version)
                              ? 'pdf'
                              : /^(image|audio|video)\//.test(version.mediaType)
                                ? 'media'
                                : 'text',
                            version,
                          })
                        }
                      >
                        {t('files.versions.preview')}
                      </Action>
                      {!version.current ? (
                        <>
                          <Action
                            size="sm"
                            variant="quiet"
                            disabled={reading}
                            onPress={() => {
                              setFailure(undefined);
                              setConfirmation({ kind: 'restore', version });
                            }}
                          >
                            {t('files.versions.restore')}
                          </Action>
                          <Action
                            size="sm"
                            variant="quiet"
                            disabled={reading}
                            onPress={() => copy(version)}
                          >
                            {t('files.versions.copy')}
                          </Action>
                          <Action
                            size="sm"
                            variant="danger"
                            disabled={reading}
                            onPress={() => {
                              setFailure(undefined);
                              setConfirmation({
                                kind: 'delete',
                                mode: 'selected',
                                revisions: [version.revision],
                              });
                            }}
                          >
                            {t('files.versions.remove')}
                          </Action>
                          {readableText(version) && readableText(snapshot.entry) ? (
                            <Action
                              size="sm"
                              variant="quiet"
                              disabled={reading}
                              onPress={() => setPreview({ mode: 'compare', version })}
                            >
                              {t('files.versions.compare')}
                            </Action>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={reading || page <= 1}
                  onPress={() => {
                    setReading(true);
                    setPage(page - 1);
                  }}
                >
                  {t('files.versions.previous')}
                </Action>
                <span className="text-xs">
                  {t('files.versions.page', { page, pages, count: snapshot.total })}
                </span>
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={reading || page >= pages}
                  onPress={() => {
                    setReading(true);
                    setPage(page + 1);
                  }}
                >
                  {t('files.versions.next')}
                </Action>
              </div>
            </>
          ) : null}
        </div>
      </DrawerSurface>
      {chosen && snapshot ? (
        <DialogSurface
          triggerLabel={t('files.versions.title')}
          title={t(
            chosen.kind === 'restore'
              ? 'files.versions.restore'
              : chosen.kind === 'copy'
                ? 'files.versions.copy'
                : 'files.versions.removeSelected',
          )}
          description={t(
            chosen.kind === 'restore'
              ? 'files.versions.restoreHint'
              : chosen.kind === 'copy'
                ? 'files.versions.copyHint'
                : 'files.versions.removeHint',
          )}
          cancelLabel={t('files.cancel')}
          confirmLabel={t('files.confirm')}
          failureMessage={errorText(failure)}
          isOpen
          onOpenChange={(open) => {
            if (!open && !pending.current) setConfirmation(undefined);
          }}
          onConfirm={confirm}
        >
          {chosen.kind === 'copy' ? (
            <TextField
              label={t('files.versions.copyName')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : (
            <p className="break-words text-sm">
              {chosen.kind === 'restore'
                ? t('files.versions.version', { revision: chosen.version.revision })
                : chosen.mode === 'all-history'
                  ? t('files.versions.clear')
                  : chosen.revisions
                      .map((revision) => t('files.versions.version', { revision }))
                      .join('、')}
            </p>
          )}
        </DialogSurface>
      ) : null}
      {preview?.mode === 'pdf' && snapshot ? (
        <Suspense fallback={<p role="status">{preview.version.name}</p>}>
          <PdfDialog
            entry={{
              ...snapshot.entry,
              name: preview.version.name,
              sizeBytes: preview.version.sizeBytes,
              mediaType: preview.version.mediaType,
              contentRevision: preview.version.revision,
            }}
            version={preview.version.revision}
            limits={snapshot.pdfReader}
            onClose={() => setPreview(undefined)}
          />
        </Suspense>
      ) : null}
      {preview && preview.mode !== 'pdf' && snapshot ? (
        <DialogSurface
          triggerLabel={t('files.versions.preview')}
          title={t(
            preview.mode === 'compare' ? 'files.versions.compareTitle' : 'files.versions.textTitle',
            { revision: preview.version.revision },
          )}
          description={t(
            preview.mode === 'media' ? 'files.versions.mediaHint' : 'files.versions.textHint',
          )}
          cancelLabel={t('files.versions.closePreview')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setPreview(undefined);
          }}
        >
          {preview.mode === 'media' ? (
            preview.version.sizeBytes > snapshot.maxMediaBytes ? (
              <p>{t('files.mediaTooLarge')}</p>
            ) : (
              <FileMedia
                key={entry.id + ':' + preview.version.revision}
                entry={{
                  ...snapshot.entry,
                  name: preview.version.name,
                  sizeBytes: preview.version.sizeBytes,
                  mediaType: preview.version.mediaType,
                  contentRevision: preview.version.revision,
                }}
                mode="preview"
                version={preview.version.revision}
                maxBytes={snapshot.maxMediaBytes}
              />
            )
          ) : (
            <VersionTextView
              key={preview.mode + ':' + preview.version.revision}
              entryId={entry.id}
              preview={preview}
              current={{
                revision: snapshot.contentRevision,
                current: true,
                name: snapshot.entry.name,
                sizeBytes: snapshot.entry.sizeBytes,
                mediaType: snapshot.entry.mediaType,
                updatedAt: snapshot.entry.updatedAt,
              }}
              maxBytes={snapshot.maxTextBytes}
            />
          )}
        </DialogSurface>
      ) : null}
    </>
  );
}
function VersionTextView({
  entryId,
  preview,
  current,
  maxBytes,
}: {
  entryId: string;
  preview: Preview;
  current: FileVersion;
  maxBytes: number;
}) {
  const port = useFiles().versions,
    { t } = useFrontendTranslation();
  const [value, setValue] = useState<readonly string[]>(),
    [failure, setFailure] = useState<unknown>(),
    [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const targets = preview.mode === 'compare' ? [preview.version, current] : [preview.version];
    void Promise.all(
      targets.map((version) => port.text(entryId, version, maxBytes, controller.signal)),
    )
      .then((text) => {
        if (!controller.signal.aborted) setValue(text);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [port, entryId, preview.mode, preview.version, current, maxBytes, attempt]);
  return (
    <div className="min-w-0 space-y-3">
      {loading ? <p role="status">{t('files.loading')}</p> : null}
      {failure !== undefined ? (
        <>
          <p role="alert">
            {t(`files.errors.${failure instanceof FilesError ? failure.code : 'unavailable'}`)}
          </p>
          <Action
            size="sm"
            onPress={() => {
              setFailure(undefined);
              setLoading(true);
              setAttempt((number) => number + 1);
            }}
          >
            {t('files.retry')}
          </Action>
        </>
      ) : null}
      {value ? (
        <div
          className={
            preview.mode === 'compare' ? 'grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2' : 'min-w-0'
          }
        >
          {value.map((text, index) => (
            <section key={index} className="min-w-0">
              <h3 className="mb-2 text-sm font-semibold">
                {t(index === 0 ? 'files.versions.version' : 'files.versions.compareCurrent', {
                  revision: index === 0 ? preview.version.revision : current.revision,
                })}
              </h3>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-control border border-border p-3 text-xs">
                {text}
              </pre>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
