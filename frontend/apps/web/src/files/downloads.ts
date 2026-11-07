import {
  downloadSchema,
  downloadListingSchema,
  downloadBatchSchema,
  torrentDetailSchema,
  FilesError,
  type DownloadsPort,
  type OfflineDownload,
} from '@clouddrive/surface/files';
import { z } from 'zod';
import type { createJsonClient } from '../api/json-client';
import { watchFileTaskRefresh } from './task-refresh';

const downloadRemovedSchema = z.object({ removed: z.literal(true) });
const downloadSourceSchema = z.object({ uri: z.string().url().max(4096) });

/** createDownloadsRuntime 拥有页面订阅的计时器和显式剪贴板操作，账号退出时统一释放。 */
export function createDownloadsRuntime(
  call: ReturnType<typeof createJsonClient>,
  assertCurrent: () => void,
) {
  const cleanups = new Set<() => void>();
  let disposed = false;
  const assertActive = () => {
    assertCurrent();
    if (disposed) throw new FilesError('canceled');
  };
  const activeCall: typeof call = async (path, options) => {
    assertActive();
    const value = await call(path, options);
    assertActive();
    return value;
  };
  const path = (task: OfflineDownload) => '/downloads/' + encodeURIComponent(task.id);
  const port: DownloadsPort = {
    newClientKey: () => {
      assertActive();
      return crypto.randomUUID();
    },
    list: async (filter, signal) => {
      assertActive();
      const result = downloadListingSchema.parse(
        await activeCall(
          '/downloads?' + new URLSearchParams(filter).toString(),
          signal ? { signal } : {},
        ),
      );
      assertActive();
      return result;
    },
    read: async (task, signal) =>
      downloadSchema.parse(await activeCall(path(task), signal ? { signal } : {})),
    create: async (items, signal) =>
      downloadBatchSchema.parse(
        await activeCall('/downloads/batch-create', {
          method: 'POST',
          body: { items },
          ...(signal ? { signal } : {}),
        }),
      ),
    pickTorrent: (maxBytes) => {
      assertActive();
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1048576)
        return Promise.reject(new FilesError('invalid'));
      return new Promise((resolve, reject) => {
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = '.torrent,application/x-bittorrent';
        picker.hidden = true;
        let finished = false;
        const cleanup = () => {
          picker.remove();
          cleanups.delete(cancel);
        };
        const cancel = () => {
          if (finished) return;
          finished = true;
          cleanup();
          resolve(undefined);
        };
        cleanups.add(cancel);
        picker.addEventListener('cancel', cancel, { once: true });
        picker.addEventListener(
          'change',
          () => {
            if (finished) return;
            finished = true;
            const file = picker.files?.[0];
            cleanup();
            if (!file) {
              resolve(undefined);
              return;
            }
            if (
              !file.name.toLowerCase().endsWith('.torrent') ||
              file.size < 1 ||
              file.size > maxBytes
            ) {
              reject(new FilesError(file.size > maxBytes ? 'large' : 'invalid'));
              return;
            }
            void file
              .arrayBuffer()
              .then((buffer) => {
                assertActive();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                const chunkBytes = 8192;
                for (let offset = 0; offset < bytes.length; offset += chunkBytes)
                  binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkBytes));
                resolve({ name: file.name, base64: btoa(binary) });
              })
              .catch((cause: unknown) =>
                reject(
                  cause instanceof FilesError ? cause : new FilesError('unavailable', { cause }),
                ),
              );
          },
          { once: true },
        );
        document.body.append(picker);
        try {
          picker.click();
        } catch (cause) {
          finished = true;
          cleanup();
          reject(new FilesError('unavailable', { cause }));
        }
      });
    },
    createTorrent: async (input) =>
      downloadSchema.parse(await activeCall('/torrent-downloads', { method: 'POST', body: input })),
    torrentDetail: async (task, signal) =>
      torrentDetailSchema.parse(
        await activeCall(
          '/torrent-downloads/' + encodeURIComponent(task.id),
          signal ? { signal } : {},
        ),
      ),
    selectTorrent: async (task, indexes) =>
      downloadSchema.parse(
        await activeCall('/torrent-downloads/' + encodeURIComponent(task.id) + '/selection', {
          method: 'PATCH',
          body: { revision: task.revision, indexes },
        }),
      ),
    command: async (task, command) =>
      downloadSchema.parse(
        await activeCall(path(task) + '/' + command, {
          method: 'POST',
          body: { revision: task.revision },
        }),
      ),
    retarget: async (task, parentId, name) =>
      downloadSchema.parse(
        await activeCall(path(task) + '/target', {
          method: 'PUT',
          body: { revision: task.revision, parentId, name },
        }),
      ),
    remove: async (task) => {
      downloadRemovedSchema.parse(
        await activeCall(path(task) + '/remove', {
          method: 'POST',
          body: { revision: task.revision },
        }),
      );
    },
    batch: async (tasks, action) =>
      downloadBatchSchema.parse(
        await activeCall('/downloads/batch-control', {
          method: 'POST',
          body: { action, items: tasks.map(({ id, revision }) => ({ id, revision })) },
        }),
      ),
    copySource: async (task) => {
      assertActive();
      if (!task.canCopySource) throw new FilesError('unsupported');
      const source = downloadSourceSchema.parse(await activeCall(path(task) + '/source'));
      assertActive();
      try {
        await navigator.clipboard.writeText(source.uri);
      } catch (cause) {
        throw new FilesError('unavailable', { cause });
      }
    },
    watch: (refresh) => watchFileTaskRefresh(assertActive, cleanups, refresh),
  };
  return {
    port,
    activate() {
      disposed = false;
    },
    dispose() {
      disposed = true;
      for (const cleanup of [...cleanups]) cleanup();
    },
  };
}
