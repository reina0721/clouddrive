'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextAreaField } from '@clouddrive/ui-adapter/form-field';
import { useContainerBreakpoint } from '@clouddrive/ui-adapter/container-layout';
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
  heading: '标题',
  bold: '粗体',
  emphasis: '斜体',
  list: '列表',
  task: '待办',
  code: '代码块',
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
  heading: 'Heading',
  bold: 'Bold',
  emphasis: 'Italic',
  list: 'List',
  task: 'Task',
  code: 'Code block',
};

type View = 'preview' | 'source' | 'split';
const formats = [
  { id: 'heading', prefix: '## ', suffix: '', block: true },
  { id: 'bold', prefix: '**', suffix: '**', block: false },
  { id: 'emphasis', prefix: '*', suffix: '*', block: false },
  { id: 'list', prefix: '- ', suffix: '', block: true },
  { id: 'task', prefix: '- [ ] ', suffix: '', block: true },
  { id: 'code', prefix: '```\n', suffix: '\n```', block: true },
] as const;

export default function MarkdownEditor({
  text,
  onChange,
  parentId,
  reading,
  disabled,
}: {
  text: string;
  onChange: (text: string) => void;
  parentId: string;
  reading: boolean;
  disabled: boolean;
}) {
  const { locale, t } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const { ref, matches } = useContainerBreakpoint('4xl');
  const [selectedView, setSelectedView] = useState<View>(reading ? 'preview' : 'split');
  const view = selectedView === 'split' && !matches ? 'source' : selectedView;
  const views: readonly View[] = matches ? ['source', 'split', 'preview'] : ['source', 'preview'];
  const textarea = useRef<HTMLTextAreaElement>(null);
  const nextSelection = useRef<{ start: number; end: number }>(null);
  useLayoutEffect(() => {
    const element = textarea.current;
    const range = nextSelection.current;
    if (!element || !range) return;
    nextSelection.current = null;
    element.focus();
    element.setSelectionRange(range.start, range.end);
  }, [text]);

  function format({ prefix, suffix, block }: (typeof formats)[number]) {
    const element = textarea.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
    const before = block ? lineStart : start;
    const lineEnd = text.indexOf('\n', end);
    const after = block && suffix ? (lineEnd < 0 ? text.length : lineEnd) : end;
    nextSelection.current = { start: start + prefix.length, end: end + prefix.length };
    onChange(
      text.slice(0, before) + prefix + text.slice(before, after) + suffix + text.slice(after),
    );
  }

  return (
    <div ref={ref} className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={labels.views}>
          {views.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={choice === view}
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
            {formats.map((item) => (
              <Action
                key={item.id}
                size="sm"
                variant="quiet"
                disabled={disabled}
                onPress={() => format(item)}
              >
                {labels[item.id]}
              </Action>
            ))}
          </div>
        ) : null}
      </div>
      <div
        className="grid min-w-0 gap-3"
        style={view === 'split' ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : undefined}
      >
        {view !== 'preview' ? (
          <TextAreaField
            ref={textarea}
            label={t('files.textContent')}
            value={text}
            content="code"
            rows={14}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
        {view !== 'source' ? (
          <MarkdownPreview text={text} parentId={parentId} labels={labels} />
        ) : null}
      </div>
    </div>
  );
}
