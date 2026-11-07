import { FilesError } from '@clouddrive/surface/files';
import {
  subtitleLimits,
  type SubtitleCue,
  type SubtitleJob,
  type SubtitleWorkResult,
} from './subtitle-contract';

/** parseSubtitle 在受限时间内处理字幕；调用方取消时终止 Worker。 */
export async function parseSubtitle(job: SubtitleJob, signal: AbortSignal): Promise<SubtitleCue[]> {
  signal.throwIfAborted();
  const worker = new Worker(new URL('./subtitle-worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(new FilesError('canceled'));
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new FilesError('timeout'));
    }, subtitleLimits.parseTimeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    worker.addEventListener(
      'message',
      (event: MessageEvent<SubtitleWorkResult>) => {
        finish();
        if (event.data.kind === 'cues') resolve(event.data.cues);
        else reject(new FilesError(event.data.kind));
      },
      { once: true },
    );
    worker.addEventListener(
      'error',
      (event) => {
        event.preventDefault();
        finish();
        reject(new FilesError('unavailable'));
      },
      { once: true },
    );
    try {
      worker.postMessage(job, [job.bytes]);
    } catch (error) {
      finish();
      reject(new FilesError('unavailable', { cause: error }));
    }
  });
}
