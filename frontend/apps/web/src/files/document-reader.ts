import { FilesError, fileDetailSchema, type FileDocumentProps } from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';

/** createDocumentReader 复用现有客户端，拒绝同长度覆盖及账号切换后的迟到内容。 */
export function createDocumentReader(
  call: ReturnType<typeof createJsonClient>,
  readVersion: (
    id: string,
    revision: number,
    signal?: AbortSignal,
    budget?: Readonly<{ maxBlobBytes: number; timeoutMs: number }>,
  ) => Promise<Blob>,
  assertCurrent: () => void,
) {
  return async (props: FileDocumentProps, signal: AbortSignal): Promise<ArrayBuffer> => {
    assertCurrent();
    const { entry, limits, version } = props;
    if (entry.sizeBytes > limits.maxBytes) throw new FilesError('large');
    if (signal.aborted) throw new FilesError('canceled');
    const readDetail = async () => {
      const detail = fileDetailSchema.parse(
        await call('/' + encodeURIComponent(entry.id), { signal, timeoutMs: limits.workTimeoutMs }),
      );
      assertCurrent();
      if (
        detail.entry.id !== entry.id ||
        detail.entry.kind !== 'file' ||
        detail.entry.contentRevision !== entry.contentRevision ||
        detail.entry.sizeBytes !== entry.sizeBytes
      )
        throw new FilesError('conflict');
    };
    if (version === undefined) await readDetail();
    const value =
      version === undefined
        ? await call('/' + encodeURIComponent(entry.id) + '/content', {
            responseType: 'blob',
            maxBlobBytes: limits.maxBytes,
            signal,
            timeoutMs: limits.workTimeoutMs,
          })
        : await readVersion(entry.id, version, signal, {
            maxBlobBytes: limits.maxBytes,
            timeoutMs: limits.workTimeoutMs,
          });
    assertCurrent();
    if (!(value instanceof Blob)) throw new FilesError('unavailable');
    if (value.size !== entry.sizeBytes) throw new FilesError('conflict');
    if (value.size > limits.maxBytes) throw new FilesError('large');
    const bytes = await value.arrayBuffer();
    assertCurrent();
    if (signal.aborted) throw new FilesError('canceled');
    const header = new Uint8Array(bytes, 0, Math.min(5, bytes.byteLength));
    if (header.length !== 5 || String.fromCharCode(...header) !== '%PDF-')
      throw new FilesError('unsupported');
    if (version === undefined) await readDetail();
    assertCurrent();
    return bytes;
  };
}
