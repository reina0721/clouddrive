'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { FilesError, type FilesErrorCode, type FileEntry } from '../../../src/files/model';
import {
  textEncodings,
  type DecodedFileText,
  type FileTextSource,
  type TextEncoding,
} from '../../../src/files/text-editor';
import { isMarkdownFile } from '../../../src/files/markdown';
import { useFiles } from '../../../src/files/runtime';
import type { CreationTemplate } from '../../../src/files/file-applications';

const MarkdownEditor = lazy(() => import('./markdown-editor'));
const CodeEditor = lazy(() => import('./code-editor'));

type Request = Readonly<
  | { mode: 'edit'; entry: FileEntry; reading?: true; code?: true }
  | { mode: 'text' | 'markdown'; parentId: string; template?: CreationTemplate }
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
      ? !request.code && (request.reading === true || isMarkdownFile(request.entry))
      : request.mode === 'markdown';
  const [name, setName] = useState(request.mode === 'edit' ? request.entry.name : '');
  const [text, setText] = useState('');
  const [original, setOriginal] = useState('');
  const [snapshot, setSnapshot] = useState<FileEntry>();
  const [textEditable, setTextEditable] = useState(false);
  const [source, setSource] = useState<FileTextSource>();
  const [decoded, setDecoded] = useState<DecodedFileText>();
  const [encoding, setEncoding] = useState<TextEncoding>('auto');
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const [loading, setLoading] = useState(request.mode === 'edit');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailure, setLoadFailure] = useState<FilesErrorCode | ''>('');
  const [failure, setFailure] = useState<FilesErrorCode | ''>('');
  const [saving, setSaving] = useState(false);
  const [imagePending, setImagePending] = useState(false);
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
        const contents = markdown
          ? await port.preview(
              detail.entry,
              controller.signal,
              request.reading ? 'file-application' : undefined,
            )
          : await port.openTextSource(detail.entry, controller.signal);
        if (!controller.signal.aborted) {
          setSnapshot(detail.entry);
          setTextEditable(detail.textEditable === true);
          if (typeof contents === 'string') {
            setOriginal(contents);
            setText(contents);
          } else {
            setSource(contents);
            try {
              const initial = contents.decode('auto');
              setDecoded(initial);
              setOriginal(initial.text);
              setText(initial.text);
              setDecodeFailed(false);
              setEncoding('auto');
            } catch (error) {
              if (
                !(error instanceof FilesError) ||
                (error.code !== 'invalid' && error.code !== 'unsupported')
              )
                throw error;
              setDecodeFailed(true);
            }
          }
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
  const writeText =
    decoded && decoded.lineEnding !== '\n' ? text.replaceAll('\n', decoded.lineEnding) : text;
  const length = port.textBytes(writeText);
  const dirty = text !== original || (request.mode !== 'edit' && name.trim() !== '');
  const readOnly = request.mode === 'edit' && !markdown && !textEditable;
  const convertsEncoding = decoded !== undefined && decoded.encoding !== 'utf-8';
  const suffix =
    request.mode === 'edit' ? '' : '.' + (request.template?.extension ?? (markdown ? 'md' : 'txt'));
  const fileName =
    request.mode === 'edit' ||
    name.toLowerCase().endsWith(suffix) ||
    (markdown &&
      (!request.template || request.template.builtIn) &&
      isMarkdownFile({ name, mediaType: '' }))
      ? name
      : name + suffix;
  const title =
    request.mode === 'edit' && (markdown || request.code)
      ? request.entry.name
      : ((request.mode !== 'edit' ? request.template?.title : undefined) ??
        t(
          request.mode === 'edit'
            ? 'files.edit'
            : request.mode === 'markdown'
              ? 'files.newMarkdown'
              : 'files.newText',
        ));
  const discardTitle = markdown
    ? zh
      ? '放弃未保存的 Markdown 修改？'
      : 'Discard unsaved Markdown changes?'
    : zh
      ? '放弃未保存的文本修改？'
      : 'Discard unsaved text changes?';

  function changeEncoding(next: TextEncoding) {
    if (!source || dirty) return;
    setEncoding(next);
    try {
      const result = source.decode(next);
      setDecoded(result);
      setOriginal(result.text);
      setText(result.text);
      setDecodeFailed(false);
      setEditorSession((session) => session + 1);
    } catch (error) {
      if (error instanceof FilesError && (error.code === 'invalid' || error.code === 'unsupported'))
        setDecodeFailed(true);
      else setLoadFailure(error instanceof FilesError ? error.code : 'unavailable');
    }
  }
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={
        markdown
          ? zh
            ? '编辑 Markdown 源码，查看渲染效果并保存到文件。'
            : 'Edit Markdown source, preview the result, and save it to the file.'
          : readOnly && !loading
            ? zh
              ? '以只读方式打开，可查找、切换编码或下载原件。'
              : 'Read-only. Search, switch encoding, or download the original.'
            : t('files.textHint')
      }
      cancelLabel={t(
        request.mode === 'edit' && (request.reading || request.code)
          ? 'files.close'
          : 'files.cancel',
      )}
      {...(!readOnly ? { confirmLabel: t('files.save') } : {})}
      isOpen
      size="cover"
      layout="workspace"
      onOpenChange={(open) => {
        if (!open) {
          if ((markdown || request.mode === 'edit') && (dirty || imagePending) && !saved.current)
            setDiscard(true);
          else onClose();
        }
      }}
      confirmDisabled={
        loading ||
        !!loadFailure ||
        decodeFailed ||
        imagePending ||
        length > maxBytes ||
        (request.mode === 'edit' ? !snapshot || (!dirty && !convertsEncoding) : !name.trim())
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
            await port.replaceText(snapshot.id, snapshot.contentRevision, writeText);
          } else {
            await port.createText(request.parentId, fileName, text);
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
      <div className={markdown ? 'space-y-4' : 'flex h-full min-h-0 min-w-0 flex-col gap-3'}>
        {request.mode !== 'edit' ? (
          <TextField
            label={t('files.name')}
            hint={
              request.template && !request.template.builtIn
                ? zh
                  ? `名称未以 .${request.template.extension} 结尾时会自动补全。`
                  : `Names without .${request.template.extension} get that extension.`
                : request.mode === 'markdown'
                  ? zh
                    ? '支持 .md 和 .markdown，其他名称自动补全 .md。'
                    : 'Use .md or .markdown. Other names get a .md extension.'
                  : t('files.textNameHint')
            }
            value={name}
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
        ) : !markdown && !request.code ? (
          <p className="break-words font-medium">{name}</p>
        ) : null}
        {onDownload || source ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {onDownload ? (
              <Action size="sm" variant="secondary" onPress={onDownload}>
                {t('files.download')}
              </Action>
            ) : null}
            {source ? (
              <SelectField
                label={zh ? '读取编码' : 'Read encoding'}
                presentation="toolbar"
                value={encoding}
                disabled={dirty || saving}
                onValueChange={(value) => {
                  const choice = textEncodings.find(([key]) => key === value);
                  if (choice) changeEncoding(choice[0]);
                }}
                options={textEncodings.map(([value, label]) => ({
                  value,
                  label: value === 'auto' && zh ? '自动识别' : label,
                }))}
              />
            ) : null}
            {decoded && !decodeFailed ? (
              <span className="text-xs text-ink-muted">
                {decoded.encoding.toUpperCase()} ·{' '}
                {decoded.lineEnding === '\r\n' ? 'CRLF' : decoded.lineEnding === '\r' ? 'CR' : 'LF'}
                {convertsEncoding && !readOnly ? (zh ? ' · 保存为 UTF-8' : ' · Save as UTF-8') : ''}
              </span>
            ) : null}
          </div>
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
        ) : decodeFailed && !decoded ? (
          <p role="alert" className="text-sm text-danger">
            {zh
              ? '无法用所选编码读取此文件，请切换读取编码。'
              : 'This file could not be decoded. Choose another encoding.'}
          </p>
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
              allowImageUpload={request.mode !== 'edit' || snapshot?.trashedAt === null}
              onImagePending={setImagePending}
            />
          </Suspense>
        ) : (
          <Suspense fallback={<p role="status">{t('files.previewLoading')}</p>}>
            <CodeEditor
              key={editorSession}
              label={t('files.textContent')}
              text={text}
              onChange={setText}
              fileName={fileName}
              disabled={saving || decodeFailed}
              readOnly={readOnly}
            />
          </Suspense>
        )}
        {decodeFailed && decoded ? (
          <p role="alert" className="text-sm text-danger">
            {zh
              ? '无法用所选编码读取此文件，编辑区保留此前内容。'
              : 'Decoding failed. The editor retains the previous content.'}
          </p>
        ) : null}
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
