'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField, TextAreaField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { FileMedia, usePublicFiles } from '../../../src/files/runtime';
import { FilesError, type PublicFileEntry } from '../../../src/files/model';
import { publicMediaEntry, publicTextEntry } from './public-entry';

export function PublicCreateDialog({
  kind,
  parent,
  onClose,
  onSaved,
}: Readonly<{
  kind: 'folder' | 'text' | 'markdown';
  parent: string;
  onClose(): void;
  onSaved(): void;
}>) {
  const port = usePublicFiles(),
    { t } = useFrontendTranslation();
  const [name, setName] = useState(''),
    [text, setText] = useState(''),
    [clientKey] = useState(() => port.newClientKey()),
    [failure, setFailure] = useState('');
  const title = t(
    `publicFiles.collaboration.${kind === 'folder' ? 'newFolder' : kind === 'text' ? 'newText' : 'newMarkdown'}`,
  );
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={t('publicFiles.collaboration.scopeHint')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      cancelLabel={t('publicFiles.collaboration.cancel')}
      confirmLabel={t('publicFiles.collaboration.save')}
      confirmDisabled={!name.trim()}
      failureMessage={failure}
      onConfirm={async () => {
        try {
          if (kind === 'folder') await port.createFolder(parent, name);
          else await port.createText({ parentId: parent, name, text, clientKey });
          onSaved();
        } catch (error) {
          setFailure(
            t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          );
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        <TextField
          label={t('publicFiles.collaboration.name')}
          value={name}
          {...(kind === 'folder'
            ? {}
            : { placeholder: kind === 'markdown' ? 'notes.md' : 'notes.txt' })}
          onChange={(event) => setName(event.target.value)}
        />
        {kind !== 'folder' ? (
          <TextAreaField
            label={t('publicFiles.collaboration.text')}
            value={text}
            rows={10}
            onChange={(event) => setText(event.target.value)}
          />
        ) : null}
      </div>
    </DialogSurface>
  );
}

export function PublicPreviewDialog({
  entry,
  edit,
  maxBytes,
  onClose,
  onSaved,
}: Readonly<{
  entry: PublicFileEntry;
  edit: boolean;
  maxBytes: number;
  onClose(): void;
  onSaved(): void;
}>) {
  const port = usePublicFiles(),
    { t } = useFrontendTranslation();
  const [current, setCurrent] = useState(entry),
    [draft, setDraft] = useState(''),
    [latest, setLatest] = useState<string>(),
    [loading, setLoading] = useState(publicTextEntry(entry)),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!publicTextEntry(entry)) return;
    const controller = new AbortController();
    void port
      .readText(entry, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setCurrent(result.entry);
        setLatest(result.text);
        if (revision === 0) setDraft(result.text);
        else setNotice(t('publicFiles.collaboration.latestRead'));
        setFailure('');
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(
            t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [port, entry, revision, t]);
  const textEntry = publicTextEntry(entry),
    title = t(`publicFiles.collaboration.${edit ? 'edit' : 'preview'}`);
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={entry.name}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      cancelLabel={t('publicFiles.collaboration.close')}
      {...(edit && textEntry
        ? {
            confirmLabel: t('publicFiles.collaboration.save'),
            confirmDisabled: loading || latest === undefined,
            onConfirm: async () => {
              try {
                await port.replaceText(current, draft);
                onSaved();
              } catch (error) {
                setFailure(
                  t(
                    `publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`,
                  ),
                );
                throw error;
              }
            },
          }
        : {})}
      failureMessage={failure}
    >
      <div className="space-y-4">
        {failure ? (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        {loading ? (
          <p role="status">{t('publicFiles.collaboration.loadingText')}</p>
        ) : textEntry ? (
          edit ? (
            <TextAreaField
              label={t('publicFiles.collaboration.text')}
              value={draft}
              rows={14}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-control bg-surface-muted p-4 text-sm">
              {latest || t('publicFiles.collaboration.emptyPreview')}
            </pre>
          )
        ) : publicMediaEntry(entry) ? (
          <FileMedia
            entry={entry}
            mode="preview"
            maxBytes={maxBytes}
            labels={{
              loading: t('publicFiles.collaboration.mediaLoading'),
              unsupported: t('publicFiles.collaboration.mediaUnsupported'),
              tooLarge: t('publicFiles.collaboration.mediaTooLarge'),
              retry: t('publicFiles.collaboration.retry'),
            }}
          />
        ) : (
          <p>{t('publicFiles.collaboration.previewUnavailable')}</p>
        )}
        {textEntry ? (
          <Action
            variant="quiet"
            disabled={loading}
            onPress={() => {
              setLoading(true);
              setRevision((value) => value + 1);
            }}
          >
            {t('publicFiles.collaboration.readLatest')}
          </Action>
        ) : null}
        {edit && latest !== undefined && notice ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words bg-surface-muted p-3 text-sm">
            {latest}
          </pre>
        ) : null}
      </div>
    </DialogSurface>
  );
}
