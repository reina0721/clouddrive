'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { TextAreaField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useContainerBreakpoint } from '@clouddrive/ui-adapter/container-layout';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react';
import { FilesError, type FilesErrorCode } from '../../../src/files/model';
import { markdownHttpLink, markdownImagePath } from '../../../src/files/markdown';
import { useMarkdownImageUpload } from '../../../src/files/runtime';
import {
  formatMarkdown,
  markdownLabel,
  rememberMarkdown,
  replaceMarkdown,
  type MarkdownFormat,
  type MarkdownSnapshot,
} from './markdown-edit';
import { MarkdownPreview } from './markdown-preview';

const zh = {
  views: 'Markdown 视图',
  formatting: 'Markdown 格式',
  preview: '预览',
  source: '源码',
  split: '并排',
  empty: '输入 Markdown 即可预览。',
  tooLarge: '内容超出渲染大小限制，请切换到源码。',
  failed: '无法渲染此文档，请切换到源码。',
  missingImage: '只能显示同目录中可读取的栅格图片。',
  headingOne: '一级标题',
  heading: '标题',
  bold: '粗体',
  emphasis: '斜体',
  strike: '删除线',
  inlineCode: '行内代码',
  list: '列表',
  ordered: '有序列表',
  task: '待办',
  quote: '引用',
  code: '代码块',
  table: '表格',
  rule: '分隔线',
  column: '列',
  undo: '撤销',
  redo: '重做',
  link: '插入链接',
  linkLabel: '链接文字',
  linkAddress: '链接地址',
  linkHint: '输入 HTTP 或 HTTPS 地址。',
  invalidLink: '请输入不含用户名和密码的 HTTP 或 HTTPS 地址。',
  insert: '插入',
  image: '插入图片',
  imagePending: '正在把图片上传到文档所在文件夹…',
  imageSaved: '图片已上传并插入。保存文档即可保留引用。',
  imageCancel: '取消等待',
  imageCanceled: '已停止等待。已加入队列的图片可在传输中心查看。',
  imageConflict: '同名文件或目标冲突。请改名或检查目标文件夹后重试。',
  imageLarge: '图片不能超过 2 MiB。',
  imageUnsupported: '请选择可预览的 PNG、JPEG、GIF、WebP 或 AVIF 图片。',
};
const en: typeof zh = {
  views: 'Markdown view',
  formatting: 'Markdown formatting',
  preview: 'Preview',
  source: 'Source',
  split: 'Side by side',
  empty: 'Enter Markdown to see a preview.',
  tooLarge: 'This document exceeds the preview size limit. Switch to source to continue.',
  failed: 'This document could not be rendered. Switch to source to continue.',
  missingImage: 'Only readable raster images in this folder can be displayed.',
  headingOne: 'Level-one heading',
  heading: 'Heading',
  bold: 'Bold',
  emphasis: 'Italic',
  strike: 'Strikethrough',
  inlineCode: 'Inline code',
  list: 'List',
  ordered: 'Numbered list',
  task: 'Task',
  quote: 'Quote',
  code: 'Code block',
  table: 'Table',
  rule: 'Divider',
  column: 'Column',
  undo: 'Undo',
  redo: 'Redo',
  link: 'Insert link',
  linkLabel: 'Link text',
  linkAddress: 'Link address',
  linkHint: 'Enter an HTTP or HTTPS address.',
  invalidLink: 'Enter an HTTP or HTTPS address without a username or password.',
  insert: 'Insert',
  image: 'Insert image',
  imagePending: 'Uploading the image to the document folder…',
  imageSaved: 'Image uploaded and inserted. Save the document to keep the reference.',
  imageCancel: 'Stop waiting',
  imageCanceled: 'Stopped waiting. Check the transfer center for queued images.',
  imageConflict:
    'The name or destination conflicts. Rename the image or check the folder and try again.',
  imageLarge: 'The image must be no larger than 2 MiB.',
  imageUnsupported: 'Choose a previewable PNG, JPEG, GIF, WebP or AVIF image.',
};

type View = 'preview' | 'source' | 'split';
type Selection = MarkdownSnapshot['range'];
type LinkDraft = Readonly<{ range: Selection; label: string; address: string }>;
const formats = [
  ['headingOne', Heading1],
  ['heading', Heading2],
  ['bold', Bold],
  ['emphasis', Italic],
  ['strike', Strikethrough],
  ['inlineCode', Code],
  ['list', List],
  ['ordered', ListOrdered],
  ['task', ListChecks],
  ['quote', Quote],
  ['code', SquareCode],
  ['table', Table2],
  ['rule', Minus],
] as const;
const initialHistory: Readonly<{
  undo: readonly MarkdownSnapshot[];
  redo: readonly MarkdownSnapshot[];
}> = {
  undo: [],
  redo: [],
};

