'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type {
  EpubBook,
  EpubChapter,
  EpubDestination,
  EpubEntry,
  EpubNode,
  EpubTag,
} from '../../../src/files/epub-contract';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';

const zh = {
  title: 'EPUB 阅读器',
  hint: '按章节阅读电子书，目录和包内链接可跳转。',
  contents: '目录',
  previous: '上一章',
  next: '下一章',
  smaller: '缩小字号',
  larger: '增大字号',
  reading: '章节正文',
  opening: '正在打开电子书…',
  loading: '正在加载章节…',
  chapter: (position: number, total: number) => `第 ${position} / ${total} 章`,
  name: (position: number) => `第 ${position} 章`,
  invalid: '无法读取此 EPUB。请检查文件完整性和正文格式。',
  limit: '这本书或当前章节超出阅读器的大小限制。',
};
const en: typeof zh = {
  title: 'EPUB reader',
  hint: 'Read by chapter and follow the table of contents or links inside the book.',
  contents: 'Contents',
  previous: 'Previous chapter',
  next: 'Next chapter',
  smaller: 'Decrease font size',
  larger: 'Increase font size',
  reading: 'Chapter text',
  opening: 'Opening book…',
  loading: 'Loading chapter…',
  chapter: (position, total) => `Chapter ${position} of ${total}`,
  name: (position) => `Chapter ${position}`,
  invalid: 'This EPUB could not be read. Check its integrity and chapter format.',
  limit: 'This book or chapter exceeds the reader size limit.',
};

const tagStyles: Partial<Record<EpubTag, string>> = {
  h1: 'mb-3 text-2xl font-bold',
  h2: 'mb-3 text-xl font-bold',
  h3: 'mb-2 text-lg font-semibold',
  h4: 'mb-2 font-semibold',
  h5: 'mb-2 font-semibold',
  h6: 'mb-2 font-semibold',
  p: 'mb-3',
  ul: 'mb-3 list-disc',
  ol: 'mb-3',
  blockquote: 'mb-3 border-l border-border',
  pre: 'mb-3 overflow-auto whitespace-pre-wrap',
  figure: 'mb-3',
  figcaption: 'text-sm text-ink-muted',
  hr: 'my-3 border-border',
};
const tagLayout: Partial<Record<EpubTag, CSSProperties>> = {
  ul: { paddingInlineStart: '1.25rem' },
  ol: { listStyleType: 'decimal', paddingInlineStart: '1.25rem' },
  blockquote: { paddingInlineStart: '0.75rem' },
};
const fontScales = [0.875, 1, 1.125, 1.25, 1.5] as const;
type ReadResult<T> = { value: T; error?: never } | { value?: never; error: unknown };

function chapterNodes(
  nodes: readonly EpubNode[],
  onNavigate: (target: EpubDestination) => void,
): ReactNode {
  return nodes.map((node, index) => {
    switch (node.kind) {
      case 'text':
        return node.value;
      case 'image':
        return (
          <img
            key={index}
            src={node.url}
            alt={node.alt}
            className="my-3 max-w-full object-contain"
          />
        );
      case 'link':
        return (
          <button
            key={index}
            type="button"
            className="text-brand underline"
            onClick={() => onNavigate(node.destination)}
          >
            {chapterNodes(node.children, onNavigate)}
          </button>
        );
      case 'element': {
        const props = {
          key: index,
          className: tagStyles[node.tag],
          style: tagLayout[node.tag],
          'data-epub-anchor': node.anchor,
        };
        return node.tag === 'br' || node.tag === 'hr'
          ? createElement(node.tag, props)
          : createElement(node.tag, props, chapterNodes(node.children, onNavigate));
      }
    }
  });
}

