import {
  LoaderContextType,
  LoadStats,
  type Loader,
  type LoaderCallbacks,
  type LoaderConfiguration,
  type LoaderContext,
} from 'hls.js';
import { FilesError } from '@clouddrive/surface/files';
import type { PrivateHlsSession } from './hls-source';

const playlistTypes: ReadonlySet<LoaderContextType> = new Set([
  LoaderContextType.MANIFEST,
  LoaderContextType.LEVEL,
  LoaderContextType.AUDIO_TRACK,
  LoaderContextType.SUBTITLE_TRACK,
]);

const status = {
  unauthenticated: 401,
  forbidden: 403,
  missing: 404,
  conflict: 409,
  large: 413,
  invalid: 422,
  unsupported: 422,
} as const;

/** privateHlsLoader 截获全部资源请求，只交付 Host 已授权的正文和分片。 */
export function privateHlsLoader(source: PrivateHlsSession, report: (error: FilesError) => void) {
  return class PrivateHlsLoader implements Loader<LoaderContext> {
    context: LoaderContext | null = null;
    stats = new LoadStats();
    private active:
      { controller: AbortController; callbacks: LoaderCallbacks<LoaderContext> } | undefined;

    load(
      context: LoaderContext,
      _config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>,
    ) {
      this.abort();
      this.context = context;
      const controller = new AbortController();
      this.active = { controller, callbacks };
      const stats = new LoadStats();
      stats.loading.start = performance.now();
      this.stats = stats;
      void this.read(context, controller.signal).then(
        ({ bytes, response }) => {
          if (controller.signal.aborted) return;
          this.active = undefined;
          stats.loading.first = stats.loading.end = performance.now();
          stats.loaded = stats.total = bytes;
          stats.chunkCount = 1;
          if (context.progressData) callbacks.onProgress?.(stats, context, response, null);
          callbacks.onSuccess(
            { url: context.url, data: response, code: 200 },
            stats,
            context,
            null,
          );
        },
        (cause: unknown) => {
          if (controller.signal.aborted) return;
          this.active = undefined;
          stats.loading.end = performance.now();
          const failure =
            cause instanceof FilesError ? cause : new FilesError('unavailable', { cause });
          report(failure);
          if (failure.code === 'timeout') callbacks.onTimeout(stats, context, null);
          else {
            const code = Object.hasOwn(status, failure.code)
              ? status[failure.code as keyof typeof status]
              : 0;
            callbacks.onError({ code, text: failure.code }, context, null, stats);
          }
        },
      );
    }

    private async read(context: LoaderContext, signal: AbortSignal) {
      const playlist = playlistTypes.has(context.type);
      const kind = playlist
        ? 'playlist'
        : context.type === LoaderContextType.KEY
          ? 'key'
          : 'segment';
      if (
        !playlist &&
        context.type !== LoaderContextType.KEY &&
        context.type !== LoaderContextType.MEDIA_FRAGMENT
      )
        throw new FilesError('unsupported');
      const range = context.rangeEnd
        ? { start: context.rangeStart ?? 0, endExclusive: context.rangeEnd }
        : undefined;
      const bytes = await source.read(
        { url: context.url, kind, ...(range ? { range } : {}) },
        signal,
      );
      if (!playlist) return { bytes: bytes.byteLength, response: bytes };
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch (cause) {
        throw new FilesError('invalid', { cause });
      }
      if (!/^#EXTM3U(?:\r?\n|$)/.test(text) || text.includes('\0')) throw new FilesError('invalid');
      return { bytes: bytes.byteLength, response: text };
    }

    abort() {
      const active = this.active;
      this.active = undefined;
      if (!active || !this.context) return;
      this.stats.aborted = true;
      active.controller.abort();
      active.callbacks.onAbort?.(this.stats, this.context, null);
    }

    destroy() {
      this.active?.controller.abort();
      this.active = undefined;
      this.context = null;
    }
  };
}
