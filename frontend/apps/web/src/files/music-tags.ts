export type MusicTags = Readonly<{
  title?: string;
  artist?: string;
  album?: string;
  cover?: Blob;
}>;

const metadataInputLimitBytes = 12 * 1024 * 1024;
const metadataTimeoutMs = 5_000;

/** readMusicTags 将可选标签解析限制在单曲生命周期内。 */
export async function readMusicTags(source: Blob, signal: AbortSignal) {
  if (source.size > metadataInputLimitBytes || signal.aborted) return undefined;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./music-tags.worker.ts', import.meta.url));
  } catch {
    // 浏览器禁用 Worker 时，主播放器继续显示文件名。
    return undefined;
  }
  return new Promise<MusicTags | undefined>((resolve) => {
    function finish(tags?: MusicTags) {
      window.clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
      resolve(tags);
    }
    const abort = () => finish();
    const timeout = window.setTimeout(abort, metadataTimeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event: MessageEvent<MusicTags | undefined>) => finish(event.data);
    worker.onerror = abort;
    worker.onmessageerror = abort;
    try {
      worker.postMessage(source);
    } catch {
      finish();
    }
  });
}
