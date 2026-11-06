import { authPageHref } from '../auth/contract';
import {
  FilesError,
  publicShareSchema,
  publicFileListingSchema,
  publicFileEntrySchema,
  publicTextSchema,
  sharedBatchSchema,
  sharedTransferSchema,
  shareUnlockSchema,
  shareDownloadGrantSchema,
  type PublicFilesPort,
  type PublicUploadCandidate,
  type PublicShare,
  type PublicUploadProgress,
} from '@clouddrive/surface/files';
import { nativeDownload, downloadBlob } from './native-download';
import { shareTokenPattern, saveShareIntentHref } from './share-address';
import { readPublicBlob } from './public-content';

const requestTimeoutMs = 120_000;
const cleanupTimeoutMs = 5_000;
const sourceHashChunkBytes = 4 * 1024 * 1024;
const tusVersion = '1.0.0';
type RequestOptions = Readonly<{
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD';
  json?: unknown;
  body?: Blob;
  headers?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  response?: 'json' | 'blob' | 'headers';
  maxBytes?: number;
  purpose?: 'operation' | 'cleanup';
  grant?: string;
}>;
type UploadSource = { file: File; key: string; running: boolean };

/** createPublicFilesRuntime 拥有访问者文件、请求和散列；同源Session只用于受众身份，不持久化分享凭据。 */
export function createPublicFilesRuntime(
  token: string,
  binding: Readonly<{ subject: string | null; current: () => string | null }>,
) {
  const subject = binding.subject;
  const audience = binding.current;
  let directory: Readonly<{ id: string; upload: boolean }> | undefined;
  let ticket = '';
  let disposed = false;
  let metadata: PublicShare | undefined;
  const controllers = new Set<AbortController>();
  const candidates = new Map<string, UploadSource>();
  const pickers = new Set<() => void>();
  function disposeResources() {
    disposed = true;
    ticket = '';
    metadata = undefined;
    directory = undefined;
    for (const controller of controllers) controller.abort();
    for (const cancel of [...pickers]) cancel();
    candidates.clear();
  }
  const assertActive = () => {
    if (audience() !== subject) disposeResources();
    if (disposed) throw new FilesError('canceled');
    if (!shareTokenPattern.test(token)) throw new FilesError('missing');
  };
  async function request(suffix: string, options: RequestOptions = {}): Promise<unknown> {
    if (options.purpose !== 'cleanup') assertActive();
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(
      () => controller.abort(),
      options.purpose === 'cleanup' ? cleanupTimeoutMs : requestTimeoutMs,
    );
    const signal = options.signal
      ? AbortSignal.any([controller.signal, options.signal])
      : controller.signal;
    try {
      const grant = options.grant ?? ticket;
      const response = await fetch(`/api/v1/file-shares/${encodeURIComponent(token)}${suffix}`, {
        method: options.method ?? 'GET',
        credentials: 'include',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal,
        headers: {
          ...(grant ? { 'X-Share-Grant': grant } : {}),
          ...(options.json === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        ...(options.json === undefined ? {} : { body: JSON.stringify(options.json) }),
        ...(options.body === undefined ? {} : { body: options.body }),
      });
      if (!response.ok) {
        const message = await response.text();
        const code =
          response.status === 423
            ? 'write-locked'
            : response.status === 401
              ? 'unauthenticated'
              : response.status === 404
                ? 'missing'
                : response.status === 403
                  ? message.includes('files_share_locked')
                    ? 'locked'
                    : 'forbidden'
                  : response.status === 429 || response.status === 503
                    ? 'busy'
                    : response.status === 413
                      ? 'large'
                      : response.status === 409
                        ? message.includes('files_quota')
                          ? 'quota'
                          : 'conflict'
                        : response.status === 422
                          ? message.includes('files_unsupported')
                            ? 'unsupported'
                            : 'invalid'
                          : 'unavailable';
        throw new FilesError(code);
      }
      if (options.response === 'headers') return response.headers;
      if (options.response === 'blob')
        return await readPublicBlob(response, options.maxBytes ?? 0, signal);
      return await response.json();
    } catch (error) {
      if (error instanceof FilesError) throw error;
      throw new FilesError(
        signal.aborted && (disposed || options.signal?.aborted) ? 'canceled' : 'unavailable',
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }
  const call = async (suffix: string, options: RequestOptions = {}) => {
    const value = await request(suffix, options);
    assertActive();
    return value;
  };
  async function readMetadata(signal?: AbortSignal) {
    metadata = publicShareSchema.parse(await call('', signal ? { signal } : {}));
    directory = undefined;
    return metadata;
  }
  function chooseUploads(parent: string): Promise<readonly PublicUploadCandidate[]> {
    assertActive();
    const limit = metadata?.limits?.batchEntries;
    if (
      !limit ||
      !(directory?.id === parent
        ? directory.upload
        : metadata?.root?.id === parent && metadata.permissions?.upload)
    )
      return Promise.reject(new FilesError('forbidden'));
    return new Promise((resolve, reject) => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.multiple = true;
      picker.hidden = true;
      let finished = false;
      const finish = (files: readonly File[]) => {
        if (finished) return;
        finished = true;
        picker.remove();
        pickers.delete(cancel);
        if (disposed || audience() !== subject) {
          disposeResources();
          reject(new FilesError('canceled'));
          return;
        }
        if (files.length > limit || candidates.size + files.length > limit) {
          reject(new FilesError('large'));
          return;
        }
        if (
          files.some(
            (file) =>
              !Number.isSafeInteger(file.size) || file.size > (metadata?.limits?.maxFileBytes ?? 0),
          )
        ) {
          reject(new FilesError('large'));
          return;
        }
        resolve(
          files.map((file) => {
            const id = crypto.randomUUID();
            candidates.set(id, { file, key: crypto.randomUUID(), running: false });
            return { id, name: file.name, sizeBytes: file.size };
          }),
        );
      };
      const cancel = () => finish([]);
      pickers.add(cancel);
      picker.addEventListener('change', () => finish(Array.from(picker.files ?? [])), {
        once: true,
      });
      picker.addEventListener('cancel', cancel, { once: true });
      document.body.append(picker);
      picker.click();
    });
  }
  async function upload(
    candidate: PublicUploadCandidate,
    parent: string,
    onProgress: (value: PublicUploadProgress) => void,
    signal: AbortSignal,
  ) {
    assertActive();
    const source = candidates.get(candidate.id);
    if (
      !source ||
      source.running ||
      source.file.size !== candidate.sizeBytes ||
      source.file.name !== candidate.name
    )
      throw new FilesError('invalid');
    const work = new AbortController();
    controllers.add(work);
    const uploadSignal = AbortSignal.any([signal, work.signal]);
    source.running = true;
    let transferId = '';
    const grant = ticket;
    try {
      if (uploadSignal.aborted) throw new FilesError('canceled');
      // 只在用户实际开始上传时载入散列实现，浏览与只读分享不承担这部分脚本。
      const { hashFile } = await import('./file-hash');
      const digest = await hashFile(
        source.file,
        sourceHashChunkBytes,
        uploadSignal,
        (processedBytes) =>
          onProgress({ phase: 'hashing', processedBytes, totalBytes: source.file.size }),
      );
      assertActive();
      let transfer = sharedTransferSchema.parse(
        await request('/transfers', {
          method: 'POST',
          json: {
            parentId: parent,
            name: source.file.name,
            sizeBytes: source.file.size,
            sha256: digest,
            clientKey: source.key,
          },
          signal: uploadSignal,
        }),
      );
      transferId = transfer.id;
      assertActive();
      if (uploadSignal.aborted) throw new FilesError('canceled');
      if (transfer.sizeBytes !== source.file.size || transfer.offsetBytes > source.file.size)
        throw new FilesError('conflict');
      if (transfer.state === 'completed') {
        onProgress({
          phase: 'completed',
          processedBytes: source.file.size,
          totalBytes: source.file.size,
        });
        candidates.delete(candidate.id);
        return;
      }
      const head = await call('/transfers/' + encodeURIComponent(transferId) + '/data', {
        method: 'HEAD',
        response: 'headers',
        headers: { 'Tus-Resumable': tusVersion },
        signal: uploadSignal,
      });
      if (!(head instanceof Headers)) throw new FilesError('unavailable');
      let offset = Number(head.get('Upload-Offset'));
      if (
        !/^\d+$/.test(head.get('Upload-Offset') ?? '') ||
        !Number.isSafeInteger(offset) ||
        offset > source.file.size
      )
        throw new FilesError('conflict');
      onProgress({ phase: 'uploading', processedBytes: offset, totalBytes: source.file.size });
      while (offset < source.file.size) {
        const end = Math.min(offset + transfer.chunkBytes, source.file.size);
        const headers = await call('/transfers/' + encodeURIComponent(transferId) + '/data', {
          method: 'PATCH',
          body: source.file.slice(offset, end),
          headers: {
            'Content-Type': 'application/offset+octet-stream',
            'Tus-Resumable': tusVersion,
            'Upload-Offset': String(offset),
          },
          response: 'headers',
          signal: uploadSignal,
        });
        if (
          !(headers instanceof Headers) ||
          headers.get('Tus-Resumable') !== tusVersion ||
          headers.get('Upload-Offset') !== String(end)
        )
          throw new FilesError('conflict');
        offset = Number(headers.get('Upload-Offset'));
        onProgress({ phase: 'uploading', processedBytes: offset, totalBytes: source.file.size });
      }
      onProgress({ phase: 'committing', processedBytes: offset, totalBytes: source.file.size });
      transfer = sharedTransferSchema.parse(
        await call('/transfers/' + encodeURIComponent(transferId) + '/commit', {
          method: 'POST',
          signal: uploadSignal,
        }),
      );
      if (
        transfer.state !== 'completed' ||
        !transfer.entryId ||
        transfer.offsetBytes !== source.file.size
      )
        throw new FilesError('conflict');
      onProgress({ phase: 'completed', processedBytes: offset, totalBytes: source.file.size });
      candidates.delete(candidate.id);
    } catch (error) {
      if (transferId) {
        try {
          const settled = sharedTransferSchema.parse(
            await request('/transfers/' + encodeURIComponent(transferId) + '/cancel', {
              method: 'POST',
              purpose: 'cleanup',
              grant,
            }),
          );
          if (
            settled.state === 'completed' &&
            settled.entryId &&
            settled.offsetBytes === source.file.size
          ) {
            if (!disposed)
              onProgress({
                phase: 'completed',
                processedBytes: source.file.size,
                totalBytes: source.file.size,
              });
            candidates.delete(candidate.id);
            return;
          }
          if (settled.state === 'canceled' || settled.state === 'expired')
            source.key = crypto.randomUUID();
        } catch (cleanup) {
          throw new FilesError(error instanceof FilesError ? error.code : 'unavailable', {
            cause: new AggregateError([error, cleanup]),
          });
        }
      }
      throw error;
    } finally {
      source.running = false;
      controllers.delete(work);
      work.abort();
    }
  }
  const entryVersion = (entry: { id: string; contentRevision: number; updatedAt: string }) => ({
    id: entry.id,
    revision: entry.contentRevision,
    updatedAt: entry.updatedAt,
  });
  const port: PublicFilesPort = {
    newClientKey: () => {
      assertActive();
      return crypto.randomUUID();
    },
    signInHref: () => authPageHref('/login', '/share#' + new URLSearchParams({ token }).toString()),
    saveShortcutHref: () => saveShareIntentHref(token),
    metadata: readMetadata,
    unlock: async (password, signal) => {
      const result = shareUnlockSchema.parse(
        await call('/unlock', {
          method: 'POST',
          json: { password },
          ...(signal ? { signal } : {}),
        }),
      );
      ticket = result.ticket;
      metadata = undefined;
      directory = undefined;
    },
    entries: async (query, signal) => {
      const value = publicFileListingSchema.parse(
        await call(
          '/entries?' +
            new URLSearchParams({
              parent: query.parent,
              search: query.search,
              sort: query.sort,
              desc: String(query.desc),
              scope: query.scope,
              page: String(query.page),
            }).toString(),
          signal ? { signal } : {},
        ),
      );
      const current = value.breadcrumbs.at(-1);
      if (!current || (query.parent && current.id !== query.parent))
        throw new FilesError('unavailable');
      directory = { id: current.id, upload: value.permissions.upload };
      return value;
    },
    readText: async (entry, signal) =>
      publicTextSchema.parse(
        await call('/text/' + encodeURIComponent(entry.id), signal ? { signal } : {}),
      ),
    createFolder: async (parent, name) =>
      publicFileEntrySchema.parse(
        await call('/folders', { method: 'POST', json: { parentId: parent, name } }),
      ),
    createText: async (input) =>
      publicFileEntrySchema.parse(await call('/text', { method: 'POST', json: input })),
    replaceText: async (entry, text) =>
      publicFileEntrySchema.parse(
        await call('/text/' + encodeURIComponent(entry.id), {
          method: 'PUT',
          json: { revision: entry.contentRevision, text },
        }),
      ),
    changeItem: async (entry, action, options = {}) =>
      publicFileEntrySchema.parse(
        await call('/entries/change', {
          method: 'POST',
          json: {
            ...entryVersion(entry),
            action,
            name: options.name ?? '',
            parentId: options.parentId ?? '',
          },
        }),
      ),
    batch: async (entries, action, parentId) =>
      sharedBatchSchema.parse(
        await call('/entries/batch', {
          method: 'POST',
          json: { action, parentId, items: entries.map(entryVersion) },
        }),
      ),
    archive: async (entries, signal) => {
      const blob = await call('/archive', {
        method: 'POST',
        json: { ids: entries.map((entry) => entry.id) },
        response: 'blob',
        maxBytes: 64 * 1024 * 1024,
        ...(signal ? { signal } : {}),
      });
      if (!(blob instanceof Blob)) throw new FilesError('unavailable');
      downloadBlob(blob, 'shared-files.zip');
    },
    chooseUploads,
    releaseUpload: (id) => {
      const source = candidates.get(id);
      if (source && !source.running) candidates.delete(id);
    },
    upload,
    download: async (entry) => {
      const grant = shareDownloadGrantSchema.parse(
        await call('/content/' + encodeURIComponent(entry.id) + '/download', { method: 'POST' }),
      );
      nativeDownload('/api/v1/file-downloads/' + encodeURIComponent(grant.ticket), entry.name);
    },
  };
  return {
    port,
    readMedia: async (id: string, expectedSizeBytes: number, signal: AbortSignal) => {
      assertActive();
      if (!metadata?.limits) await readMetadata(signal);
      const limit = metadata?.limits?.maxPreviewBytes ?? 0;
      if (expectedSizeBytes > limit) throw new FilesError('large');
      const blob = await call('/content/' + encodeURIComponent(id), {
        response: 'blob',
        maxBytes: limit,
        signal,
      });
      if (!(blob instanceof Blob) || blob.size !== expectedSizeBytes)
        throw new FilesError('conflict');
      return blob;
    },
    activate: () => {
      disposed = false;
    },
    dispose: disposeResources,
  };
}
