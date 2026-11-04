import { FilesError } from '@clouddrive/surface/files';

/** readPublicBlob 在读取过程中执行预算并关闭reader，不等待整份响应进入JS堆后才拒绝超额。 */
export async function readPublicBlob(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Blob> {
  if (!response.body) throw new FilesError('unavailable');
  const reader = response.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  let failure: unknown;
  let failed = false;
  try {
    const length = response.headers.get('Content-Length');
    if (
      length !== null &&
      (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maxBytes)
    )
      throw new FilesError('large');
    for (;;) {
      if (signal.aborted) throw new FilesError('canceled');
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maxBytes) throw new FilesError('large');
      parts.push(new Uint8Array(chunk.value));
    }
    if (signal.aborted) throw new FilesError('canceled');
  } catch (error) {
    failure = error;
    failed = true;
  }
  try {
    await reader.cancel();
  } catch (cleanup) {
    throw new FilesError(failure instanceof FilesError ? failure.code : 'unavailable', {
      cause: failed ? new AggregateError([failure, cleanup]) : cleanup,
    });
  } finally {
    reader.releaseLock();
  }
  if (failed) throw failure;
  return new Blob(parts, {
    type: response.headers.get('Content-Type') ?? 'application/octet-stream',
  });
}
