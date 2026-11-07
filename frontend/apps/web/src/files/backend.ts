import { createFileAccessPort } from './access';
import { createDocumentReader } from './document-reader';
import { createArchivesRuntime } from './archives';
import {
  backgroundTaskListingSchema,
  fileDetailSchema,
  fileEntrySchema,
  fileListingSchema,
  FilesError,
  fileShareSchema,
  shareListingSchema,
  trashPurgePreviewSchema,
  trashRetentionSchema,
  directLinkIssueSchema,
  directLinkPageSchema,
  directLinkTokenPattern,
  inventoryItemSchema,
  inventoryPageSchema,
  type FileListing,
  type FilesErrorCode,
  type FileShortcut,
  type FilesPort,
  type UploadCandidate,
} from '@clouddrive/surface/files';
import { ApiError, createJsonClient, csrfTokenOf } from '../api/json-client';
import { createAnnotationsPort } from './annotations';
import { createFileClipboard } from './clipboard';
import { createConnectionsPort } from './connections';
import { fileDestinationHref } from './destinations';
import { createDownloadsRuntime } from './downloads';
import { nativeDownload, downloadBlob as saveBlob } from './native-download';
import { createFileNavigationPort } from './navigation';
import { fileListParameters } from './query';
import { fileShareAddress } from './share-address';
import { createTransferRuntime } from './transfer-runtime';
import { createVersionsPort } from './versions';
import { createFilePreferences } from './preferences';
import { createHistoryPreferences } from './history-preferences';
import { withFileIOAdmissionRetry } from './file-io-retry';
import { createFileSidebarPreferences } from './sidebar-preferences';
import { createVideoSubtitleSource } from './video-subtitle-source';
export { fileDestinationHrefs } from './destinations';

const transferTimeoutMs = 120_000;