export function EpubDialog({
  entry,
  onClose,
  onDownload,
}: {
  entry: EpubEntry;
  onClose: () => void;
  onDownload: () => void;
}) {
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const { openEpub } = useFiles();
  const [opened, setOpened] = useState<{
    entry: EpubEntry;
    retry: number;
    result: ReadResult<EpubBook>;
  }>();
  const [target, setTarget] = useState<EpubDestination>({ chapter: 0 });
  const [loaded, setLoaded] = useState<{
    book: EpubBook;
    index: number;
    retry: number;
    result: ReadResult<EpubChapter>;
  }>();
  const [bookRetry, setBookRetry] = useState(0);
  const [chapterRetry, setChapterRetry] = useState(0);
  const [font, setFont] = useState(1);
  const article = useRef<HTMLElement>(null);
  const publication =
    opened?.entry === entry && opened.retry === bookRetry ? opened.result : undefined;
  const book = publication?.value;
  const bookError = publication?.error;
  const current =
    loaded &&
    loaded.book === book &&
    loaded.index === target.chapter &&
    loaded.retry === chapterRetry
      ? loaded.result
      : undefined;
  const content = current?.value;
  const chapterError = current?.error;

  useEffect(() => {
    const controller = new AbortController();
    let owned: EpubBook | undefined;
    void openEpub(entry, controller.signal).then(
      (value) => {
        if (controller.signal.aborted) value.release();
        else {
          owned = value;
          setOpened({ entry, retry: bookRetry, result: { value } });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setOpened({ entry, retry: bookRetry, result: { error } });
      },
    );
    return () => {
      controller.abort();
      owned?.release();
    };
  }, [openEpub, entry, bookRetry]);

  useEffect(() => {
    if (!book) return;
    const controller = new AbortController();
    let owned: EpubChapter | undefined;
    void book.chapter(target.chapter, controller.signal).then(
      (value) => {
        if (controller.signal.aborted) value.release();
        else {
          owned = value;
          setLoaded({ book, index: target.chapter, retry: chapterRetry, result: { value } });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setLoaded({ book, index: target.chapter, retry: chapterRetry, result: { error } });
      },
    );
    return () => {
      controller.abort();
      owned?.release();
    };
  }, [book, target.chapter, chapterRetry]);

  useEffect(() => {
    const root = article.current;
    if (!content || !root) return;
    root.scrollTop = 0;
    if (!target.fragment) return;
    const anchor = Array.from(root.querySelectorAll<HTMLElement>('[data-epub-anchor]')).find(
      (element) => element.dataset.epubAnchor === target.fragment,
    );
    anchor?.scrollIntoView({ block: 'start' });
  }, [content, target]);

  const failure = bookError ?? chapterError;
  const message =
    failure instanceof FilesError && failure.code === 'large'
      ? labels.limit
      : failure instanceof FilesError &&
          failure.code !== 'unsupported' &&
          failure.code !== 'invalid'
        ? t('files.errors.' + failure.code)
        : labels.invalid;
  const chapter = target.chapter;
  return (
    <DialogSurface
      isOpen
      size="cover"
      layout="workspace"
      triggerLabel={labels.title}
      title={book?.title || entry.name}
      description={labels.hint}
      cancelLabel={t('files.close')}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Action size="sm" variant="secondary" onPress={onDownload}>
            {t('files.download')}
          </Action>
          {book ? (
            <>
              <Action
                size="sm"
                variant="secondary"
                disabled={chapter <= 0}
                onPress={() => setTarget({ chapter: chapter - 1 })}
              >
                {labels.previous}
              </Action>
              <span className="text-sm text-ink-muted" role="status">
                {labels.chapter(chapter + 1, book.chapters.length)}
              </span>
              <Action
                size="sm"
                variant="secondary"
                disabled={chapter >= book.chapters.length - 1}
                onPress={() => setTarget({ chapter: chapter + 1 })}
              >
                {labels.next}
              </Action>
              <Action
                size="sm"
                variant="quiet"
                disabled={font === 0}
                onPress={() => setFont(font - 1)}
              >
                {labels.smaller}
              </Action>
              <Action
                size="sm"
                variant="quiet"
                disabled={font === fontScales.length - 1}
                onPress={() => setFont(font + 1)}
              >
                {labels.larger}
              </Action>
            </>
          ) : null}
        </div>
        {book?.author ? <p className="text-sm text-ink-muted">{book.author}</p> : null}
        {book ? (
          <details className="max-h-40 overflow-auto rounded-control border border-border p-2">
            <summary className="cursor-pointer text-sm font-semibold">{labels.contents}</summary>
            <nav aria-label={labels.contents} className="flex flex-wrap gap-2">
              {book.toc.length
                ? book.toc.map((item, index) => (
                    <Action
                      key={index}
                      size="sm"
                      variant="quiet"
                      onPress={() => setTarget(item.destination)}
                    >
                      {item.label}
                    </Action>
                  ))
                : book.chapters.map((path, index) => (
                    <Action
                      key={path + ':' + index}
                      size="sm"
                      variant="quiet"
                      onPress={() => setTarget({ chapter: index })}
                    >
                      {labels.name(index + 1)}
                    </Action>
                  ))}
            </nav>
          </details>
        ) : null}
        {failure ? (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
            <Action
              variant="secondary"
              size="sm"
              onPress={() => {
                if (bookError) setBookRetry((value) => value + 1);
                else setChapterRetry((value) => value + 1);
              }}
            >
              {t('files.retry')}
            </Action>
          </div>
        ) : !content ? (
          <p role="status">{book ? labels.loading : labels.opening}</p>
        ) : (
          <article
            ref={article}
            aria-label={labels.reading}
            className="min-h-0 min-w-0 flex-1 overflow-auto break-words rounded-panel border border-border bg-surface p-4"
            style={{ fontSize: `${fontScales[font] ?? 1}rem`, lineHeight: 1.7 }}
          >
            {chapterNodes(content.nodes, setTarget)}
          </article>
        )}
      </div>
    </DialogSurface>
  );
}
