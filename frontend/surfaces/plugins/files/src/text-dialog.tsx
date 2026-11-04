'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { TextField, TextAreaField } from '@clouddrive/ui-adapter/form-field';
import { FilesError, type FilesErrorCode, type FileEntry } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';

type Request = Readonly<
  { mode: 'edit'; entry: FileEntry } | { mode: 'text' | 'markdown'; parentId: string }
>;
export function TextDialog({
  request,
  maxBytes,
  onClose,
  onSaved,
}: Readonly<{ request: Request; maxBytes: number; onClose: () => void; onSaved: () => void }>) {
  const port = useFiles();
  const { t } = useFrontendTranslation();
  const [name, setName] = useState(request.mode === 'edit' ? request.entry.name : '');
  const [text, setText] = useState('');
  const [snapshot, setSnapshot] = useState<FileEntry>();
  const [loading, setLoading] = useState(request.mode === 'edit');
  const [failure, setFailure] = useState<FilesErrorCode | ''>('');
  useEffect(() => {
    if (request.mode !== 'edit') return;
    const controller = new AbortController();
    void (async () => {
      try {
        const detail = await port.detail(request.entry.id);
        const contents = await port.preview(detail.entry, controller.signal);
        if (!controller.signal.aborted) {
          setSnapshot(detail.entry);
          setText(contents);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setFailure(error instanceof FilesError ? error.code : 'unavailable');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [request, port]);
  const length = port.textBytes(text);
  const title = t(
    request.mode === 'edit'
      ? 'files.edit'
      : request.mode === 'markdown'
        ? 'files.newMarkdown'
        : 'files.newText',
  );
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={t('files.textHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.save')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      confirmDisabled={
        loading || length > maxBytes || (request.mode === 'edit' ? !snapshot : !name.trim())
      }
      {...(failure
        ? {
            failureMessage:
              failure === 'conflict' ? t('files.textConflict') : t(`files.errors.${failure}`),
          }
        : {})}
      onConfirm={async () => {
        setFailure('');
        try {
          if (request.mode === 'edit') {
            if (!snapshot) throw new FilesError('unavailable');
            await port.replaceText(snapshot.id, snapshot.contentRevision, text);
          } else {
            const suffix = request.mode === 'markdown' ? '.md' : '.txt';
            await port.createText(
              request.parentId,
              name.toLowerCase().endsWith(suffix) ? name : name + suffix,
              text,
            );
          }
          onSaved();
        } catch (error) {
          setFailure(error instanceof FilesError ? error.code : 'unavailable');
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        {request.mode !== 'edit' ? (
          <TextField
            label={t('files.name')}
            hint={t(request.mode === 'markdown' ? 'files.markdownNameHint' : 'files.textNameHint')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        ) : (
          <p className="break-words font-medium">{name}</p>
        )}
        {loading ? (
          <p role="status">{t('files.previewLoading')}</p>
        ) : (
          <TextAreaField
            label={t('files.textContent')}
            value={text}
            content="code"
            rows={12}
            onChange={(event) => setText(event.target.value)}
          />
        )}
        <p className={length > maxBytes ? 'text-sm text-danger' : 'text-xs text-ink-muted'}>
          {t('files.textBytes', { count: length, limit: maxBytes })}
        </p>
      </div>
    </DialogSurface>
  );
}
export type TextRequest = Request;
