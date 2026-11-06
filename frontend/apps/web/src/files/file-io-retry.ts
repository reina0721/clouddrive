import { FilesError } from '@clouddrive/surface/files';

// fileIORetryDelaysMs 与现有tus分块预算一致，仅用于文件I/O的有限恢复。
export const fileIORetryDelaysMs = [0, 1000, 3000] as const;

function waitForFileIO(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new FilesError('canceled'));
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new FilesError('canceled'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** withFileIOAdmissionRetry 只恢复文件通道繁忙，不重试权限、版本或格式错误。 */
export async function withFileIOAdmissionRetry<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  assertCurrent: () => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    assertCurrent();
    if (signal.aborted) throw new FilesError('canceled');
    try {
      return await operation();
    } catch (error) {
      const delayMs = fileIORetryDelaysMs[attempt];
      if (
        !(error instanceof FilesError) ||
        error.code !== 'busy' ||
        delayMs === undefined ||
        signal.aborted
      )
        throw error;
      await waitForFileIO(delayMs, signal);
    }
  }
}
