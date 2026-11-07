import type { FileEntry } from './model';

export type EpubEntry = Pick<
  FileEntry,
  'id' | 'name' | 'mediaType' | 'sizeBytes' | 'contentRevision'
>;

export const epubLimits = {
  fileBytes: 24 * 1024 * 1024,
  packageEntries: 1024,
  xmlBytes: 2 * 1024 * 1024,
  chapterImageBytes: 6 * 1024 * 1024,
  chapterImages: 16,
  nodes: 12000,
  depth: 40,
  workTimeoutMs: 30_000,
} as const;

export function isEpubDocument(entry: Pick<EpubEntry, 'name' | 'mediaType'>) {
  return /\.epub$/i.test(entry.name) || /^application\/epub\+zip(?:;|$)/i.test(entry.mediaType);
}

export const epubTags = [
  'section',
  'div',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'strong',
  'em',
  'b',
  'i',
  'sub',
  'sup',
  'figure',
  'figcaption',
  'dl',
  'dt',
  'dd',
  'ruby',
  'rt',
  'rp',
] as const;
export type EpubTag = (typeof epubTags)[number];
export type EpubDestination = Readonly<{ chapter: number; fragment?: string }>;
export type EpubTocEntry = Readonly<{ label: string; destination: EpubDestination }>;
export type EpubNode =
  | Readonly<{ kind: 'text'; value: string }>
  | Readonly<{ kind: 'element'; tag: EpubTag; anchor?: string; children: readonly EpubNode[] }>
  | Readonly<{ kind: 'link'; destination: EpubDestination; children: readonly EpubNode[] }>
  | Readonly<{ kind: 'image'; url: string; alt: string }>;

export type EpubChapter = Readonly<{
  nodes: readonly EpubNode[];
  release(): void;
}>;
export type EpubBook = Readonly<{
  title: string;
  author: string;
  chapters: readonly string[];
  toc: readonly EpubTocEntry[];
  chapter(index: number, signal: AbortSignal): Promise<EpubChapter>;
  release(): void;
}>;
