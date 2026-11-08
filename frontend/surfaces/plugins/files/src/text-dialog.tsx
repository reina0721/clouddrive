'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { TextField, TextAreaField } from '@clouddrive/ui-adapter/form-field';
import { FilesError, type FilesErrorCode, type FileEntry } from '../../../src/files/model';
import { isMarkdownFile } from '../../../src/files/markdown';
import { useFiles } from '../../../src/files/runtime';

const MarkdownEditor = lazy(() => import('./markdown-editor'));

type Request = Readonly<
  | { mode: 'edit'; entry: FileEntry; reading?: true }
  | { mode: 'text' | 'markdown'; parentId: string }
>;
export function TextDialog({
  request,
  maxBytes,
  onClose,
  onSaved,
  onDownload,
}: Readonly<{
  request: Request;
  maxBytes: number;
  onClose: () => void;
  onSaved: () => void;
  onDownload?: () => void;
}>) {
  const port = useFiles();
  const { t, locale } = useFrontendTranslation();
  const zh = locale.startsWith('zh');
  const markdown =
    request.mode === 'edit'
      ? request.reading === true || isMarkdownFile(request.entry)
      : request.mode === 'markdown';
  const [name, setName] = useState(request.mode === 'edit' ? request.entry.name : '');
  const [text, setText] = useState('');
  const [original, setOriginal] = useState('');
  const [snapshot, setSnapshot] = useState<FileEntry>();
  const [loading, setLoading] = useState(request.mode === 'edit');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailure, setLoadFailure] = useState<FilesErrorCode | ''>('');
  const [failure, setFailure] = useState<FilesErrorCode | ''>('');
  const [saving, setSaving] = useState(false);
  const [discard, setDiscard] = useState(false);
  const saved = useRef(false);
  useEffect(() => {
    if (request.mode !== 'edit') return;
    const controller = new AbortController();
    void (async () => {
      try {
        const detail = await port.detail(request.entry.id, controller.signal);
        if (controller.signal.aborted) return;
        if (markdown && detail.entry.sizeBytes > maxBytes) throw new FilesError('large');
        const contents = await port.preview(
          detail.entry,
          controller.signal,
          request.reading ? 'file-application' : undefined,
        );
        if (!controller.signal.aborted) {
          setSnapshot(detail.entry);
          setOriginal(contents);
          setText(contents);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setLoadFailure(error instanceof FilesError ? error.code : 'unavailable');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [request, port, markdown, maxBytes, loadAttempt]);
  const length = port.textBytes(text);
  const dirty = text !== original || (request.mode !== 'edit' && name.trim() !== '');
  const title =
    markdown && request.mode === 'edit'
      ? request.entry.name
      : t(
          request.mode === 'edit'
            ? 'files.edit'
            : request.mode === 'markdown'
              ? 'files.newMarkdown'
              : 'files.newText',
        );
  const discardTitle = zh ? '放弃未保存的 Markdown 修改？' : 'Discard unsaved Markdown changes?';
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={
        markdown
          ? zh
            ? '编辑 Markdown 源码，查看渲染效果并保存到文件。'
            : 'Edit Markdown source, preview the result, and save it to the file.'
          : t('files.textHint')
      }
      cancelLabel={t(request.mode === 'edit' && request.reading ? 'files.close' : 'files.cancel')}
      confirmLabel={t('files.save')}
      isOpen
      {...(markdown ? { size: 'cover', layout: 'workspace' } : {})}
      onOpenChange={(open) => {
        if (!open) {
          if (markdown && dirty && !saved.current) setDiscard(true);
          else onClose();
        }
      }}
      confirmDisabled={
        loading ||
        length > maxBytes ||
        (request.mode === 'edit' ? !snapshot || (markdown && !dirty) : !name.trim())
      }
      {...(failure
        ? {
            failureMessage:
              failure === 'conflict' ? t('files.textConflict') : t(`files.errors.${failure}`),
          }
        : {})}
      onConfirm={async () => {
        setFailure('');
        setSaving(true);
        try {
          if (request.mode === 'edit') {
            if (!snapshot) throw new FilesError('unavailable');
            await port.replaceText(snapshot.id, snapshot.contentRevision, text);
          } else {
            const suffix = request.mode === 'markdown' ? '.md' : '.txt';
            await port.createText(
              request.parentId,
              name.toLowerCase().endsWith(suffix) ||
                (markdown && isMarkdownFile({ name, mediaType: '' }))
                ? name
                : name + suffix,
              text,
            );
          }
          saved.current = true;
          onSaved();
        } catch (error) {
          setFailure(error instanceof FilesError ? error.code : 'unavailable');
          throw error;
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="space-y-4">
        {request.mode !== 'edit' ? (
          <TextField
            label={t('files.name')}
            hint={
              request.mode === 'markdown'
                ? zh
                  ? '支持 .md 和 .markdown，其他名称自动补全 .md。'
                  : 'Use .md or .markdown. Other names get a .md extension.'
                : t('files.textNameHint')
            }
            value={name}
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
        ) : !markdown ? (
          <p className="break-words font-medium">{name}</p>
        ) : null}
        {onDownload ? (
          <Action size="sm" variant="secondary" onPress={onDownload}>
            {t('files.download')}
          </Action>
        ) : null}
        {loading ? (
          <p role="status">{t('files.previewLoading')}</p>
        ) : loadFailure ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-danger">
              {t(`files.errors.${loadFailure}`)}
            </p>
            <Action
              size="sm"
              variant="secondary"
              onPress={() => {
                setLoading(true);
                setLoadFailure('');
                setLoadAttempt((value) => value + 1);
              }}
            >
              {t('files.retry')}
            </Action>
          </div>
        ) : markdown ? (
          <Suspense fallback={<p role="status">{t('files.previewLoading')}</p>}>
            <MarkdownEditor
              text={text}
              onChange={setText}
              parentId={
                request.mode === 'edit'
                  ? (snapshot?.parentId ?? request.entry.parentId)
                  : request.parentId
              }
              reading={request.mode === 'edit' && request.reading === true}
              disabled={saving}
            />
          </Suspense>
        ) : (
          <TextAreaField
            label={t('files.textContent')}
            value={text}
            content="code"
            rows={12}
            disabled={saving}
            onChange={(event) => setText(event.target.value)}
          />
        )}
        <p className={length > maxBytes ? 'text-sm text-danger' : 'text-xs text-ink-muted'}>
          {t('files.textBytes', { count: length, limit: maxBytes })}
        </p>
      </div>
      {discard ? (
        <DialogSurface
          isOpen
          triggerLabel={discardTitle}
          title={discardTitle}
          description={zh ? '确认是否关闭编辑器。' : 'Confirm that you want to close the editor.'}
          cancelLabel={zh ? '继续编辑' : 'Keep editing'}
          confirmLabel={zh ? '放弃修改' : 'Discard changes'}
          onConfirm={onClose}
          onOpenChange={(open) => {
            if (!open) setDiscard(false);
          }}
        >
          <p>{zh ? '关闭后，本次草稿将丢失。' : 'Closing will discard this draft.'}</p>
        </DialogSurface>
      ) : null}
    </DialogSurface>
  );
}
export type TextRequest = Request;
