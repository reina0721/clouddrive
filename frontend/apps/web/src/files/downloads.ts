import {
  downloadSchema,
  downloadListingSchema,
  downloadBatchSchema,
  FilesError,
  type DownloadsPort,
  type OfflineDownload,
} from '@clouddrive/surface/files';
import { z } from 'zod';
import type { createJsonClient } from '../api/json-client';

const downloadRefreshIntervalMs = 5000;
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
      const source = downloadSourceSchema.parse(await activeCall(path(task) + '/source'));
      assertActive();
      try {
        await navigator.clipboard.writeText(source.uri);
      } catch (cause) {
        throw new FilesError('unavailable', { cause });
      }
    },
    watch: (refresh) => {
      assertActive();
      let closed = false;
      const tick = () => {
        if (closed || disposed || document.visibilityState !== 'visible') return;
        try {
          assertCurrent();
        } catch {
          cleanup();
          return;
        }
        refresh();
      };
      const timer = window.setInterval(tick, downloadRefreshIntervalMs);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        window.clearInterval(timer);
        document.removeEventListener('visibilitychange', tick);
        cleanups.delete(cleanup);
      };
      document.addEventListener('visibilitychange', tick);
      cleanups.add(cleanup);
      return cleanup;
    },
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
