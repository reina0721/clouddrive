import { FilesError, type FileEntry, type FilesPort } from '@clouddrive/surface/files';
import type { FileMediaProps } from '@clouddrive/surface/files/runtime';
import { withFileIOAdmissionRetry } from './file-io-retry';
import type { createVersionsPort } from './versions';

const virtualOrigin = 'https://private-hls.invalid';
const maxPathComponents = 32;
const maxPathCharacters = 4096;
const maxNameCharacters = 255;
const maxLookupPages = 4;
const lookupPageSize = 50;
const playlistBytes = 256 * 1024;
const aes128KeyBytes = 16;
const workTimeoutMs = 20_000;
const segmentBytes = 32 * 1024 * 1024;

type HlsEntry = FileMediaProps['entry'];
type Resource = Readonly<{
  url: string;
  kind: 'playlist' | 'key' | 'segment';
  range?: Readonly<{ start: number; endExclusive: number }>;
}>;

export type PrivateHlsSession = Readonly<{
  url: string;
  read(resource: Resource, signal: AbortSignal): Promise<ArrayBuffer>;
}>;

function absolutePath(parts: readonly string[]) {
  return virtualOrigin + '/' + parts.map(encodeURIComponent).join('/');
}

export function privateHlsPath(address: string): readonly string[] {
  if (address.length > maxPathCharacters) throw new FilesError('large');
  try {
    const url = new URL(address);
    if (url.origin !== virtualOrigin || url.username || url.password || url.search || url.hash)
      throw new FilesError('forbidden');
    const parts = url.pathname.slice(1).split('/').map(decodeURIComponent);
    if (parts.length > maxPathComponents) throw new FilesError('large');
    if (
      parts.some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          part.trim() !== part ||
          /[\\/\p{Cc}]/u.test(part) ||
          [...part].length > maxNameCharacters,
      )
    )
      throw new FilesError('invalid');
    return parts;
  } catch (error) {
    if (error instanceof FilesError) throw error;
    throw new FilesError('invalid', { cause: error });
  }
}

function validateRoot(detail: Awaited<ReturnType<FilesPort['detail']>>, entry: HlsEntry) {
  if (detail.entry.id !== entry.id || detail.entry.kind !== 'file' || detail.entry.trashedAt)
    throw new FilesError('missing');
  return absolutePath([...detail.breadcrumbs.map((folder) => folder.name), detail.entry.name]);
}

/** createPrivateHlsSource 将引擎地址解释为本人文件路径，实际读取仍复用内容修订接口。 */
export function createPrivateHlsSource(
  files: Pick<FilesPort, 'detail' | 'list'>,
  readContent: ReturnType<typeof createVersionsPort>['readContent'],
  assertCurrent: () => void,
) {
  async function findChild(
    parent: string,
    name: string,
    kind: 'folder' | 'file',
    signal: AbortSignal,
  ) {
    for (let page = 1; page <= maxLookupPages; page += 1) {
      const listing = await files.list(
        {
          parent,
          search: '',
          category: '',
          trash: false,
          sort: 'name',
          desc: false,
          pagination: 'numbered',
          page,
          pageSize: lookupPageSize,
          filters: { scope: 'folder', keywords: [name], caseSensitive: true, kinds: [kind] },
        },
        signal,
      );
      const match = listing.items.find(
        (item) =>
          item.kind === kind &&
          item.parentId === parent &&
          !item.trashedAt &&
          item.name.normalize('NFC') === name.normalize('NFC'),
      );
      if (match) return match;
      if (listing.page * listing.pageSize >= listing.total) throw new FilesError('missing');
    }
    throw new FilesError('large');
  }

  return async (
    entry: HlsEntry,
    maxBytes: number,
    lifetime: AbortSignal,
  ): Promise<PrivateHlsSession> => {
    assertCurrent();
    const detail = await files.detail(entry.id, lifetime);
    const url = validateRoot(detail, entry);
    if (
      detail.entry.contentRevision !== entry.contentRevision ||
      detail.entry.sizeBytes !== entry.sizeBytes
    )
      throw new FilesError('conflict');
    privateHlsPath(url);
    let initial = true;
    return {
      url,
      async read(resource, requestSignal) {
        assertCurrent();
        const deadline = AbortSignal.timeout(workTimeoutMs);
        const signal = AbortSignal.any([lifetime, requestSignal, deadline]);
        try {
          const parts = privateHlsPath(resource.url);
          let target: FileEntry;
          if (resource.url === url && resource.kind === 'playlist') {
            if (initial) target = detail.entry;
            else {
              const latest = await files.detail(entry.id, signal);
              if (validateRoot(latest, entry) !== url) throw new FilesError('conflict');
              target = latest.entry;
            }
          } else {
            let parent = '';
            for (const folder of parts.slice(0, -1))
              parent = (await findChild(parent, folder, 'folder', signal)).id;
            target = await findChild(parent, parts.at(-1)!, 'file', signal);
          }
          const range = resource.range;
          if (
            range &&
            (resource.kind !== 'segment' ||
              !Number.isSafeInteger(range.start) ||
              !Number.isSafeInteger(range.endExclusive) ||
              range.start < 0 ||
              range.endExclusive <= range.start ||
              range.endExclusive > target.sizeBytes)
          )
            throw new FilesError('invalid');
          const expectedBytes = range ? range.endExclusive - range.start : target.sizeBytes;
          const limit =
            resource.kind === 'playlist'
              ? playlistBytes
              : resource.kind === 'key'
                ? aes128KeyBytes
                : Math.min(maxBytes, segmentBytes);
          if (expectedBytes > limit) throw new FilesError('large');
          if (expectedBytes === 0 || (resource.kind === 'key' && expectedBytes !== aes128KeyBytes))
            throw new FilesError('invalid');
          const blob = await withFileIOAdmissionRetry(
            () =>
              readContent(target.id, target.contentRevision, signal, {
                maxBlobBytes: expectedBytes,
                timeoutMs: workTimeoutMs,
                ...(range ? { range: { ...range, totalBytes: target.sizeBytes } } : {}),
              }),
            signal,
            assertCurrent,
          );
          if (blob.size !== expectedBytes) throw new FilesError('conflict');
          const bytes = await blob.arrayBuffer();
          assertCurrent();
          signal.throwIfAborted();
          if (resource.url === url && resource.kind === 'playlist') initial = false;
          return bytes;
        } catch (error) {
          if (lifetime.aborted || requestSignal.aborted)
            throw new FilesError('canceled', { cause: error });
          if (deadline.aborted) throw new FilesError('timeout', { cause: error });
          throw error;
        }
      },
    };
  };
}
