import { useEffectEvent, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { epubFontScales, type EpubDestination } from '../../../src/files/epub-contract';

export type ReadingLocation = EpubDestination & { ratio?: number };
export type TurnPage = (direction: -1 | 1) => void;
export type PageEdges = Readonly<{ first: boolean; last: boolean }>;
const columnGapPx = 32;
const edgeTolerancePx = 1;

function readingMetrics(root: HTMLElement, paged: boolean) {
  return paged
    ? { offset: root.scrollLeft, extent: root.scrollWidth - root.clientWidth }
    : { offset: root.scrollTop, extent: root.scrollHeight - root.clientHeight };
}

export function EpubReadingViewport({
  label,
  location,
  content,
  fontIndex,
  paged,
  columns,
  onPosition,
  onEdges,
  pageControlRef,
}: {
  label: string;
  location: ReadingLocation;
  content: ReactNode;
  fontIndex: number;
  paged: boolean;
  columns: 1 | 2;
  onPosition: (ratio: number) => void;
  onEdges: (edges: PageEdges) => void;
  pageControlRef: RefObject<TurnPage | null>;
}) {
  const article = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const lastLocation = useRef<ReadingLocation>(null);
  const ratio = useRef(0);

  const report = useEffectEvent((root: HTMLElement) => {
    const { offset, extent } = readingMetrics(root, paged);
    ratio.current = extent > 0 ? Math.max(0, Math.min(1, offset / extent)) : 0;
    onPosition(ratio.current);
    if (paged) {
      onEdges({ first: offset <= edgeTolerancePx, last: extent - offset <= edgeTolerancePx });
    }
  });

  // 只有几何或导航变化才重新定位，正文滚动不会触发 React 重排。
  useLayoutEffect(() => {
    const root = article.current;
    const chapterBody = body.current;
    if (!root || !chapterBody) return;
    const isNavigation = location !== lastLocation.current;
    lastLocation.current = location;
    let preferredRatio = isNavigation ? (location.ratio ?? 0) : ratio.current;
    const fragment = isNavigation ? location.fragment : undefined;
    let anchor = fragment
      ? Array.from(root.querySelectorAll<HTMLElement>('[data-epub-anchor]')).find(
          (element) => element.dataset.epubAnchor === fragment,
        )
      : undefined;
    const geometry = () =>
      [root.clientWidth, root.clientHeight, root.scrollWidth, root.scrollHeight].join(':');
    let measured = '';
    const stride = () => chapterBody.clientWidth + columnGapPx;
    let placedOffset = 0;

    function place() {
      if (!root) return;
      const { extent } = readingMetrics(root, paged);
      let offset = extent * preferredRatio;
      if (anchor) {
        const frame = root.getBoundingClientRect();
        const target = anchor.getClientRects()[0];
        if (target) {
          offset = paged
            ? Math.floor((root.scrollLeft + target.left - frame.left) / stride()) * stride()
            : root.scrollTop + target.top - frame.top - root.clientTop;
        }
      }
      if (paged) {
        root.scrollTop = 0;
        root.scrollLeft = offset;
      } else {
        root.scrollLeft = 0;
        root.scrollTop = offset;
      }
      measured = geometry();
      placedOffset = readingMetrics(root, paged).offset;
      report(root);
    }

    place();
    const handleScroll = () => {
      if (geometry() !== measured) return;
      if (Math.abs(readingMetrics(root, paged).offset - placedOffset) <= edgeTolerancePx) return;
      anchor = undefined;
      report(root);
      preferredRatio = ratio.current;
      placedOffset = readingMetrics(root, paged).offset;
    };
    const resize = () => {
      if (geometry() !== measured) place();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    observer.observe(chapterBody);
    root.addEventListener('load', resize, true);
    root.addEventListener('scroll', handleScroll, { passive: true });
    const turnPage: TurnPage | null = paged
      ? (direction) => {
          const page = stride();
          const offset = root.scrollLeft;
          const next =
            direction > 0
              ? Math.floor((offset + edgeTolerancePx) / page) + 1
              : Math.ceil((offset - edgeTolerancePx) / page) - 1;
          root.scrollLeft = next * page;
          handleScroll();
        }
      : null;
    const handleKey = (event: KeyboardEvent) => {
      if (
        !turnPage ||
        event.target !== root ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        turnPage(-1);
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        turnPage(1);
      }
    };
    root.addEventListener('keydown', handleKey);
    pageControlRef.current = turnPage;
    return () => {
      observer.disconnect();
      root.removeEventListener('load', resize, true);
      root.removeEventListener('scroll', handleScroll);
      root.removeEventListener('keydown', handleKey);
      pageControlRef.current = null;
    };
  }, [location, paged, columns, fontIndex, pageControlRef]);

  return (
    <article
      ref={article}
      aria-label={label}
      className="min-h-0 min-w-0 flex-1 overflow-auto break-words rounded-panel border border-border bg-surface p-4"
      style={{
        fontSize: `${epubFontScales[fontIndex] ?? 1}rem`,
        lineHeight: 1.7,
        ...(paged ? { overflowX: 'hidden', overflowY: 'hidden', direction: 'ltr' } : {}),
      }}
      // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex -- 正文是可独立聚焦、滚动和翻页的阅读区域。
      tabIndex={0}
    >
      <div
        ref={body}
        style={
          paged
            ? {
                height: '100%',
                columnCount: columns,
                columnGap: columnGapPx,
                columnFill: 'auto',
                containerType: 'size',
              }
            : undefined
        }
      >
        {content}
      </div>
    </article>
  );
}
