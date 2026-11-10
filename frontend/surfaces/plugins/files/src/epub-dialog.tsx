'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { useContainerBreakpoint } from '@clouddrive/ui-adapter/container-layout';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Minus,
  Plus,
  RotateCcw,
  Rows3,
} from 'lucide-react';
import {
  createElement,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  epubBookmarkLimit,
  epubFontScales,
  type EpubBook,
  type EpubChapter,
  type EpubDestination,
  type EpubEntry,
  type EpubNode,
  type EpubTag,
} from '../../../src/files/epub-contract';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { useEpubReadingState } from './epub-reading-state';
import {
  EpubReadingViewport,
  type PageEdges,
  type ReadingLocation,
  type TurnPage,
} from './epub-reading-viewport';

const zh = {
  title: 'EPUB 阅读器',
  hint: '使用目录跳转章节，或切换翻页与连续滚动。阅读进度保存在此浏览器。',
  contents: '目录',
  pages: '切换为翻页',
  scroll: '切换为连续滚动',
  previousPage: '上一页',
  nextPage: '下一页',
  start: '从头阅读',
  bookmarks: '书签',
  addBookmark: '添加书签',
  removeBookmark: '移除书签',
  bookmark: (chapter: number, ratio: number) => `第 ${chapter} 章 · ${ratio}%`,
  storage: '此浏览器无法保存阅读进度，仍可继续阅读。',
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
  hint: 'Jump between chapters or switch between pages and continuous scrolling. Reading progress stays in this browser.',
  contents: 'Contents',
  pages: 'Switch to pages',
  scroll: 'Switch to continuous scrolling',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  start: 'Read from the beginning',
  bookmarks: 'Bookmarks',
  addBookmark: 'Add bookmark',
  removeBookmark: 'Remove bookmark',
  bookmark: (chapter, ratio) => `Chapter ${chapter} · ${ratio}%`,
  storage: 'This browser could not save reading progress. You can continue reading.',
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
type ReadResult<T> = { value: T; error?: never } | { value?: never; error: unknown };

function chapterNodes(
  nodes: readonly EpubNode[],
  onNavigate: (target: EpubDestination) => void,
  paged: boolean,
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
            style={paged ? { maxHeight: 'calc(100cqh - 1.5rem)', breakInside: 'avoid' } : undefined}
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
            {chapterNodes(node.children, onNavigate, paged)}
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
          : createElement(node.tag, props, chapterNodes(node.children, onNavigate, paged));
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
  const { openEpub, epubReading } = useFiles();
  const reading = useEpubReadingState(entry, epubReading);
  const { fontIndex, layout, bookmarks } = reading.settings;
  const restore = useEffectEvent((chapterCount: number) => reading.restore(chapterCount));
  const { ref: workspace, matches: wide } = useContainerBreakpoint('4xl');
  const [contentsOpen, setContentsOpen] = useState<boolean>();
  const contentsVisible = contentsOpen ?? wide;
  const contentsId = useId();
  const pageControl = useRef<TurnPage>(null);
  const [edges, setEdges] = useState<PageEdges>({ first: true, last: true });
  const [opened, setOpened] = useState<{
    entry: EpubEntry;
    retry: number;
    result: ReadResult<EpubBook>;
  }>();
  const [target, setTarget] = useState<ReadingLocation>({ chapter: 0 });
  const [loaded, setLoaded] = useState<{
    book: EpubBook;
    index: number;
    retry: number;
    result: ReadResult<EpubChapter>;
  }>();
  const [bookRetry, setBookRetry] = useState(0);
  const [chapterRetry, setChapterRetry] = useState(0);
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
          setTarget(restore(value.chapters.length));
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
  const paged = layout === 'pages';
  const toc = book?.toc.length
    ? book.toc
    : (book?.chapters.map((_, index) => ({
        label: labels.name(index + 1),
        destination: { chapter: index },
      })) ?? []);
  const activeToc = toc.findIndex((item) => item.destination.chapter === chapter);
  function navigate(destination: ReadingLocation) {
    reading.flush();
    setTarget({ ...destination });
  }

  function addBookmark() {
    const position = reading.current.current.position;
    if (
      bookmarks.some(
        (bookmark) => bookmark.chapter === position.chapter && bookmark.ratio === position.ratio,
      )
    )
      return;
    reading.configure({ bookmarks: [...bookmarks, position] });
  }
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
        if (!open) {
          reading.flush();
          onClose();
        }
      }}
    >
      <div ref={workspace} className="flex h-full min-h-0 min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <IconAction label={t('files.download')} size="sm" tooltip onPress={onDownload}>
            <Download className="size-icon-sm" aria-hidden="true" />
          </IconAction>
          {book ? (
            <>
              <IconAction
                label={labels.previous}
                size="sm"
                tooltip
                disabled={chapter <= 0}
                onPress={() => navigate({ chapter: chapter - 1 })}
              >
                <ChevronLeft className="size-icon-sm" aria-hidden="true" />
              </IconAction>
              <span className="text-sm text-ink-muted" role="status">
                {labels.chapter(chapter + 1, book.chapters.length)}
              </span>
              <IconAction
                label={labels.next}
                size="sm"
                tooltip
                disabled={chapter >= book.chapters.length - 1}
                onPress={() => navigate({ chapter: chapter + 1 })}
              >
                <ChevronRight className="size-icon-sm" aria-hidden="true" />
              </IconAction>
              <IconAction
                label={labels.smaller}
                size="sm"
                tooltip
                disabled={fontIndex === 0}
                onPress={() => reading.configure({ fontIndex: fontIndex - 1 })}
              >
                <Minus className="size-icon-sm" aria-hidden="true" />
              </IconAction>
              <IconAction
                label={labels.larger}
                size="sm"
                tooltip
                disabled={fontIndex === epubFontScales.length - 1}
                onPress={() => reading.configure({ fontIndex: fontIndex + 1 })}
              >
                <Plus className="size-icon-sm" aria-hidden="true" />
              </IconAction>
              <IconAction
                label={paged ? labels.scroll : labels.pages}
                size="sm"
                tooltip
                active={paged}
                onPress={() => reading.configure({ layout: paged ? 'scroll' : 'pages' })}
              >
                {paged ? (
                  <Rows3 className="size-icon-sm" aria-hidden="true" />
                ) : (
                  <BookOpen className="size-icon-sm" aria-hidden="true" />
                )}
              </IconAction>
              <IconAction
                label={labels.contents}
                size="sm"
                tooltip
                active={contentsVisible}
                controls={contentsId}
                expanded={contentsVisible}
                onPress={() => setContentsOpen(!contentsVisible)}
              >
                <List className="size-icon-sm" aria-hidden="true" />
              </IconAction>
              <IconAction
                label={labels.start}
                size="sm"
                tooltip
                onPress={() => navigate({ chapter: 0 })}
              >
                <RotateCcw className="size-icon-sm" aria-hidden="true" />
              </IconAction>
            </>
          ) : null}
        </div>
        {reading.storageFailed ? (
          <p role="status" className="text-sm text-ink-muted">
            {labels.storage}
          </p>
        ) : null}
        {book?.author ? <p className="text-sm text-ink-muted">{book.author}</p> : null}
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
          <>
            <div
              className="flex min-h-0 min-w-0 flex-1 gap-3"
              style={{ flexDirection: wide ? 'row' : 'column' }}
            >
              <aside
                id={contentsId}
                hidden={!contentsVisible}
                className="overflow-auto rounded-panel border border-border p-2"
                style={wide ? { width: '12rem', flexShrink: 0 } : { maxHeight: '35%' }}
              >
                <nav aria-label={labels.contents} className="flex flex-col gap-1">
                  {toc.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-current={index === activeToc ? 'location' : undefined}
                      className={`rounded-control p-2 text-start text-sm ${index === activeToc ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-surface-muted'}`}
                      onClick={() => navigate(item.destination)}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
                <section aria-label={labels.bookmarks} className="mt-3 border-t border-border">
                  <p className="p-2 text-sm font-semibold">{labels.bookmarks}</p>
                  <Action
                    size="sm"
                    variant="secondary"
                    disabled={bookmarks.length >= epubBookmarkLimit}
                    onPress={addBookmark}
                  >
                    {labels.addBookmark}
                  </Action>
                  {bookmarks.map((bookmark) => {
                    const label = labels.bookmark(
                      bookmark.chapter + 1,
                      Math.round(bookmark.ratio * 100),
                    );
                    return (
                      <div
                        key={`${bookmark.chapter}:${bookmark.ratio}`}
                        className="flex flex-wrap gap-1"
                      >
                        <Action size="sm" variant="quiet" onPress={() => navigate(bookmark)}>
                          {label}
                        </Action>
                        <button
                          type="button"
                          className="rounded-control p-2 text-sm text-ink-muted hover:bg-surface-muted"
                          aria-label={`${labels.removeBookmark} · ${label}`}
                          onClick={() =>
                            reading.configure({
                              bookmarks: bookmarks.filter((saved) => saved !== bookmark),
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </section>
              </aside>
              <EpubReadingViewport
                label={labels.reading}
                location={target}
                content={chapterNodes(content.nodes, navigate, paged)}
                fontIndex={fontIndex}
                paged={paged}
                columns={wide ? 2 : 1}
                onPosition={(ratio) => reading.update({ chapter, ratio })}
                onEdges={(next) =>
                  setEdges((current) =>
                    current.first === next.first && current.last === next.last ? current : next,
                  )
                }
                pageControlRef={pageControl}
              />
            </div>
            {paged ? (
              <div className="flex items-center justify-center gap-2">
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={edges.first}
                  onPress={() => pageControl.current?.(-1)}
                >
                  {labels.previousPage}
                </Action>
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={edges.last}
                  onPress={() => pageControl.current?.(1)}
                >
                  {labels.nextPage}
                </Action>
              </div>
            ) : null}
          </>
        )}
      </div>
    </DialogSurface>
  );
}
