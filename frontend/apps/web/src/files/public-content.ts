import { FilesError } from '@clouddrive/surface/files';
import { BlobBodyError, readBoundedBlob } from '../api/blob-body';

/** readPublicBlob 复用Host流式边界，并保持公开文件的错误契约。 */
export async function readPublicBlob(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Blob> {
  try {
    return await readBoundedBlob(response, maxBytes, signal);
  } catch (error) {
    const cause = error instanceof BlobBodyError ? (error.cause ?? error) : error;
    const primary = cause instanceof AggregateError ? (cause.errors[0] as unknown) : cause;
    const code =
      primary instanceof FilesError
        ? primary.code
        : error instanceof BlobBodyError
          ? error.code === 'limit'
            ? 'large'
            : error.code === 'canceled'
              ? 'canceled'
              : 'unavailable'
          : 'unavailable';
    throw new FilesError(code, { cause });
  }
}
