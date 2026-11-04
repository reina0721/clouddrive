/** BlobBodyError 保留读取与清理原因，由使用方映射业务错误。 */
export class BlobBodyError extends Error {
  constructor(
    public readonly code: 'limit' | 'canceled' | 'unavailable',
    options?: ErrorOptions,
  ) {
    super('Response body: ' + code, options);
    this.name = 'BlobBodyError';
  }
}

/** readBoundedBlob 对实际流计费，成功与失败都关闭并归还reader。 */
export async function readBoundedBlob(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Blob> {
  if (!response.body) throw new BlobBodyError('unavailable');
  const reader = response.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  let failure: unknown;
  let failed = false;
  try {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new BlobBodyError('limit');
    const length = response.headers.get('Content-Length');
    if (
      length !== null &&
      (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maxBytes)
    )
      throw new BlobBodyError('limit');
    for (;;) {
      if (signal.aborted) throw new BlobBodyError('canceled', { cause: signal.reason });
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maxBytes) throw new BlobBodyError('limit');
      parts.push(new Uint8Array(chunk.value));
    }
    if (signal.aborted) throw new BlobBodyError('canceled', { cause: signal.reason });
  } catch (error) {
    failure = error;
    failed = true;
  }
  try {
    await reader.cancel();
  } catch (cleanup) {
    throw new BlobBodyError(
      failure instanceof BlobBodyError ? failure.code : signal.aborted ? 'canceled' : 'unavailable',
      { cause: failed ? new AggregateError([failure, cleanup]) : cleanup },
    );
  } finally {
    reader.releaseLock();
  }
  if (failed) {
    if (failure instanceof BlobBodyError) throw failure;
    throw new BlobBodyError(signal.aborted ? 'canceled' : 'unavailable', { cause: failure });
  }
  return new Blob(parts, {
    type: response.headers.get('Content-Type') ?? 'application/octet-stream',
  });
}
