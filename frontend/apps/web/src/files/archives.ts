import {
  archiveManifestSchema,
  archiveReceiptSchema,
  FilesError,
  type ArchiveAccess,
  type ArchivesPort,
  type ArchiveMember,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';
import { downloadBlob } from './native-download';
import { rasterType } from './media-signatures';

/** createArchivesRuntime 复用现有客户端和账号围栏，拥有所有包内预览URL。 */
export function createArchivesRuntime(
  call: ReturnType<typeof createJsonClient>,
  assertCurrent: () => void,
) {
  const urls = new Set<string>();
  const endpoint = (access: ArchiveAccess, operation: string) =>
    '/' + encodeURIComponent(access.id) + '/archive/' + operation;
  const input = (access: ArchiveAccess) => ({
    expectedRevision: access.expectedRevision,
    password: access.password,
  });
  const read = async (access: ArchiveAccess, name: string, signal?: AbortSignal) => {
    assertCurrent();
    const value = await call(endpoint(access, 'member'), {
      method: 'POST',
      body: { ...input(access), path: name },
      responseType: 'blob',
      ...(signal ? { signal } : {}),
    });
    assertCurrent();
    if (signal?.aborted) throw new FilesError('canceled');
    if (!(value instanceof Blob)) throw new FilesError('unavailable');
    return value;
  };
  const memberBlob = async (
    access: ArchiveAccess,
    member: ArchiveMember,
    maxBytes: number,
    signal?: AbortSignal,
  ) => {
    if (member.kind !== 'file') throw new FilesError('invalid');
    if (member.sizeBytes > maxBytes) throw new FilesError('large');
    const blob = await read(access, member.path, signal);
    if (blob.size !== member.sizeBytes) throw new FilesError('conflict');
    if (blob.size > maxBytes) throw new FilesError('large');
    return blob;
  };
  const port: ArchivesPort = {
    inspect: async (access, signal) => {
      assertCurrent();
      const result = archiveManifestSchema.parse(
        await call(endpoint(access, 'inspect'), {
          method: 'POST',
          body: input(access),
          ...(signal ? { signal } : {}),
        }),
      );
      assertCurrent();
      if (result.entry.id !== access.id || result.entry.contentRevision !== access.expectedRevision)
        throw new FilesError('conflict');
      return result;
    },
    text: async (access, member, maxBytes, signal) => {
      const blob = await memberBlob(access, member, maxBytes, signal);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      assertCurrent();
      if (signal.aborted) throw new FilesError('canceled');
      if (bytes.includes(0)) throw new FilesError('unsupported');
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch (error) {
        throw new FilesError('unsupported', { cause: error });
      }
    },
    image: async (access, member, maxBytes, signal) => {
      const blob = await memberBlob(access, member, maxBytes, signal);
      const type = await rasterType(blob);
      assertCurrent();
      if (signal.aborted) throw new FilesError('canceled');
      if (!type) throw new FilesError('unsupported');
      const url = URL.createObjectURL(new Blob([blob], { type }));
      urls.add(url);
      return {
        url,
        release: () => {
          if (urls.delete(url)) URL.revokeObjectURL(url);
        },
      };
    },
    download: async (access, member, signal) => {
      const blob = await memberBlob(access, member, Number.MAX_SAFE_INTEGER, signal);
      assertCurrent();
      downloadBlob(blob, member.path.split('/').at(-1) ?? member.path);
    },
    downloadSelection: async (access, selection, signal) => {
      assertCurrent();
      const blob = await call(endpoint(access, 'download'), {
        method: 'POST',
        body: { ...input(access), selection },
        responseType: 'blob',
        ...(signal ? { signal } : {}),
      });
      assertCurrent();
      if (signal?.aborted) throw new FilesError('canceled');
      if (!(blob instanceof Blob)) throw new FilesError('unavailable');
      downloadBlob(blob, 'archive-selection.zip');
    },
    extract: async (access, request, signal) => {
      assertCurrent();
      const receipt = archiveReceiptSchema.parse(
        await call(endpoint(access, 'extract'), {
          method: 'POST',
          body: { ...input(access), ...request },
          ...(signal ? { signal } : {}),
        }),
      );
      assertCurrent();
      if (signal?.aborted) throw new FilesError('canceled');
      return receipt;
    },
  };
  return {
    port,
    dispose: () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
