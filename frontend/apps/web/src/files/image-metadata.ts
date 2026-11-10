import type { ImageExifField } from './image-metadata.worker';

export type ImageMetadata = Readonly<{
  fields: Partial<Record<ImageExifField, string>>;
  location?: Readonly<{ latitude: number; longitude: number }>;
}>;
type ImageMetadataResult =
  | Readonly<{ state: 'ready'; metadata: ImageMetadata }>
  | Readonly<{ state: 'large' | 'unavailable' }>;

export const imageMetadataLimitMiB = 12;
const metadataLimitBytes = imageMetadataLimitMiB * 1024 * 1024;
const metadataTimeoutMs = 5_000;

/** readImageMetadata 仅在面板打开时解析当前原件，线程随预览生命周期释放。 */
export function readImageMetadata(source: Blob, signal: AbortSignal): Promise<ImageMetadataResult> {
  if (source.size > metadataLimitBytes) return Promise.resolve({ state: 'large' });
  if (signal.aborted) return Promise.resolve({ state: 'unavailable' });
  let worker: Worker;
  try {
    worker = new Worker(new URL('./image-metadata.worker.ts', import.meta.url));
  } catch {
    return Promise.resolve({ state: 'unavailable' });
  }
  return new Promise((resolve) => {
    function finish(result: ImageMetadataResult) {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      resolve(result);
    }
    const abort = () => finish({ state: 'unavailable' });
    const timeout = window.setTimeout(abort, metadataTimeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<ImageMetadata | undefined>) =>
      finish(event.data ? { state: 'ready', metadata: event.data } : { state: 'unavailable' });
    worker.onerror = abort;
    worker.onmessageerror = abort;
    try {
      worker.postMessage(source);
    } catch {
      abort();
    }
  });
}
