import type { FileEntry } from '../../../src/files/model';
import { isHlsPlaylist } from '../../../src/files/model';
import { isPDFDocument, type FileDocumentProps } from '../../../src/files/pdf-contract';
import { isEpubDocument } from '../../../src/files/epub-contract';
import { isMarkdownFile } from '../../../src/files/markdown';
import { fileIconExtension } from '../../../src/files/icon-rules';
import {
  isTextPreview,
  type FileApplicationID,
  type FileApplicationPolicy,
  type WebFileApplicationItem,
} from '../../../src/files/file-applications';
import type { TextRequest } from './text-dialog';
import type { DrawioRequest } from './drawio-dialog';

export const archiveFile = (entry: FileEntry) =>
  entry.kind === 'file' &&
  (/\.(zip|7z)$/i.test(entry.name) ||
    entry.mediaType === 'application/zip' ||
    entry.mediaType === 'application/x-7z-compressed');

export function compatibleFileApplications(
  entry: FileEntry,
  builtInText: boolean,
): FileApplicationID[] {
  if (archiveFile(entry)) return ['archive'];
  if (isPDFDocument(entry)) return ['pdf'];
  if (isEpubDocument(entry)) return ['epub'];
  if (isMarkdownFile(entry)) return ['markdown', 'text'];
  if (isHlsPlaylist(entry)) return ['video'];
  const media = entry.mediaType.split('/', 1)[0];
  if (fileIconExtension(entry.name) === 'drawio') return ['drawio'];
  if (media === 'image' || media === 'audio' || media === 'video') return [media];
  return isTextPreview(entry) || builtInText ? ['text'] : [];
}

export function configuredFileApplications(entry: FileEntry): FileApplicationID[] {
  const options: FileApplicationID[] = ['pdf', 'epub', 'markdown', 'text', 'drawio'];
  if (archiveFile(entry)) options.push('archive');
  const media = entry.mediaType.split('/', 1)[0];
  if (media === 'image' || media === 'audio' || media === 'video') options.push(media);
  if (isHlsPlaylist(entry) && !options.includes('video')) options.push('video');
  return options;
}

export type FileApplicationPicker = Readonly<{
  entry: FileEntry;
  options?: readonly FileApplicationID[];
  webOptions?: readonly WebFileApplicationItem[];
  policy?: FileApplicationPolicy;
  error?: string;
}>;

export type MediaReaderSession = {
  kind: 'media';
  entry: FileEntry;
  maxBytes: number;
  videoPlaylist?: true;
  savedImageVersion?: boolean;
  album?: { entries: readonly FileEntry[]; index: number };
};

/** 阅读会话只允许一个应用；预算与文件快照属于会话，不随列表刷新改变。 */
export type FileReaderSession =
  | ({ kind: 'selecting'; scope: string; visible: boolean } & FileApplicationPicker)
  | { kind: 'text'; request: TextRequest; maxBytes: number }
  | { kind: 'drawio'; request: DrawioRequest; maxBytes: number }
  | ({ kind: 'pdf' } & Pick<FileDocumentProps, 'entry' | 'limits'>)
  | { kind: 'epub'; entry: FileEntry }
  | { kind: 'archive'; entry: FileEntry }
  | MediaReaderSession
  | { kind: 'web'; entry: FileEntry; application: WebFileApplicationItem };
