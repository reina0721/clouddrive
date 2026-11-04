import { Upload, DetailedError } from 'tus-js-client';
import { z } from 'zod';
import {
  FilesError,
  transferSchema,
  transferListingSchema,
  maxTransferQueueEntries,
  type ServerTransfer,
  type TransferItem,
  type TransferPhase,
  type TransferSnapshot,
  type TransfersPort,
  type TransferFilter,
  type UploadCandidate,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';
import { hashFile } from './file-hash';

const pendingStoragePrefix = 'clouddrive.files.pending-transfers.v1';
const retryDelaysMs = [0, 1000, 3000] as const;
const chunkRequestTimeoutMs = 120_000;
const terminalRetentionCount = 100;
const pendingSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      key: z.string().min(16).max(128),
      name: z.string().max(255),
      sizeBytes: z.number().int().nonnegative(),
      parentId: z.string(),
      targetParentId: z.string().optional(),
      relativePath: z.string().optional(),
    }),
  )
  .max(maxTransferQueueEntries);
type Pending = z.infer<typeof pendingSchema>[number];
type Limits = z.infer<typeof transferListingSchema>;
type Managed = {
  view: TransferItem;
  candidate: UploadCandidate;
  key: string;
  rootParentId: string;
  targetParentId: string | undefined;
  source: File | undefined;
  sha: string | undefined;
  server: ServerTransfer | undefined;
  task: Promise<void> | undefined;
  controller: AbortController | undefined;
  upload: Upload | undefined;
};
type Dependencies = Readonly<{
  call: ReturnType<typeof createJsonClient>;
  owner: () => string | null;
  dataURL: (id: string) => string;
  csrf: (signal: AbortSignal) => Promise<string>;
  takeSource: (candidate: UploadCandidate) => File | undefined;
  releaseSource: (id: string) => void;
  resolveParent: (
    candidate: UploadCandidate,
    parentId: string,
    signal: AbortSignal,
  ) => Promise<string>;
  chooseSource: () => Promise<File | undefined>;
}>;

function errorCode(error: unknown): string {
  if (error instanceof FilesError) return error.code;
  if (error instanceof DetailedError) {
    const status = error.originalResponse?.getStatus();
    return status === 401
      ? 'unauthenticated'
      : status === 403
        ? 'forbidden'
        : status === 410
          ? 'expired'
          : status === 404
            ? 'missing'
            : status === 409
              ? 'conflict'
              : status === 413
                ? 'large'
                : status === 429
                  ? 'busy'
                  : 'unavailable';
  }
  return 'unavailable';
}
function terminal(phase: TransferPhase) {
  return phase === 'completed' || phase === 'canceled' || phase === 'expired';
}