export default function MarkdownEditor({
  text,
  onChange,
  parentId,
  reading,
  disabled,
  allowImageUpload,
  onImagePending,
}: {
  text: string;
  onChange: (text: string) => void;
  parentId: string;
  reading: boolean;
  disabled: boolean;
  allowImageUpload: boolean;
  onImagePending: (pending: boolean) => void;
}) {
  const { locale, t } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const uploadImage = useMarkdownImageUpload();
  const { ref, matches } = useContainerBreakpoint('4xl');
  const [selectedView, setSelectedView] = useState<View>(reading ? 'preview' : 'split');
  const view = selectedView === 'split' && !matches ? 'source' : selectedView;
  const views: readonly View[] = matches ? ['source', 'split', 'preview'] : ['source', 'preview'];
  const textarea = useRef<HTMLTextAreaElement>(null);
  const nextSelection = useRef<Selection>(null);
  const upload = useRef<AbortController>(null);
  const [history, setHistory] = useState(initialHistory);
  const [link, setLink] = useState<LinkDraft>();
  const [uploading, setUploading] = useState(false);
  const [imageStatus, setImageStatus] = useState<'saved' | 'canceled'>();
  const [imageFailure, setImageFailure] = useState<FilesErrorCode>();
  const blocked = disabled || uploading;
  // 文本域的选区偏移使用 LF，历史仍保留原始文档文本。
  const source = text.replace(/\r\n?/g, '\n');
  const href = link?.address.trim() ? markdownHttpLink(link.address.trim()) : undefined;

  useLayoutEffect(() => {
    const element = textarea.current;
    const range = nextSelection.current;
    if (!element || !range || blocked) return;
    nextSelection.current = null;
    element.focus();
    element.setSelectionRange(range.start, range.end);
  }, [text, blocked]);
  useEffect(() => () => upload.current?.abort(), []);

  function selection(): Selection {
    const element = textarea.current;
    return {
      start: element?.selectionStart ?? source.length,
      end: element?.selectionEnd ?? source.length,
    };
  }

  function change(next: MarkdownSnapshot, previous: Selection, restoreSelection = true) {
    if (next.text === source) return;
    if (restoreSelection) nextSelection.current = next.range;
    setHistory(({ undo }) => ({
      undo: rememberMarkdown(undo, { text, range: previous }),
      redo: [],
    }));
    onChange(next.text);
  }

  function travel(direction: 'undo' | 'redo') {
    const [target, ...remaining] = history[direction];
    if (!target) return;
    const current = { text, range: selection() };
    setHistory(
      direction === 'undo'
        ? { undo: remaining, redo: rememberMarkdown(history.redo, current) }
        : { undo: rememberMarkdown(history.undo, current), redo: remaining },
    );
    nextSelection.current = target.range;
    onChange(target.text);
  }

  function format(command: MarkdownFormat) {
    const range = selection();
    change(formatMarkdown(source, range, command, labels.column), range);
  }

  function openLink() {
    const range = selection();
    setLink({ range, label: source.slice(range.start, range.end), address: '' });
  }

  function keyboard(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      blocked ||
      event.target !== textarea.current ||
      event.altKey ||
      !(event.ctrlKey || event.metaKey) ||
      event.nativeEvent.isComposing
    )
      return;
    const key = event.key.toLowerCase();
    if (key === 'z') travel(event.shiftKey ? 'redo' : 'undo');
    else if (key === 'y' && !event.shiftKey) travel('redo');
    else if (key === 'b' && !event.shiftKey) format('bold');
    else if (key === 'i' && !event.shiftKey) format('emphasis');
    else if (key === 'k' && !event.shiftKey) openLink();
    else return;
    event.preventDefault();
  }

  async function insertImage() {
    if (!uploadImage || upload.current || disabled) return;
    const range = selection();
    const controller = new AbortController();
    upload.current = controller;
    setImageFailure(undefined);
    setImageStatus(undefined);
    setUploading(true);
    onImagePending(true);
    try {
      const entry = await uploadImage(parentId, controller.signal);
      if (!entry || controller.signal.aborted) return;
      const path = markdownImagePath(entry.name);
      if (!path) throw new FilesError('invalid');
      const name = entry.name.replace(/\.[^.]+$/, '') || entry.name;
      const alt = markdownLabel(source.slice(range.start, range.end).trim() || name);
      change(replaceMarkdown(source, range, '![' + alt + '](' + path + ')'), range);
      setImageStatus('saved');
    } catch (error) {
      if (!controller.signal.aborted)
        setImageFailure(error instanceof FilesError ? error.code : 'unavailable');
    } finally {
      if (!controller.signal.aborted) {
        upload.current = null;
        setUploading(false);
        onImagePending(false);
      }
    }
  }

  function cancelUpload() {
    upload.current?.abort();
    upload.current = null;
    setUploading(false);
    onImagePending(false);
    setImageStatus('canceled');
  }

  const imageError =
    imageFailure === 'large'
      ? labels.imageLarge
      : imageFailure === 'unsupported'
        ? labels.imageUnsupported
        : imageFailure === 'conflict'
          ? labels.imageConflict
          : imageFailure
            ? t('files.errors.' + imageFailure)
            : '';
  return (
    <div ref={ref} className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={labels.views}>
          {views.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={choice === view}
              disabled={uploading}
              className={
                'rounded-control border border-border px-3 py-2 text-sm font-semibold ' +
                (choice === view ? 'text-brand' : 'text-ink-muted')
              }
              style={choice === view ? { borderColor: 'currentColor' } : undefined}
              onClick={() => setSelectedView(choice)}
            >
              {labels[choice]}
            </button>
          ))}
        </div>
        {view !== 'preview' ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label={labels.formatting}>
            <IconAction
              label={labels.undo}
              size="sm"
              tooltip
              disabled={blocked || !history.undo.length}
              onPress={() => travel('undo')}
            >
              <Undo2 aria-hidden="true" />
            </IconAction>
            <IconAction
              label={labels.redo}
              size="sm"
              tooltip
              disabled={blocked || !history.redo.length}
              onPress={() => travel('redo')}
            >
              <Redo2 aria-hidden="true" />
            </IconAction>
            {formats.map(([command, Icon]) => (
              <IconAction
                key={command}
                label={labels[command]}
                size="sm"
                tooltip
                disabled={blocked}
                onPress={() => format(command)}
              >
                <Icon aria-hidden="true" />
              </IconAction>
            ))}
            <IconAction label={labels.link} size="sm" tooltip disabled={blocked} onPress={openLink}>
              <Link2 aria-hidden="true" />
            </IconAction>
            {uploadImage && allowImageUpload ? (
              <Action
                size="sm"
                variant="secondary"
                disabled={blocked}
                leadingIcon={<ImagePlus />}
                onPress={() => void insertImage()}
              >
                {labels.image}
              </Action>
            ) : null}
          </div>
        ) : null}
      </div>
      {uploading ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="text-sm text-ink-muted">
            {labels.imagePending}
          </p>
          <Action size="sm" variant="quiet" onPress={cancelUpload}>
            {labels.imageCancel}
          </Action>
        </div>
      ) : imageError ? (
        <p role="alert" className="text-sm text-danger">
          {imageError}
        </p>
      ) : imageStatus ? (
        <p role="status" className="text-sm text-ink-muted">
          {imageStatus === 'saved' ? labels.imageSaved : labels.imageCanceled}
        </p>
      ) : null}
      <div
        className="grid min-w-0 gap-3"
        style={view === 'split' ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : undefined}
      >
        {view !== 'preview' ? (
          <TextAreaField
            ref={textarea}
            label={t('files.textContent')}
            value={source}
            content="code"
            rows={view === 'split' ? 22 : 16}
            disabled={blocked}
            onKeyDown={keyboard}
            onChange={(event) => {
              const { value, selectionStart, selectionEnd } = event.currentTarget;
              const previousCaret = Math.min(
                source.length,
                Math.max(0, selectionStart - (value.length - source.length)),
              );
              change(
                { text: value, range: { start: selectionStart, end: selectionEnd } },
                { start: previousCaret, end: previousCaret },
                false,
              );
            }}
          />
        ) : null}
        {view !== 'source' ? (
          <MarkdownPreview text={text} parentId={parentId} labels={labels} />
        ) : null}
      </div>
      {link ? (
        <DialogSurface
          triggerLabel={labels.link}
          title={labels.link}
          description={labels.linkHint}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.insert}
          confirmDisabled={!href}
          isOpen
          onOpenChange={(open) => {
            if (!open) setLink(undefined);
          }}
          onConfirm={() => {
            if (!href) return;
            const label = markdownLabel(link.label.trim() || href);
            change(
              replaceMarkdown(source, link.range, '[' + label + '](<' + href + '>)'),
              link.range,
            );
          }}
        >
          <div className="space-y-3">
            <TextField
              label={labels.linkLabel}
              value={link.label}
              onChange={(event) => setLink({ ...link, label: event.currentTarget.value })}
            />
            <TextField
              label={labels.linkAddress}
              value={link.address}
              {...(link.address.trim() && !href ? { error: labels.invalidLink } : {})}
              onChange={(event) => setLink({ ...link, address: event.currentTarget.value })}
            />
          </div>
        </DialogSurface>
      ) : null}
    </div>
  );
}
