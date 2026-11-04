import {
  FilesError,
  publicShareSchema,
  publicFileListingSchema,
  shareUnlockSchema,
  type PublicFilesPort,
} from '@clouddrive/surface/files';

const requestTimeoutMs = 120_000;
const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;

/** createPublicFilesRuntime 只使用分享 capability；不读取或发送 IAM Cookie。 */
export function createPublicFilesRuntime(token: string) {
  let ticket = '';
  let disposed = false;
  const controllers = new Set<AbortController>();
  const urls = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  async function call(
    suffix: string,
    options: { password?: string; signal?: AbortSignal; binary?: boolean } = {},
  ): Promise<unknown> {
    if (disposed || !shareTokenPattern.test(token)) throw new FilesError('missing');
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(`/api/v1/file-shares/${encodeURIComponent(token)}${suffix}`, {
        method: options.password === undefined ? 'GET' : 'POST',
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
      return options.binary ? await response.blob() : await response.json();
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
      const blob = await call(`/content/${encodeURIComponent(entry.id)}`, { binary: true });
      if (!(blob instanceof Blob)) throw new FilesError('unavailable');
      if (disposed) throw new FilesError('canceled');
      const url = URL.createObjectURL(blob);
      urls.add(url);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = entry.name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.delete(url);
        timers.delete(timer);
      }, 0);
      timers.add(timer);
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
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
