import {
  FilesError,
  fileVersionPageSchema,
  fileEntrySchema,
  fileHistoryTextMaxBytes,
  type VersionsPort,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';
import { nativeDownload } from './native-download';

/** createVersionsPort 复用文件客户端与账号生命周期，原生下载不缓存整份大文件。 */
export function createVersionsPort(
  call: ReturnType<typeof createJsonClient>,
  base: string,
  assertCurrent: () => void,
) {
  const path = (id: string, revision: number) => {
    if (!Number.isSafeInteger(revision) || revision < 1) throw new FilesError('invalid');
    return '/' + encodeURIComponent(id) + '/versions/' + String(revision);
  };
  // 新旧比较与媒体共用有界读取顺序，避免同一面板并行抢占服务端传输名额。
  let readTail = Promise.resolve();
  const readContent = async (
    id: string,
    revision: number,
    signal?: AbortSignal,
    budget?: Readonly<{
      maxBlobBytes: number;
      timeoutMs: number;
      range?: Readonly<{ start: number; endExclusive: number; totalBytes: number }>;
    }>,
  ) => {
    const previous = readTail;
    let release = () => {};
    readTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      assertCurrent();
      if (signal?.aborted) throw new FilesError('canceled');
      const range = budget?.range;
      let rangeMatches = !range;
      const value = await call(path(id, revision) + '/content', {
        responseType: 'blob',
        ...(budget === undefined
          ? {}
          : { maxBlobBytes: budget.maxBlobBytes, timeoutMs: budget.timeoutMs }),
        ...(signal ? { signal } : {}),
        ...(range
          ? {
              headers: { Range: `bytes=${range.start}-${range.endExclusive - 1}` },
              onResponse: (response: Response) => {
                rangeMatches =
                  response.status === 206 &&
                  response.headers.get('Content-Range') ===
                    `bytes ${range.start}-${range.endExclusive - 1}/${range.totalBytes}`;
              },
            }
          : {}),
      });
      assertCurrent();
      if (signal?.aborted) throw new FilesError('canceled');
      if (!(value instanceof Blob)) throw new FilesError('unavailable');
      if (!rangeMatches) throw new FilesError('conflict');
      return value;
    } finally {
      release();
    }
  };
  const port: VersionsPort = {
    read: async (id, page, order, signal) => {
      assertCurrent();
      const value = fileVersionPageSchema.parse(
        await call(
          '/' +
            encodeURIComponent(id) +
            '/versions?' +
            new URLSearchParams({ page: String(page), order }).toString(),
          signal ? { signal } : {},
        ),
      );
      assertCurrent();
      if (value.entry.id !== id) throw new FilesError('invalid');
      return value;
    },
    text: async (id, version, maxBytes, signal) => {
      if (maxBytes < 1 || maxBytes > fileHistoryTextMaxBytes || version.sizeBytes > maxBytes)
        throw new FilesError('large');
      if (
        !version.mediaType.startsWith('text/') &&
        !/\.(txt|md|json|csv|xml|html|css|js|log)$/i.test(version.name)
      )
        throw new FilesError('unsupported');
      const value = await readContent(id, version.revision, signal);
      if (value.size !== version.sizeBytes) throw new FilesError('conflict');
      if (value.size > maxBytes) throw new FilesError('large');
      const bytes = new Uint8Array(await value.arrayBuffer());
      assertCurrent();
      if (bytes.includes(0)) throw new FilesError('unsupported');
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch (error) {
        throw new FilesError('unsupported', { cause: error });
      }
    },
    download: async (id, version) => {
      assertCurrent();
      await call(path(id, version.revision) + '/content', { method: 'HEAD', responseType: 'blob' });
      assertCurrent();
      nativeDownload(base + path(id, version.revision) + '/content', version.name);
    },
    restore: async (id, revision, input) => {
      assertCurrent();
      const value = await call(path(id, revision) + '/restore', { method: 'POST', body: input });
      assertCurrent();
      return fileEntrySchema.parse(value);
    },
    copy: async (id, revision, parentId, name) => {
      assertCurrent();
      const value = await call(path(id, revision) + '/copy', {
        method: 'POST',
        body: { parentId, name },
      });
      assertCurrent();
      return fileEntrySchema.parse(value);
    },
    remove: async (id, input) => {
      assertCurrent();
      await call('/' + encodeURIComponent(id) + '/versions', { method: 'DELETE', body: input });
      assertCurrent();
    },
  };
  return { port, readContent };
}