/** createTransferRuntime 拥有 File/XHR 和队列，Surface 只接收不可变的语义快照。 */
export function createTransferRuntime(deps: Dependencies) {
  const account = deps.owner();
  const items = new Map<string, Managed>();
  const listeners = new Set<() => void>();
  let disposed = true,
    epoch = 0,
    refreshSequence = 0,
    loadedPending = false;
  let limits: Limits | undefined;
  let snapshot: TransferSnapshot = {
    items: [],
    loading: false,
    failure: '',
    nextCursor: '',
    filter: 'active',
    completedRevision: 0,
    persistenceFailure: false,
  };
  const storageKey = `${pendingStoragePrefix}.${encodeURIComponent(account ?? '')}`;
  function assertOwner() {
    if (disposed || !account || deps.owner() !== account) throw new FilesError('canceled');
  }
  function savePending() {
    try {
      const pending: Pending[] = [];
      for (const item of items.values())
        if (!item.server && !terminal(item.view.phase))
          pending.push({
            id: item.view.id,
            key: item.key,
            name: item.view.name,
            sizeBytes: item.view.sizeBytes,
            parentId: item.rootParentId,
            ...(item.targetParentId ? { targetParentId: item.targetParentId } : {}),
            ...(item.candidate.relativePath ? { relativePath: item.candidate.relativePath } : {}),
          });
      localStorage.setItem(storageKey, JSON.stringify(pending));
      snapshot = { ...snapshot, persistenceFailure: false };
    } catch {
      snapshot = { ...snapshot, persistenceFailure: true };
    }
  }
  function emit(persist = false) {
    if (persist) savePending();
    const old = [...items.values()].filter(
      (item) => terminal(item.view.phase) && !item.source && !item.task,
    );
    for (const item of old.slice(0, Math.max(0, old.length - terminalRetentionCount)))
      items.delete(item.view.id);
    snapshot = { ...snapshot, items: [...items.values()].map((item) => item.view) };
    for (const listener of listeners) listener();
  }
  function update(item: Managed, change: Partial<TransferItem>, persist = false) {
    item.view = { ...item.view, ...change };
    emit(persist);
  }
  function newManaged(candidate: UploadCandidate, parentId: string, key = candidate.id): Managed {
    return {
      view: {
        id: candidate.id,
        serverId: '',
        parentId,
        destinationPath: '',
        destinationAvailable: false,
        name: candidate.name,
        sizeBytes: candidate.sizeBytes,
        sizeKnown: true,
        source: 'tus',
        confirmedBytes: 0,
        hashBytes: 0,
        phase: 'needs-source',
        failure: '',
        entryId: '',
        expiresAt: '',
        bytesPerSecond: 0,
        remainingSeconds: null,
        hasSource: false,
      },
      candidate,
      key,
      rootParentId: parentId,
      targetParentId: undefined,
      source: undefined,
      sha: undefined,
      server: undefined,
      task: undefined,
      controller: undefined,
      upload: undefined,
    };
  }
  function phaseFor(server: ServerTransfer, hasSource: boolean): TransferPhase {
    if (
      server.state === 'completed' ||
      server.state === 'canceled' ||
      server.state === 'expired' ||
      server.state === 'attention'
    )
      return server.state;
    if (server.source === 'webdav') return 'external';
    if (server.offsetBytes === server.sizeBytes) return 'paused';
    return hasSource ? 'paused' : 'needs-source';
  }
  function merge(item: Managed, server: ServerTransfer) {
    const completedBefore = item.view.phase === 'completed';
    item.server = server;
    item.targetParentId = server.parentId;
    item.view = {
      ...item.view,
      serverId: server.id,
      parentId: server.parentId,
      destinationPath: server.destinationPath,
      destinationAvailable: server.destinationAvailable,
      name: server.name,
      sizeBytes: server.sizeBytes,
      sizeKnown: server.sizeKnown,
      source: server.source,
      confirmedBytes: Math.max(item.view.confirmedBytes, server.offsetBytes),
      expiresAt: server.expiresAt,
      entryId: server.entryId,
      failure: server.failureCode,
      phase: item.task ? item.view.phase : phaseFor(server, !!item.source),
    };
    if (server.state === 'completed') {
      item.view = {
        ...item.view,
        phase: 'completed',
        confirmedBytes: server.sizeBytes,
        bytesPerSecond: 0,
        remainingSeconds: null,
        hasSource: false,
      };
      item.source = undefined;
      if (!completedBefore)
        snapshot = { ...snapshot, completedRevision: snapshot.completedRevision + 1 };
    }
  }
  async function control(item: Managed, action: string, signal?: AbortSignal) {
    assertOwner();
    if (!item.server) throw new FilesError('missing');
    const server = transferSchema.parse(
      await deps.call(`/transfers/${encodeURIComponent(item.server.id)}/${action}`, {
        method: 'POST',
        ...(signal ? { signal } : {}),
      }),
    );
    assertOwner();
    merge(item, server);
    emit(true);
    return server;
  }
  function activeCount() {
    return [...items.values()].filter((item) => Boolean(item.task)).length;
  }
  function canRun(item: Managed) {
    if (item.server?.source === 'webdav') return false;
    return !!item.source || (!!item.server && item.server.offsetBytes === item.server.sizeBytes);
  }
  function pump() {
    if (disposed || !limits) return;
    for (const item of items.values()) {
      if (activeCount() >= limits.concurrentUploads) break;
      if (item.task || item.view.phase !== 'waiting' || !canRun(item)) continue;
      const controller = new AbortController();
      item.controller = controller;
      const startedEpoch = epoch;
      item.task = Promise.resolve()
        .then(() => run(item, controller.signal, startedEpoch))
        .catch((error) => {
          if (startedEpoch !== epoch || disposed) return;
          const code = errorCode(error);
          if (code === 'expired') item.source = undefined;
          update(
            item,
            {
              phase: controller.signal.aborted
                ? 'paused'
                : code === 'expired'
                  ? 'expired'
                  : item.server?.state === 'attention'
                    ? 'attention'
                    : 'failed',
              failure: controller.signal.aborted ? '' : item.server?.failureCode || code,
              hasSource: !!item.source,
              bytesPerSecond: 0,
              remainingSeconds: null,
            },
            true,
          );
        })
        .finally(() => {
          item.task = undefined;
          item.controller = undefined;
          item.upload = undefined;
          if (!disposed) {
            emit(true);
            pump();
          }
        });
    }
  }
  async function send(item: Managed, source: File, signal: AbortSignal, startedEpoch: number) {
    if (!limits || !item.server) throw new FilesError('unavailable');
    const url = new URL(deps.dataURL(item.server.id), location.origin);
    if (url.origin !== location.origin) throw new FilesError('unsupported');
    const chunkBytes = limits.chunkBytes;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let accepted = item.server?.offsetBytes ?? 0;
      let sampledAt = performance.now();
      const settle = (error?: unknown) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        if (error)
          reject(error instanceof Error ? error : new FilesError('unavailable', { cause: error }));
        else resolve();
      };
      const upload = new Upload(source, {
        uploadUrl: url.href,
        chunkSize: chunkBytes,
        parallelUploads: 1,
        storeFingerprintForResuming: false,
        retryDelays: [...retryDelaysMs],
        onBeforeRequest: async (request) => {
          assertOwner();
          if (signal.aborted || epoch !== startedEpoch) throw new FilesError('canceled');
          const destination = new URL(request.getURL(), location.origin);
          if (destination.href !== url.href) throw new FilesError('unsupported');
          const xhr = request.getUnderlyingObject() as XMLHttpRequest;
          xhr.withCredentials = true;
          xhr.timeout = chunkRequestTimeoutMs;
          if (request.getMethod() !== 'HEAD')
            request.setHeader('X-CSRF-Token', await deps.csrf(signal));
          assertOwner();
          if (signal.aborted || epoch !== startedEpoch) throw new FilesError('canceled');
        },
        onShouldRetry: (error) => {
          const status = error.originalResponse?.getStatus() ?? 0;
          return (
            !signal.aborted &&
            (status === 0 || status === 409 || status === 423 || status === 429 || status >= 500)
          );
        },
        onChunkComplete: (_chunk, bytes, total) => {
          if (disposed || epoch !== startedEpoch || signal.aborted) return;
          const now = performance.now(),
            seconds = (now - sampledAt) / 1000;
          const speed = seconds > 0 ? Math.max(0, bytes - accepted) / seconds : 0;
          accepted = bytes;
          sampledAt = now;
          update(item, {
            confirmedBytes: bytes,
            bytesPerSecond: speed,
            remainingSeconds: speed > 0 ? Math.ceil((total - bytes) / speed) : null,
          });
        },
        onSuccess: () => settle(),
        onError: (error) => settle(error),
      });
      item.upload = upload;
      const abort = () => {
        void upload.abort(false).then(
          () => settle(new FilesError('canceled')),
          (error) => settle(error),
        );
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      else upload.start();
    });
  }
  async function run(item: Managed, signal: AbortSignal, startedEpoch: number) {
    assertOwner();
    if (!limits) throw new FilesError('unavailable');
    if (item.source) {
      if (!item.sha) {
        update(item, {
          phase: 'hashing',
          failure: '',
          hashBytes: 0,
          bytesPerSecond: 0,
          remainingSeconds: null,
        });
        item.sha = await hashFile(item.source, limits.chunkBytes, signal, (bytes) => {
          if (epoch === startedEpoch && !disposed) update(item, { hashBytes: bytes });
        });
      }
      if (signal.aborted) throw new FilesError('canceled');
      if (!item.server || item.server.state === 'preparing') {
        const parent =
          item.targetParentId ??
          (await deps.resolveParent(item.candidate, item.rootParentId, signal));
        item.targetParentId = parent;
        const server = transferSchema.parse(
          await deps.call('/transfers', {
            method: 'POST',
            body: {
              parentId: parent,
              name: item.view.name,
              sizeBytes: item.source.size,
              sha256: item.sha,
              key: item.key,
            },
            signal,
          }),
        );
        assertOwner();
        merge(item, server);
        emit(true);
      } else {
        const server = transferSchema.parse(
          await deps.call(`/transfers/${encodeURIComponent(item.server.id)}/source`, {
            method: 'POST',
            body: { sha256: item.sha, sizeBytes: item.source.size },
            signal,
          }),
        );
        merge(item, server);
      }
    }
    assertOwner();
    if (signal.aborted || epoch !== startedEpoch) throw new FilesError('canceled');
    if (!item.server) throw new FilesError('missing');
    if (item.server.state === 'completed') {
      merge(item, item.server);
      emit(true);
      return;
    }
    if (item.server.state === 'expired' || item.server.state === 'canceled')
      throw new FilesError('missing');
    if (item.server.offsetBytes < item.server.sizeBytes) {
      if (!item.source) throw new FilesError('missing');
      if (item.server.state === 'paused') await control(item, 'resume', signal);
      if (item.server.state !== 'receiving') throw new FilesError('conflict');
      update(item, { phase: 'uploading', failure: '', bytesPerSecond: 0, remainingSeconds: null });
      await send(item, item.source, signal, startedEpoch);
    }
    if (signal.aborted || epoch !== startedEpoch) throw new FilesError('canceled');
    update(item, {
      phase: 'publishing',
      confirmedBytes: item.view.sizeBytes,
      bytesPerSecond: 0,
      remainingSeconds: null,
    });
    try {
      await control(item, 'commit', signal);
    } catch (error) {
      if (!signal.aborted && epoch === startedEpoch) {
        const server = transferSchema.parse(
          await deps.call(`/transfers/${encodeURIComponent(item.server.id)}`),
        );
        merge(item, server);
        emit(true);
        if (server.state === 'completed') return;
      }
      throw error;
    }
  }
  async function refresh(filter: TransferFilter = snapshot.filter, cursor = '') {
    assertOwner();
    const requestEpoch = epoch,
      sequence = ++refreshSequence;
    snapshot = { ...snapshot, loading: true, failure: '', filter };
    emit();
    try {
      const page = transferListingSchema.parse(
        await deps.call(
          `/transfers?${new URLSearchParams({ state: filter === 'attention' ? '' : filter, cursor, limit: '100' })}`,
        ),
      );
      assertOwner();
      if (requestEpoch !== epoch || sequence !== refreshSequence) return;
      limits = page;
      for (const [id, item] of items)
        if (item.server && !item.source && !item.task) items.delete(id);
      for (const server of page.items) {
        let item = [...items.values()].find((candidate) => candidate.key === server.clientKey);
        if (!item) {
          item = newManaged(
            { id: server.id, name: server.name, sizeBytes: server.sizeBytes },
            server.parentId,
            server.clientKey,
          );
          items.set(item.view.id, item);
        }
        merge(item, server);
      }
      snapshot = { ...snapshot, nextCursor: page.nextCursor };
      emit(true);
      pump();
    } catch (error) {
      if (requestEpoch === epoch && sequence === refreshSequence) {
        snapshot = { ...snapshot, failure: errorCode(error) };
        emit();
      }
      throw error;
    } finally {
      if (requestEpoch === epoch && sequence === refreshSequence) {
        snapshot = { ...snapshot, loading: false };
        emit();
      }
    }
  }
  function find(id: string) {
    const item = items.get(id);
    if (!item) throw new FilesError('missing');
    return item;
  }
  async function pause(id: string) {
    assertOwner();
    const item = find(id);
    if (item.server?.source === 'webdav') throw new FilesError('unsupported');
    item.controller?.abort();
    await item.task;
    assertOwner();
    if (item.server) {
      try {
        await control(item, 'pause');
      } catch (error) {
        const current = transferSchema.parse(
          await deps.call(`/transfers/${encodeURIComponent(item.server.id)}`),
        );
        merge(item, current);
        emit(true);
        if (current.state !== 'completed') {
          update(item, { failure: errorCode(error), bytesPerSecond: 0, remainingSeconds: null });
          throw error;
        }
      }
    }
    if (item.view.phase !== 'completed')
      update(
        item,
        { phase: 'paused', failure: '', bytesPerSecond: 0, remainingSeconds: null },
        true,
      );
  }
  async function resume(id: string) {
    assertOwner();
    const item = find(id);
    if (item.server?.source === 'webdav') throw new FilesError('unsupported');
    if (item.task) return;
    if (!limits) await refresh();
    if (!canRun(item)) {
      update(item, { phase: 'needs-source', failure: '' });
      return;
    }
    if (terminal(item.view.phase)) throw new FilesError('conflict');
    update(
      item,
      { phase: 'waiting', failure: '', bytesPerSecond: 0, remainingSeconds: null },
      true,
    );
    pump();
  }
  const port: TransfersPort = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    pause,
    resume,
    enqueue: async (candidates, parentId) => {
      try {
        assertOwner();
        if (!limits) await refresh('active');
        if (!limits) throw new FilesError('unavailable');
        if (
          [...items.values()].filter((item) => !terminal(item.view.phase)).length +
            candidates.length >
          limits.maxQueueEntries
        )
          throw new FilesError('large');
        const sources = candidates.map((candidate) => deps.takeSource(candidate));
        if (
          sources.some((source, index) => !source || source.size !== candidates[index]?.sizeBytes)
        )
          throw new FilesError('invalid');
        if (sources.some((source) => source && source.size > limits!.maxFileBytes))
          throw new FilesError('large');
        for (let index = 0; index < candidates.length; index++) {
          const candidate = candidates[index];
          if (!candidate) continue;
          const item = newManaged(candidate, parentId);
          item.source = sources[index];
          item.view = { ...item.view, phase: 'waiting', hasSource: true };
          items.set(candidate.id, item);
        }
        emit(true);
        pump();
      } finally {
        for (const candidate of candidates) deps.releaseSource(candidate.id);
      }
    },
    cancel: async (id) => {
      assertOwner();
      const item = find(id);
      item.controller?.abort();
      await item.task;
      assertOwner();
      if (item.server) await control(item, 'cancel');
      item.source = undefined;
      update(
        item,
        {
          phase: 'canceled',
          hasSource: false,
          bytesPerSecond: 0,
          remainingSeconds: null,
          failure: '',
        },
        true,
      );
    },
    reselect: async (id) => {
      assertOwner();
      const item = find(id);
      if (item.server?.source === 'webdav') throw new FilesError('unsupported');
      if (item.task || terminal(item.view.phase)) throw new FilesError('conflict');
      const source = await deps.chooseSource();
      assertOwner();
      if (!source) return;
      if (source.size !== item.view.sizeBytes) throw new FilesError('conflict');
      item.source = source;
      item.sha = undefined;
      update(item, { hasSource: true, phase: 'waiting', failure: '', hashBytes: 0 }, true);
      pump();
    },
    retarget: async (id, parentId, name) => {
      assertOwner();
      const item = find(id);
      if (item.server?.source === 'webdav') throw new FilesError('unsupported');
      if (!item.server || item.task) throw new FilesError('conflict');
      const server = transferSchema.parse(
        await deps.call(`/transfers/${encodeURIComponent(item.server.id)}/target`, {
          method: 'PUT',
          body: { parentId, name },
        }),
      );
      merge(item, server);
      emit(true);
      await resume(id);
    },
    pauseAll: async () => {
      const results = await Promise.allSettled(
        [...items.values()]
          .filter((item) =>
            ['waiting', 'hashing', 'uploading', 'publishing'].includes(item.view.phase),
          )
          .map((item) => pause(item.view.id)),
      );
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length) throw new FilesError('unavailable');
    },
    resumeAll: async () => {
      const results = await Promise.allSettled(
        [...items.values()]
          .filter((item) => item.view.phase === 'paused' && canRun(item))
          .map((item) => resume(item.view.id)),
      );
      if (results.some((result) => result.status === 'rejected'))
        throw new FilesError('unavailable');
    },
  };
  return {
    port,
    activate: () => {
      epoch++;
      disposed = false;
      assertOwner();
      if (!loadedPending) {
        loadedPending = true;
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored)
            for (const descriptor of pendingSchema.parse(JSON.parse(stored))) {
              const item = newManaged(
                {
                  id: descriptor.id,
                  name: descriptor.name,
                  sizeBytes: descriptor.sizeBytes,
                  ...(descriptor.relativePath ? { relativePath: descriptor.relativePath } : {}),
                },
                descriptor.parentId,
                descriptor.key,
              );
              item.targetParentId = descriptor.targetParentId;
              items.set(item.view.id, item);
            }
        } catch {
          snapshot = { ...snapshot, persistenceFailure: true };
        }
      }
      emit();
    },
    dispose: async () => {
      disposed = true;
      const stoppedEpoch = ++epoch;
      for (const item of items.values()) {
        if (item.task && !terminal(item.view.phase))
          item.view = { ...item.view, phase: 'paused', bytesPerSecond: 0, remainingSeconds: null };
        item.controller?.abort();
      }
      await Promise.all([...items.values()].flatMap((item) => (item.task ? [item.task] : [])));
      if (epoch === stoppedEpoch) {
        for (const item of items.values()) item.source = undefined;
        items.clear();
        listeners.clear();
        snapshot = { ...snapshot, items: [], loading: false };
      }
    },
  };
}
