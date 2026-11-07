import { Uint8ArrayReader, ZipReader, type FileEntry } from '@zip.js/zip.js/lib/zip-native.js';
import {
  epubLimits,
  epubTags,
  FilesError,
  type EpubBook,
  type EpubChapter,
  type EpubNode,
  type EpubTag,
} from '@clouddrive/surface/files';
import { epubDestination, parseEpubXML, readEpubPackage, resolveEpubPath } from './epub-package';
import { rasterType } from './media-signatures';

const supportedTags = new Set<string>(epubTags);
const omitted = new Set([
  'script',
  'style',
  'link',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'svg',
  'math',
  'audio',
  'video',
  'template',
]);

function readFailure(error: unknown, signal: AbortSignal) {
  if (signal.aborted)
    return new FilesError(
      signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
        ? 'timeout'
        : 'canceled',
      { cause: error },
    );
  return error instanceof FilesError ? error : new FilesError('unsupported', { cause: error });
}

async function zipMembers(bytes: ArrayBuffer, signal: AbortSignal) {
  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(bytes)), {
    filenameValidation: 'strict',
  });
  const files = new Map<string, FileEntry>();
  let count = 0;
  try {
    for await (const member of reader.getEntriesGenerator()) {
      signal.throwIfAborted();
      if (++count > epubLimits.packageEntries) throw new FilesError('large');
      if (member.directory) continue;
      if (member.filename.length > 4096 || files.has(member.filename))
        throw new FilesError('unsupported');
      files.set(member.filename, member);
    }
  } finally {
    // Uint8ArrayReader 为随机访问源，成员仍由会话持有，不依赖目录迭代器。
    await reader.close();
  }
  return files;
}

async function memberBytes(member: FileEntry | undefined, maxBytes: number, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!member || member.encrypted) throw new FilesError('unsupported');
  if (
    !Number.isSafeInteger(member.uncompressedSize) ||
    member.uncompressedSize < 0 ||
    member.uncompressedSize > maxBytes
  )
    throw new FilesError('large');
  const bytes = new Uint8Array(member.uncompressedSize);
  let offset = 0;
  try {
    await member.getData(
      new WritableStream<Uint8Array>({
        write(chunk) {
          signal.throwIfAborted();
          if (offset + chunk.length > bytes.length) throw new FilesError('large');
          bytes.set(chunk, offset);
          offset += chunk.length;
        },
      }),
      { signal, checkCrc32: true, useWebWorkers: false, checkOverlappingEntry: true },
    );
  } catch (error) {
    throw readFailure(error, signal);
  }
  if (offset !== bytes.length) throw new FilesError('unsupported');
  return bytes;
}

export async function openEpubBook(
  bytes: ArrayBuffer,
  signal: AbortSignal,
  owner: AbortSignal,
): Promise<EpubBook> {
  if (bytes.byteLength > epubLimits.fileBytes) throw new FilesError('large');
  try {
    const files = await zipMembers(bytes, signal);
    const read = (path: string, limit: number, source: AbortSignal) =>
      memberBytes(files.get(path), limit, source);
    const publication = await readEpubPackage(read, signal);
    const session = new AbortController();
    async function chapter(index: number, requested: AbortSignal): Promise<EpubChapter> {
      const selectedPath = publication.chapters[index];
      if (!selectedPath) throw new FilesError('invalid');
      const path: string = selectedPath;
      const active = AbortSignal.any([
        requested,
        owner,
        session.signal,
        AbortSignal.timeout(epubLimits.workTimeoutMs),
      ]);
      const urls = new Map<string, string | undefined>();
      let imageBytes = 0;
      let count = 0;
      const release = () => {
        for (const url of urls.values()) if (url) URL.revokeObjectURL(url);
        urls.clear();
      };
      async function image(element: Element): Promise<EpubNode[]> {
        const alt = (element.getAttribute('alt') ?? '').slice(0, 512);
        const source = resolveEpubPath(path, element.getAttribute('src') ?? '')?.path;
        const resource = source ? publication.resources.get(source) : undefined;
        if (
          source &&
          resource?.mediaType.startsWith('image/') &&
          !urls.has(source) &&
          urls.size < epubLimits.chapterImages
        ) {
          const budget = epubLimits.chapterImageBytes - imageBytes;
          const member = files.get(source);
          urls.set(source, undefined);
          if (member && member.uncompressedSize <= budget && !member.encrypted) {
            try {
              const data = await memberBytes(member, budget, active);
              imageBytes += data.byteLength;
              const blob = new Blob([data]);
              const type = await rasterType(blob);
              active.throwIfAborted();
              if (type) urls.set(source, URL.createObjectURL(new Blob([blob], { type })));
            } catch (error) {
              if (active.aborted) throw error;
              if (!(error instanceof FilesError)) throw error;
              // 损坏的可选插图以原替代文字呈现。
            }
          }
        }
        const url = source ? urls.get(source) : undefined;
        return url ? [{ kind: 'image', url, alt }] : alt ? [{ kind: 'text', value: alt }] : [];
      }
      async function nodes(parent: Element, depth: number): Promise<EpubNode[]> {
        if (depth > epubLimits.depth) throw new FilesError('large');
        const result: EpubNode[] = [];
        for (const node of parent.childNodes) {
          active.throwIfAborted();
          if (++count > epubLimits.nodes) throw new FilesError('large');
          if (node.nodeType === 3 || node.nodeType === 4) {
            if (node.nodeValue) result.push({ kind: 'text', value: node.nodeValue });
            continue;
          }
          if (!(node instanceof Element)) continue;
          const tag = node.localName.toLowerCase();
          if (omitted.has(tag)) continue;
          if (tag === 'img') {
            result.push(...(await image(node)));
            continue;
          }
          const children = await nodes(node, depth + 1);
          const id = node.getAttribute('id') ?? (tag === 'a' ? node.getAttribute('name') : null);
          const anchor = id && id.length <= 512 ? { anchor: id } : {};
          if (tag === 'a') {
            const destination = epubDestination(
              publication.chapters,
              path,
              node.getAttribute('href') ?? '',
            );
            if (Object.keys(anchor).length)
              result.push({ kind: 'element', tag: 'span', ...anchor, children: [] });
            if (destination) result.push({ kind: 'link', destination, children });
            else result.push(...children);
          } else if (supportedTags.has(tag)) {
            result.push({ kind: 'element', tag: tag as EpubTag, ...anchor, children });
          } else {
            result.push(...children);
          }
        }
        return result;
      }
      try {
        const document = parseEpubXML(await read(path, epubLimits.xmlBytes, active));
        const body = document.getElementsByTagNameNS('*', 'body')[0];
        if (!body) throw new FilesError('unsupported');
        const content = await nodes(body, 0);
        active.throwIfAborted();
        return { nodes: content, release };
      } catch (error) {
        release();
        throw readFailure(error, active);
      }
    }
    return {
      title: publication.title,
      author: publication.author,
      chapters: publication.chapters,
      toc: publication.toc,
      chapter,
      release() {
        session.abort();
        files.clear();
      },
    };
  } catch (error) {
    throw readFailure(error, signal);
  }
}
