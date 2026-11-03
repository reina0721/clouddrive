import { z } from 'zod';
import { browserWorkspaceTransfer } from './transfer';
import { createJsonClient, ApiError } from '../api/json-client';
import {
  safeParseWorkspaceSnapshot,
  type ApiWorkbenchPort,
  type WorkspaceSnapshot,
} from '@clouddrive/surface/api-workbench';
const executionSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    response: z.object({
      status: z.number(),
      statusText: z.string(),
      durationMs: z.number(),
      sizeBytes: z.number(),
      headers: z.array(z.tuple([z.string(), z.string()])),
      body: z.string(),
    }),
  }),
  z.object({
    ok: z.literal(false),
    failure: z.object({
      kind: z.enum(['network', 'cors', 'timeout', 'aborted', 'invalid-url', 'unsupported']),
      message: z.string().optional(),
      details: z.string().optional(),
    }),
  }),
]);
const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetCollectionId: z.string(),
  cronOrInterval: z.string(),
  enabled: z.boolean(),
  version: z.number().int().positive(),
  lastRun: z.object({ time: z.string(), passed: z.boolean(), message: z.string() }).optional(),
});
function parseWorkspace(value: unknown): WorkspaceSnapshot {
  const envelope = z
    .object({
      version: z.literal(1),
      projects: z.array(z.unknown()),
      collections: z.array(z.unknown()),
      requests: z.array(z.unknown()),
      environments: z.array(z.unknown()),
      globals: z.array(z.unknown()),
      tasks: z.array(z.unknown()),
      history: z.array(z.unknown()),
    })
    .safeParse(value);
  if (!envelope.success) throw new ApiError('protocol');
  const result = safeParseWorkspaceSnapshot(value);
  if (!result.success) throw new ApiError('protocol');
  for (const key of [
    'projects',
    'collections',
    'requests',
    'environments',
    'globals',
    'tasks',
    'history',
  ] as const) {
    if (result.data[key].length !== envelope.data[key].length) throw new ApiError('protocol');
  }
  for (let i = 0; i < result.data.requests.length; i++) {
    const request = z
      .object({
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
        url: z.string(),
        name: z.string(),
      })
      .safeParse(envelope.data.requests[i]);
    if (!request.success) throw new ApiError('protocol');
  }
  return result.data;
}
export function createBackendApiWorkbenchService(apiBaseUrl: string): ApiWorkbenchPort {
  const json = createJsonClient(apiBaseUrl);
  const taskVersions = new Map<string, number>();
  let etag = '"0"';
  let queue: Promise<void> = Promise.resolve();
  const response = (res: Response) => {
    if (res.ok && res.headers.get('ETag')) etag = res.headers.get('ETag') ?? etag;
  };
  return {
    transfer: browserWorkspaceTransfer,
    capabilities: { mode: 'backend', disguise: true, corsFree: true, persistentTasks: true },
    workspace: {
      load: async () => {
        const raw = await json('/api-workbench/workspace', { onResponse: response });
        const snapshot = parseWorkspace(raw);
        const tasks = z.array(taskSchema).parse(z.object({ tasks: z.unknown() }).parse(raw).tasks);
        for (const task of tasks) taskVersions.set(task.id, task.version ?? 0);
        return snapshot;
      },
      save: (snapshot) => {
        const next = queue.then(async () => {
          await json('/api-workbench/workspace', {
            method: 'PUT',
            body: snapshot,
            headers: { 'If-Match': etag },
            onResponse: response,
          });
        });
        // 当前保存失败由调用方呈现；后续显式重试不自动覆盖服务器版本。
        queue = next.catch(() => undefined);
        return next;
      },
      clearHistory: async () => {
        await queue;
        await json('/api-workbench/workspace/history', {
          method: 'DELETE',
          body: {},
          headers: { 'If-Match': etag },
          onResponse: response,
        });
      },
      getUsage: async () =>
        z
          .object({ dbSizeFormatted: z.string(), count: z.number() })
          .parse(await json('/api-workbench/workspace/usage')),
    },
    transport: {
      execute: async (input, signal) => {
        try {
          return executionSchema.parse(
            await json('/api-workbench/execute', {
              method: 'POST',
              body: input,
              timeoutMs: 35_000,
              ...(signal ? { signal } : {}),
            }),
          );
        } catch (error) {
          if (signal?.aborted) return { ok: false, failure: { kind: 'aborted' } };
          if (error instanceof ApiError && error.code === 'timeout')
            return { ok: false, failure: { kind: 'timeout' } };
          throw error;
        }
      },
    },
    tasks: {
      list: async () => {
        const tasks = z.array(taskSchema).parse(await json('/api-workbench/tasks'));
        for (const task of tasks) taskVersions.set(task.id, task.version ?? 0);
        return tasks;
      },
      upsert: async (task) => {
        await queue;
        await json('/api-workbench/tasks', {
          method: 'POST',
          body: { ...task, version: taskVersions.get(task.id) ?? 0 },
        });
        taskVersions.set(task.id, (taskVersions.get(task.id) ?? 0) + 1);
      },
      remove: async (id) => {
        await json(
          `/api-workbench/tasks/${encodeURIComponent(id)}?version=${taskVersions.get(id) ?? 0}`,
          { method: 'DELETE', body: {} },
        );
      },
    },
  };
}
