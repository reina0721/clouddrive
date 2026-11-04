import {
  fileEntrySchema,
  fileListingSchema,
  fileDetailSchema,
  FilesError,
  type FilesErrorCode,
  type FilesPort,
  type UploadCandidate,
  type FileViewPreferences,
} from '@clouddrive/surface/files';
import { createJsonClient, ApiError } from '../api/json-client';

const transferTimeoutMs = 120_000;
const maxPreviewBytes = 1 << 20;
const preferencesKey = 'clouddrive.files.view.v1';
const defaultPreferences: FileViewPreferences = { view: 'grid', sort: 'name', desc: false };

/** createFilesRuntime 将文件句柄、网络、下载及拖拽生命周期留在浏览器 Host。 */
export function createFilesRuntime(base: string, owner: () => string | null) {
  const transport = createJsonClient(base);
  const sources = new Map<string, File>();
  const openPickers = new Set<() => void>();
  let disposed = false;
  const dropListeners = new Set<(candidates: readonly UploadCandidate[]) => void>();
  const native = '/native/files';
  function register(files: readonly File[]): UploadCandidate[] {
    if (disposed) return [];
    return files.map((file) => {
      const candidate = { id: crypto.randomUUID(), name: file.name, sizeBytes: file.size };
      sources.set(candidate.id, file);
      return candidate;
    });
  }
  const call: typeof transport = async (path, options) => {
    const original = owner();
    if (!original) throw new ApiError('http', 401);
    try {
      const value = await transport(native + path, options);
      if (original !== owner()) throw new ApiError('http', 401);
      return value;
    } catch (error) {
      let code: FilesErrorCode = 'unavailable';
      if (options?.signal?.aborted) code = 'canceled';
      else if (error instanceof ApiError) {
        const payload = JSON.stringify(error.payload);
        if (error.status === 401) code = 'unauthenticated';
        else if (error.status === 403) code = 'forbidden';
        else if (error.status === 404) code = 'missing';
        else if (error.status === 409)
          code = payload?.includes('files_quota') ? 'quota' : 'conflict';
        else if (error.status === 413) code = 'large';
        else if (error.status === 429) code = 'busy';
      }
      throw new FilesError(code, { cause: error });
    }
  };
  async function content(id: string, signal?: AbortSignal): Promise<Blob> {
    const value = await call(`/${encodeURIComponent(id)}/content`, {
      responseType: 'blob',
      timeoutMs: transferTimeoutMs,
      ...(signal ? { signal } : {}),
    });
    if (!(value instanceof Blob)) throw new ApiError('protocol');
    return value;
  }
  const port: FilesPort = {
    list: async (query, signal) => {
      const params = new URLSearchParams({
        parent: query.parent,
        search: query.search,
        category: query.category,
        trash: String(query.trash),
        sort: query.sort,
        desc: String(query.desc),
      });
      return fileListingSchema.parse(await call(`?${params}`, signal ? { signal } : {}));
    },
    folder: async (parentId, name) =>
      fileEntrySchema.parse(await call('/folders', { method: 'POST', body: { parentId, name } })),
    update: async (id, change) =>
      fileEntrySchema.parse(
        await call(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: change }),
      ),
    trash: async (id) =>
      fileEntrySchema.parse(await call(`/${encodeURIComponent(id)}/trash`, { method: 'POST' })),
    restore: async (id, parentId) =>
      fileEntrySchema.parse(
        await call(`/${encodeURIComponent(id)}/restore`, {
          method: 'POST',
          body: parentId === undefined ? {} : { parentId },
        }),
      ),
    detail: async (id) => fileDetailSchema.parse(await call(`/${encodeURIComponent(id)}`)),
    chooseFiles: () =>
      new Promise((resolve) => {
        // 系统文件选择器属于 Browser Adapter；不向 Surface 传递 File 或 DOM 句柄。
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.multiple = true;
        picker.hidden = true;
        let finished = false;
        const finish = (files: readonly File[]) => {
          if (finished) return;
          finished = true;
          picker.remove();
          openPickers.delete(cancelPicker);
          resolve(register(files));
        };
        const cancelPicker = () => finish([]);
        openPickers.add(cancelPicker);
        picker.addEventListener('change', () => finish(Array.from(picker.files ?? [])), {
          once: true,
        });
        picker.addEventListener('cancel', () => finish([]), { once: true });
        document.body.append(picker);
        picker.click();
      }),
    subscribeDrop: (listener) => {
      dropListeners.add(listener);
      return () => {
        dropListeners.delete(listener);
      };
    },
    upload: async (candidate, parentId, signal) => {
      const source = sources.get(candidate.id);
      if (!source) throw new ApiError('protocol');
      const params = new URLSearchParams({ name: candidate.name, parent: parentId });
      return fileEntrySchema.parse(
        await call(`/upload?${params}`, {
          method: 'POST',
          rawBody: source,
          timeoutMs: transferTimeoutMs,
          signal,
          headers: { 'Content-Type': 'application/octet-stream', 'Idempotency-Key': candidate.id },
        }),
      );
    },
    releaseCandidate: (id) => {
      sources.delete(id);
    },
    download: async (entry) => {
      const blob = await content(entry.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = entry.name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // 给下载导航一次事件循环的消费机会，然后释放本次 Blob URL。
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
    preview: async (entry, signal) => {
      if (
        entry.sizeBytes > maxPreviewBytes ||
        !(
          entry.mediaType.startsWith('text/') ||
          /\.(md|txt|csv|json|xml|html|css|js|log)$/i.test(entry.name)
        )
      )
        throw new FilesError('unsupported');
      const blob = await content(entry.id, signal);
      if (blob.size > maxPreviewBytes) throw new ApiError('http', 413);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.includes(0)) throw new FilesError('unsupported');
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch (error) {
        throw new FilesError('unsupported', { cause: error });
      }
    },
    loadPreferences: () => {
      const saved = localStorage.getItem(`${preferencesKey}.${owner()}`);
      if (!saved) return defaultPreferences;
      try {
        const value: unknown = JSON.parse(saved);
        if (
          typeof value !== 'object' ||
          !value ||
          !('view' in value) ||
          !('sort' in value) ||
          !('desc' in value)
        )
          return defaultPreferences;
        if (
          (value.view !== 'grid' && value.view !== 'list') ||
          !['name', 'size', 'updated', 'created'].includes(String(value.sort)) ||
          typeof value.desc !== 'boolean'
        )
          return defaultPreferences;
        return { view: value.view, sort: String(value.sort), desc: value.desc };
      } catch {
        return defaultPreferences;
      }
    },
    savePreferences: (value) => {
      localStorage.setItem(`${preferencesKey}.${owner()}`, JSON.stringify(value));
    },
  };
  return {
    port,
    activate: () => {
      disposed = false;
    },
    offer: (files: readonly File[]) => {
      if (!dropListeners.size || disposed) return;
      const candidates = register(files);
      for (const listener of dropListeners) listener(candidates);
    },
    dispose: () => {
      disposed = true;
      for (const cancel of openPickers) cancel();
      sources.clear();
      dropListeners.clear();
    },
  };
}
