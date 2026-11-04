import {
  FilesError,
  publicShareSchema,
  publicFileListingSchema,
  shareUnlockSchema,
  shareDownloadGrantSchema,
  type PublicFilesPort,
} from '@clouddrive/surface/files';
import { nativeDownload } from './native-download';

const requestTimeoutMs = 120_000;
const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;

/** createPublicFilesRuntime 的 JSON 请求不带 IAM Cookie，原生下载仅使用单文件 capability。 */
export function createPublicFilesRuntime(token: string) {
  let ticket = '';
  let disposed = false;
  const controllers = new Set<AbortController>();
  async function call(
    suffix: string,
    options: { password?: string; signal?: AbortSignal; download?: boolean } = {},
  ): Promise<unknown> {
    if (disposed || !shareTokenPattern.test(token)) throw new FilesError('missing');
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(`/api/v1/file-shares/${encodeURIComponent(token)}${suffix}`, {
        method: options.password === undefined && !options.download ? 'GET' : 'POST',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: options.signal
          ? AbortSignal.any([controller.signal, options.signal])
          : controller.signal,
        headers: {
          ...(ticket ? { 'X-Share-Grant': ticket } : {}),
          ...(options.password === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(options.password === undefined
          ? {}
          : { body: JSON.stringify({ password: options.password }) }),
      });
      if (!response.ok) {
        await response.arrayBuffer();
        throw new FilesError(
          response.status === 404
            ? 'missing'
            : response.status === 403
              ? 'locked'
              : response.status === 429
                ? 'busy'
                : response.status === 413
                  ? 'large'
                  : 'unavailable',
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof FilesError) throw error;
      throw new FilesError(options.signal?.aborted || disposed ? 'canceled' : 'unavailable', {
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }
  const port: PublicFilesPort = {
    metadata: async (signal) => publicShareSchema.parse(await call('', signal ? { signal } : {})),
    unlock: async (password, signal) => {
      const result = shareUnlockSchema.parse(
        await call('/unlock', { password, ...(signal ? { signal } : {}) }),
      );
      ticket = result.ticket;
    },
    entries: async (parent, signal) =>
      publicFileListingSchema.parse(
        await call(`/entries?${new URLSearchParams({ parent })}`, signal ? { signal } : {}),
      ),
    download: async (entry) => {
      const grant = shareDownloadGrantSchema.parse(
        await call('/content/' + encodeURIComponent(entry.id) + '/download', { download: true }),
      );
      if (disposed) throw new FilesError('canceled');
      nativeDownload('/api/v1/file-downloads/' + encodeURIComponent(grant.ticket), entry.name);
    },
  };
  return {
    port,
    activate: () => {
      disposed = false;
    },
    dispose: () => {
      disposed = true;
      ticket = '';
      for (const controller of controllers) controller.abort();
      controllers.clear();
    },
  };
}