/** createFilesRuntime 将文件句柄、网络、下载及拖拽生命周期留在浏览器 Host。 */
export function createFilesRuntime(
  base: string,
  owner: () => string | null,
  navigate: FilesPort['navigate'],
  openFolder: FilesPort['openFolder'],
) {
  const account = owner();
  const transport = createJsonClient(base);
  const sources = new Map<string, File>();
  const openPickers = new Set<() => void>();
  let disposed = false;
  let lifecycle = new AbortController();
  let limits: FileListing | undefined;
  let mediaTail = Promise.resolve();
  const directories = new Map<string, Promise<string>>();
  const shortcutCleanups = new Set<() => void>();
  const dropListeners = new Set<(candidates: readonly UploadCandidate[]) => void>();
  const native = '/native/files';
  function assertCurrent() {
    if (disposed || !account || owner() !== account) throw new FilesError('canceled');
  }
  function register(files: readonly File[]): UploadCandidate[] {
    if (disposed) return [];
    for (const file of files)
      if (file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/');
        if (
          parts.at(-1) !== file.name ||
          parts.some(
            (part) =>
              !part ||
              part === '.' ||
              part === '..' ||
              part.trim() !== part ||
              part.includes('\\') ||
              Array.from(part).some(
                (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
              ) ||
              Array.from(part).length > 255,
          )
        )
          throw new FilesError('unsupported');
      }
    return files.map((file) => {
      const candidate = {
        id: crypto.randomUUID(),
        name: file.name,
        sizeBytes: file.size,
        ...(file.webkitRelativePath ? { relativePath: file.webkitRelativePath } : {}),
      };
      sources.set(candidate.id, file);
      return candidate;
    });
  }
  const call: typeof transport = async (path, options) => {
    if (disposed) throw new FilesError('canceled');
    const original = owner();
    if (!original) throw new ApiError('http', 401);
    if (original !== account) throw new FilesError('canceled');
    try {
      const value = await transport(native + path, {
        ...options,
        signal: options?.signal
          ? AbortSignal.any([options.signal, lifecycle.signal])
          : lifecycle.signal,
      });
      if (original !== owner()) throw new ApiError('http', 401);
      return value;
    } catch (error) {
      let code: FilesErrorCode = 'unavailable';
      if (options?.signal?.aborted) code = 'canceled';
      else if (error instanceof ApiError) {
        const payload = JSON.stringify(error.payload);
        if (error.code === 'limit') code = 'large';
        else if (error.code === 'timeout') code = 'timeout';
        else if (error.status === 401) code = 'unauthenticated';
        else if (error.status === 403)
          code = payload?.includes('files_archive_password') ? 'archive-password' : 'forbidden';
        else if (error.status === 504) code = 'timeout';
        else if (error.status === 503 && payload?.includes('files_archive_worker_unavailable'))
          code = 'archive-worker';
        else if (error.status === 404) code = 'missing';
        else if (error.status === 410) code = 'expired';
        else if (error.status === 422 && payload?.includes('files_transfer_checksum'))
          code = 'checksum';
        else if (error.status === 422 && payload?.includes('files_archive_checksum'))
          code = 'archive-checksum';
        else if (error.status === 422 && payload?.includes('files_unsupported'))
          code = 'unsupported';
        else if (error.status === 409)
          code = payload?.includes('files_history_full')
            ? 'history-full'
            : payload?.includes('files_quota')
              ? 'quota'
              : 'conflict';
        else if (error.status === 413)
          code = payload?.includes('files_offline_metadata_limited') ? 'metadata-limited' : 'large';
        else if (error.status === 423) code = 'write-locked';
        else if (error.status === 429) code = 'busy';
        else if (error.status === 400 || error.status === 422) code = 'invalid';
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

  function downloadBlob(blob: Blob, name: string) {
    if (disposed) throw new FilesError('canceled');
    saveBlob(blob, name);
  }
  function shareLink(token: string) {
    return fileShareAddress(token, location.origin);
  }
  function choose(mode: 'files' | 'directory'): Promise<readonly UploadCandidate[]> {
    if (disposed) return Promise.reject(new FilesError('canceled'));
    return new Promise((resolve, reject) => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.multiple = true;
      picker.hidden = true;
      if (mode === 'directory') picker.webkitdirectory = true;
      let finished = false;
      const finish = (files: readonly File[]) => {
        if (finished) return;
        finished = true;
        picker.remove();
        openPickers.delete(cancelPicker);
        try {
          if (mode === 'directory' && files.length) {
            if (!limits) throw new FilesError('unavailable');
            const paths = new Set<string>();
            for (const file of files) {
              const parts = file.webkitRelativePath.split('/');
              if (parts.length < 2) throw new FilesError('unsupported');
              for (let index = 1; index < parts.length; index++)
                paths.add(parts.slice(0, index).join('/'));
            }
            if (paths.size + files.length > limits.maxBatchEntries) throw new FilesError('large');
          }
          resolve(register(files));
        } catch (error) {
          reject(error instanceof Error ? error : new FilesError('unavailable', { cause: error }));
        }
      };
      const cancelPicker = () => finish([]);
      openPickers.add(cancelPicker);
      picker.addEventListener('change', () => finish(Array.from(picker.files ?? [])), {
        once: true,
      });
      picker.addEventListener('cancel', cancelPicker, { once: true });
      document.body.append(picker);
      picker.click();
    });
  }
  async function uploadParent(candidate: UploadCandidate, parent: string, signal: AbortSignal) {
    if (!candidate.relativePath) return parent;
    const parts = candidate.relativePath.split('/').slice(0, -1);
    let current = parent;
    for (const name of parts) {
      if (signal.aborted) throw new FilesError('canceled');
      const root = current;
      const key = JSON.stringify([owner(), root, name.normalize('NFC').toLowerCase()]);
      let pending = directories.get(key);
      if (!pending) {
        pending = (async () => {
          try {
            return fileEntrySchema.parse(
              await call('/folders', { method: 'POST', body: { parentId: root, name } }),
            ).id;
          } catch (error) {
            if (!(error instanceof FilesError) || error.code !== 'conflict') throw error;
            const listing = fileListingSchema.parse(
              await call(`?${new URLSearchParams({ parent: root })}`),
            );
            const existing = listing.items.find(
              (entry) =>
                entry.kind === 'folder' &&
                entry.name.normalize('NFC').toLowerCase() === name.normalize('NFC').toLowerCase(),
            );
            if (!existing) throw error;
            return existing.id;
          }
        })();
        if (limits && directories.size >= limits.maxBatchEntries) directories.clear();
        directories.set(key, pending);
      }
      try {
        current = await pending;
      } catch (error) {
        directories.delete(key);
        throw error;
      }
    }
    if (signal.aborted) throw new FilesError('canceled');
    return current;
  }
  const transfers = createTransferRuntime({
    call,
    owner,
    dataURL: (id) => base + native + '/transfers/' + encodeURIComponent(id) + '/data',
    csrf: async (signal) =>
      csrfTokenOf(
        await transport('/auth/csrf', { signal: AbortSignal.any([signal, lifecycle.signal]) }),
      ),
    takeSource: (candidate) => sources.get(candidate.id),
    releaseSource: (id) => {
      sources.delete(id);
    },
    resolveParent: uploadParent,
    chooseSource: async () => {
      const candidates = await choose('files');
      if (candidates.length !== 1) {
        for (const candidate of candidates) sources.delete(candidate.id);
        if (!candidates.length) return undefined;
        throw new FilesError('invalid');
      }
      const candidate = candidates[0];
      if (!candidate) return undefined;
      const file = sources.get(candidate.id);
      sources.delete(candidate.id);
      return file;
    },
  });
  const versions = createVersionsPort(call, base + native, assertCurrent);
  const downloads = createDownloadsRuntime(call, assertCurrent);
  const clipboard = createFileClipboard(assertCurrent, {
    detail: (id) => port.detail(id),
    copy: (id, parentId, name) => port.copy(id, parentId, name),
    update: (id, change) => port.update(id, change),
  });
  const archives = createArchivesRuntime(call, assertCurrent);
  const port: FilesPort = {
    access: createFileAccessPort(call, assertCurrent),
    clipboard: clipboard.port,
    versions: versions.port,
    annotations: createAnnotationsPort(call, assertCurrent),
    navigate,
    openFolder,
    destinationHref: fileDestinationHref,
    listBackgroundTasks: async (query, signal) => {
      const params = new URLSearchParams({
        kind: query.kind,
        status: query.status,
        search: query.search,
        page: String(query.page),
      });
      return backgroundTaskListingSchema.parse(
        await call(`/background-tasks?${params}`, { signal }),
      );
    },
    list: async (query, signal) => {
      const params = fileListParameters(query);
      const listing = fileListingSchema.parse(await call(`?${params}`, signal ? { signal } : {}));
      limits = listing;
      return listing;
    },
    listInventory: async (query, signal) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== '' && value !== false) params.set(key, String(value));
      }
      return inventoryPageSchema.parse(await call('/inventory?' + params.toString(), { signal }));
    },
    readInventory: async (id, signal) =>
      inventoryItemSchema.parse(await call('/inventory/' + encodeURIComponent(id), { signal })),
    folder: async (parentId, name) =>
      fileEntrySchema.parse(await call('/folders', { method: 'POST', body: { parentId, name } })),
    update: async (id, change) =>
      fileEntrySchema.parse(
        await call(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: change }),
      ),
    trash: async (id) =>
      fileEntrySchema.parse(await call(`/${encodeURIComponent(id)}/trash`, { method: 'POST' })),
    loadTrashRetention: async (signal) =>
      trashRetentionSchema.parse(await call('/trash/retention', { signal })),
    saveTrashRetention: async (policy, signal) =>
      trashRetentionSchema.parse(
        await call('/trash/retention', { method: 'PUT', body: policy, signal }),
      ),
    previewTrashPurge: async (selection, signal) =>
      trashPurgePreviewSchema.parse(
        await call('/trash/purge-preview', { method: 'POST', body: selection, signal }),
      ),
    purgeTrash: async (selection, snapshot) =>
      trashPurgePreviewSchema.parse(
        await call('/trash/purge', { method: 'POST', body: { ...selection, snapshot } }),
      ),
    restore: async (id, parentId) =>
      fileEntrySchema.parse(
        await call(`/${encodeURIComponent(id)}/restore`, {
          method: 'POST',
          body: parentId === undefined ? {} : { parentId },
        }),
      ),
    detail: async (id) => fileDetailSchema.parse(await call(`/${encodeURIComponent(id)}`)),
    copy: async (id, parentId, name) =>
      fileEntrySchema.parse(
        await call(`/${encodeURIComponent(id)}/copy`, { method: 'POST', body: { parentId, name } }),
      ),
    createText: async (parentId, name, text) =>
      fileEntrySchema.parse(
        await call('/text', {
          method: 'POST',
          body: { parentId, name, text, key: crypto.randomUUID() },
          timeoutMs: transferTimeoutMs,
        }),
      ),
    textBytes: (text) => new TextEncoder().encode(text).byteLength,
    replaceText: async (id, expectedRevision, text) =>
      fileEntrySchema.parse(
        await call(`/${encodeURIComponent(id)}/text`, {
          method: 'PUT',
          body: { expectedRevision, text },
          timeoutMs: transferTimeoutMs,
        }),
      ),
    archive: async (ids) => {
      const blob = await call('/archive', {
        method: 'POST',
        body: { ids },
        responseType: 'blob',
        timeoutMs: transferTimeoutMs,
      });
      if (!(blob instanceof Blob)) throw new FilesError('unavailable');
      downloadBlob(blob, 'files.zip');
    },
    shares: async (query, signal) =>
      shareListingSchema.parse(
        await call(
          '/shares?' +
            new URLSearchParams({
              search: query.search,
              state: query.state,
              sort: query.sort,
              page: String(query.page),
            }).toString(),
          signal ? { signal } : {},
        ),
      ),
    readShare: async (id, signal) =>
      fileShareSchema.parse(
        await call('/shares/' + encodeURIComponent(id), signal ? { signal } : {}),
      ),
    createShare: async (input) =>
      fileShareSchema.parse(await call('/shares', { method: 'POST', body: input })),
    updateShare: async (share, input) =>
      fileShareSchema.parse(
        await call('/shares/' + encodeURIComponent(share.id), {
          method: 'PUT',
          body: { ...input, revision: share.revision },
        }),
      ),
    setShareEnabled: async (share, enabled) =>
      fileShareSchema.parse(
        await call('/shares/' + encodeURIComponent(share.id) + '/state', {
          method: 'PUT',
          body: { revision: share.revision, enabled },
        }),
      ),
    revokeShare: async (id) =>
      fileShareSchema.parse(
        await call(`/shares/${encodeURIComponent(id)}/revoke`, { method: 'POST' }),
      ),
    issueDirectLinks: async (ids, signal) =>
      directLinkIssueSchema.parse(
        await call('/direct-links', { method: 'POST', body: { ids }, signal }),
      ).results,
    listDirectLinks: async (page, signal) =>
      directLinkPageSchema.parse(await call('/direct-links?page=' + page, { signal })),
    revokeDirectLink: async (id, signal) => {
      await call('/direct-links/' + encodeURIComponent(id), { method: 'DELETE', signal });
    },
    directLink: (token, delivery) => {
      if (!directLinkTokenPattern.test(token)) throw new FilesError('missing');
      return (
        location.origin +
        '/api/v1/file-direct-links/' +
        token +
        (delivery === 'download' ? '?download=true' : '')
      );
    },
    copyDirectLinks: async (urls) => {
      assertCurrent();
      try {
        await navigator.clipboard.writeText(urls.join('\n'));
      } catch (error) {
        throw new FilesError('unavailable', { cause: error });
      }
    },
    shareLink,
    copyShareLink: async (token) => {
      try {
        await navigator.clipboard.writeText(shareLink(token));
      } catch (error) {
        throw new FilesError('unavailable', { cause: error });
      }
    },
    chooseFiles: () => choose('files'),
    chooseDirectory: () => choose('directory'),
    focusSearch: () =>
      document
        .querySelector<HTMLInputElement>('[data-file-workspace-search] input[type="search"]')
        ?.focus(),
    focusFiles: () => document.getElementById('main-content')?.focus(),
    focusEntry: (id) => document.getElementById('file-entry-' + id)?.focus(),
    subscribeShortcuts: (listener, accepted) => {
      const handle = (event: KeyboardEvent) => {
        if (
          event.defaultPrevented ||
          event.isComposing ||
          disposed ||
          document.querySelector('[role="dialog"],[role="menu"]')
        )
          return;
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest('input,textarea,select,[contenteditable="true"],[role="treegrid"]')
        )
          return;
        let shortcut: FileShortcut | undefined;
        const command = event.ctrlKey || event.metaKey;
        if (event.altKey && !command && event.key === 'ArrowUp') shortcut = 'parentFolder';
        else if (command && !event.altKey && event.key.toLowerCase() === 'c')
          shortcut = 'copySelection';
        else if (command && !event.altKey && event.key.toLowerCase() === 'x')
          shortcut = 'cutSelection';
        else if (
          command &&
          !event.altKey &&
          event.key.toLowerCase() === 'v' &&
          clipboard.port.getSnapshot().entries.length > 0
        )
          shortcut = 'pasteSelection';
        else if (command && event.key.toLowerCase() === 'a') shortcut = 'selectAll';
        else if (command && event.shiftKey && event.key.toLowerCase() === 'n')
          shortcut = 'newFolder';
        else if (!command && !event.altKey) {
          if (event.key === '/') shortcut = 'search';
          else if (event.key === 'F5') shortcut = 'refresh';
          else if (event.key === 'F2') shortcut = 'rename';
          else if (event.key === 'Delete') shortcut = 'trash';
          else if (event.key === 'Escape') shortcut = 'clearSelection';
          else if (event.key === 'Enter')
            shortcut =
              target instanceof Element && target.closest('[data-file-entry]')
                ? 'openFocused'
                : 'open';
          else if (target instanceof Element && target.closest('[data-file-entry]')) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
              shortcut = event.shiftKey ? 'extendNext' : 'next';
            else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
              shortcut = event.shiftKey ? 'extendPrevious' : 'previous';
            else if (event.key === 'Home') shortcut = event.shiftKey ? 'extendFirst' : 'first';
            else if (event.key === 'End') shortcut = event.shiftKey ? 'extendLast' : 'last';
          }
        }
        if (shortcut && (!accepted || accepted.includes(shortcut))) {
          event.preventDefault();
          listener(shortcut);
        }
      };
      document.addEventListener('keydown', handle);
      const cleanup = () => {
        document.removeEventListener('keydown', handle);
        shortcutCleanups.delete(cleanup);
      };
      shortcutCleanups.add(cleanup);
      return cleanup;
    },
    subscribeDrop: (listener) => {
      dropListeners.add(listener);
      return () => {
        dropListeners.delete(listener);
      };
    },
    releaseCandidate: (id) => {
      sources.delete(id);
    },
    download: async (entry) => {
      await port.detail(entry.id);
      nativeDownload(base + native + '/' + encodeURIComponent(entry.id) + '/content', entry.name);
    },
    preview: async (entry, signal) => {
      if (
        !limits ||
        entry.sizeBytes > limits.maxTextBytes ||
        !(
          entry.mediaType.startsWith('text/') ||
          /\.(md|txt|csv|json|xml|html|css|js|log)$/i.test(entry.name)
        )
      )
        throw new FilesError('unsupported');
      const blob = await content(entry.id, signal);
      if (!limits || blob.size > limits.maxTextBytes) throw new ApiError('http', 413);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.includes(0)) throw new FilesError('unsupported');
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch (error) {
        throw new FilesError('unsupported', { cause: error });
      }
    },
    ...createFileSidebarPreferences(account, assertCurrent),
    ...createFilePreferences(call, account, assertCurrent),
    ...createHistoryPreferences(call, assertCurrent),
  };
  return {
    archives: archives.port,
    readDocument: createDocumentReader(call, versions.readContent, assertCurrent),
    subtitles: createVideoSubtitleSource(port, call, assertCurrent),
    port,
    navigation: createFileNavigationPort(call, base + native, () => {
      if (disposed || !account || owner() !== account) throw new FilesError('canceled');
    }),
    connections: createConnectionsPort(call, () => {
      if (disposed || !account || owner() !== account) throw new FilesError('canceled');
    }),
    transfers: transfers.port,
    downloads: downloads.port,
    readMedia: async (
      id: string,
      expectedSizeBytes: number,
      signal: AbortSignal,
      version?: number,
    ) => {
      const previous = mediaTail;
      let release = () => {};
      mediaTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      const requestSignal = AbortSignal.any([signal, lifecycle.signal]);
      await previous;
      try {
        const blob = await withFileIOAdmissionRetry(
          () =>
            version === undefined
              ? content(id, requestSignal)
              : versions.readContent(id, version, requestSignal),
          requestSignal,
          assertCurrent,
        );
        if (blob.size !== expectedSizeBytes) throw new FilesError('conflict');
        return blob;
      } finally {
        release();
      }
    },
    activate: () => {
      disposed = false;
      clipboard.activate();
      downloads.activate();
      if (lifecycle.signal.aborted) lifecycle = new AbortController();
      transfers.activate();
    },
    offer: (files: readonly File[]) => {
      if (!dropListeners.size || disposed) return;
      const candidates = register(files);
      for (const listener of dropListeners) listener(candidates);
    },
    dispose: async () => {
      archives.dispose();
      clipboard.dispose();
      downloads.dispose();
      disposed = true;
      lifecycle.abort();
      const stopping = transfers.dispose();
      directories.clear();
      limits = undefined;
      for (const cleanup of shortcutCleanups) cleanup();
      for (const cancel of openPickers) cancel();
      sources.clear();
      dropListeners.clear();
      await stopping;
    },
  };
}
