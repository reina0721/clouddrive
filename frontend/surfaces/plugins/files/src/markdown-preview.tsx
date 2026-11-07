'use client';

import { Component, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileMedia, useFiles } from '../../../src/files/runtime';
import type { FileEntry } from '../../../src/files/model';

const renderBytes = 256 * 1024;
const maxImages = 8;
const maxImageBytes = 2 * 1024 * 1024;
const maxLookupPages = 3;
const imageLookupPageSize = 50;
const encoder = new TextEncoder();

type PreviewBoundaryProps = { source: string; message: string; children: ReactNode };
class PreviewBoundary extends Component<PreviewBoundaryProps, { source: string; failed: boolean }> {
  override state = { source: this.props.source, failed: false };

  static getDerivedStateFromProps(props: PreviewBoundaryProps, state: PreviewBoundary['state']) {
    return props.source === state.source ? null : { source: props.source, failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? <p role="alert">{this.props.message}</p> : this.props.children;
  }
}

function siblingName(source: string) {
  if (!source || source.length > 1024) return undefined;
  try {
    const name = decodeURIComponent(source.replace(/^\.\//, '')).normalize('NFC');
    if (
      !name ||
      name === '.' ||
      name === '..' ||
      [...name].length > 255 ||
      /[\\/:?#]/.test(name) ||
      [...name].some((character) => character.charCodeAt(0) < 32)
    )
      return undefined;
    return name;
  } catch {
    return undefined;
  }
}

function httpLink(value: string) {
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password)
      return url.href;
  } catch {
    return undefined;
  }
  return undefined;
}

type RenderNode = {
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: RenderNode[];
};

function boundImages() {
  return (tree: RenderNode) => {
    const remaining = [tree];
    let images = 0;
    while (remaining.length) {
      const node = remaining.pop()!;
      if (node.tagName === 'img' && node.properties && ++images > maxImages)
        node.properties.src = '';
      if (node.children) {
        for (let index = node.children.length - 1; index >= 0; index--) {
          const child = node.children[index];
          if (child) remaining.push(child);
        }
      }
    }
  };
}

function SiblingImage({
  parentId,
  name,
  alt,
  missing,
}: {
  parentId: string;
  name: string;
  alt: string;
  missing: string;
}) {
  const files = useFiles();
  const [result, setResult] = useState<{ parentId: string; name: string; entry?: FileEntry }>();
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        for (let page = 1; page <= maxLookupPages; page++) {
          const listing = await files.list(
            {
              parent: parentId,
              search: name,
              category: 'image',
              trash: false,
              sort: 'name',
              desc: false,
              filters: { scope: 'folder', caseSensitive: true, kinds: ['file'] },
              pagination: 'numbered',
              page,
              pageSize: imageLookupPageSize,
            },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          const entry = listing.items.find(
            (item) =>
              item.parentId === parentId &&
              item.kind === 'file' &&
              !item.trashedAt &&
              item.name.normalize('NFC') === name &&
              item.mediaType.startsWith('image/'),
          );
          if (entry) {
            setResult({ parentId, name, entry });
            return;
          }
          if (page * listing.pageSize >= listing.total) break;
        }
      } catch {
        // 图片是独立的可选资源。失败时保留 Markdown 的替代文字。
      }
      if (!controller.signal.aborted) setResult({ parentId, name });
    })();
    return () => controller.abort();
  }, [files, parentId, name]);

  const current = result?.name === name && result.parentId === parentId ? result : undefined;
  return current?.entry ? (
    <FileMedia mode="inline" entry={current.entry} alt={alt} maxBytes={maxImageBytes} />
  ) : (
    <span title={current ? missing : undefined}>{alt}</span>
  );
}

export function MarkdownPreview({
  text,
  parentId,
  labels,
}: {
  text: string;
  parentId: string;
  labels: {
    preview: string;
    empty: string;
    tooLarge: string;
    missingImage: string;
    failed: string;
  };
}) {
  const source = useDeferredValue(text);
  const missingImage = labels.missingImage;
  const components = useMemo<Components>(
    () => ({
      h1: ({ children }) => <h1 className="mb-3 text-2xl font-bold">{children}</h1>,
      h2: ({ children }) => <h2 className="mb-3 text-xl font-bold">{children}</h2>,
      h3: ({ children }) => <h3 className="mb-2 text-lg font-semibold">{children}</h3>,
      h4: ({ children }) => <h4 className="mb-2 font-semibold">{children}</h4>,
      h5: ({ children }) => <h5 className="mb-2 font-semibold">{children}</h5>,
      h6: ({ children }) => <h6 className="mb-2 font-semibold">{children}</h6>,
      p: ({ children }) => <p className="mb-3">{children}</p>,
      ul: ({ children }) => (
        <ul className="mb-3 list-disc" style={{ paddingInlineStart: '1.25rem' }}>
          {children}
        </ul>
      ),
      ol: ({ children, start }) => (
        <ol
          className="mb-3"
          start={start}
          style={{ listStyleType: 'decimal', paddingInlineStart: '1.25rem' }}
        >
          {children}
        </ol>
      ),
      blockquote: ({ children }) => (
        <blockquote
          className="mb-3 border-l border-border text-ink-muted"
          style={{ paddingInlineStart: '0.75rem' }}
        >
          {children}
        </blockquote>
      ),
      pre: ({ children }) => (
        <pre className="mb-3 overflow-auto rounded-control bg-surface-muted p-2">{children}</pre>
      ),
      code: ({ children }) => (
        <code className="rounded-control bg-surface-muted font-mono text-sm">{children}</code>
      ),
      hr: () => <hr className="my-3 border-border" />,
      table: ({ children }) => (
        <div className="mb-3 overflow-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            {children}
          </table>
        </div>
      ),
      th: ({ children, style }) => (
        <th className="border border-border bg-surface-muted p-2" style={style}>
          {children}
        </th>
      ),
      td: ({ children, style }) => (
        <td className="border border-border p-2" style={style}>
          {children}
        </td>
      ),
      a: ({ children, href }) =>
        href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline">
            {children}
          </a>
        ) : (
          <span>{children}</span>
        ),
      img: ({ src, alt }) => {
        const name = typeof src === 'string' ? siblingName(src) : undefined;
        return name ? (
          <SiblingImage parentId={parentId} name={name} alt={alt ?? ''} missing={missingImage} />
        ) : alt ? (
          <span title={missingImage}>{alt}</span>
        ) : null;
      },
    }),
    [missingImage, parentId],
  );
  const rendered = useMemo(() => {
    if (encoder.encode(source).length > renderBytes) return <p role="status">{labels.tooLarge}</p>;
    if (!source.trim()) return <p className="text-sm text-ink-muted">{labels.empty}</p>;
    return (
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[boundImages]}
        components={components}
        urlTransform={(url, key) => (key === 'src' ? url : httpLink(url))}
      >
        {source}
      </ReactMarkdown>
    );
  }, [source, components, labels.empty, labels.tooLarge]);
  return (
    <article
      aria-label={labels.preview}
      className="min-w-0 overflow-auto rounded-panel border border-border bg-surface p-4 text-ink"
      style={{ minHeight: '12rem', overflowWrap: 'anywhere' }}
    >
      <PreviewBoundary source={source} message={labels.failed}>
        {rendered}
      </PreviewBoundary>
    </article>
  );
}
