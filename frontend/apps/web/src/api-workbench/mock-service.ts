/**
 * Mock Service Implementation for API Workbench.
 *
 * Provides:
 * 1. Durable workspace persistence (IndexedDB with LocalStorage / Memory fallback)
 * 2. Request execution:
 *    - mock:// URLs: In-memory Mock Server router (instant, no CORS, full response)
 *    - http(s):// URLs: Real browser direct fetch (with CORS error handling & timeout)
 * 3. Task configuration storage (automatic scheduling is unavailable)
 */

import { browserWorkspaceTransfer } from './transfer';

import {
  dispatchMockRoute,
  safeParseWorkspaceSnapshot,
  type ApiWorkbenchPort,
  type ExecutionResult,
  type ResolvedRequest,
  type TaskDefinition,
  type WorkspaceSnapshot,
} from '@clouddrive/surface/api-workbench';

const STORAGE_KEY = 'clouddrive.api-workbench.workspace.v1';

export function createInitialWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    version: 1,
    projects: [
      {
        id: 'proj_default',
        name: 'ToAPI 默认项目',
      },
    ],
    collections: [
      {
        id: 'col_default',
        projectId: 'proj_default',
        name: '默认集合',
      },
    ],
    requests: [
      {
        id: 'req_users',
        collectionId: 'col_default',
        name: '获取用户列表 (Mock)',
        method: 'GET',
        url: '{{baseUrl}}users',
        params: [],
        headers: [{ id: 'h1', key: 'Accept', value: 'application/json', enabled: true }],
        auth: { type: 'none' },
        body: { type: 'none' },
        disguise: { timeoutMs: 10000 },
        extractors: [
          {
            id: 'ext_1',
            variable: 'userTotal',
            source: 'body-json',
            expression: '$.total',
            scope: 'env',
          },
        ],
        preScript: `// 前置脚本（发送前执行，可改写请求、发子请求、跳过）\nconst ts = toapi.timestamp();\ntoapi.request.setHeader('X-Request-Timestamp', String(ts));\nconsole.log('Pre-script executed with timestamp:', ts);`,
        postScript: `// 后置脚本（收到响应后执行，用于断言与写变量）\ntoapi.test('状态 200', () => {\n  toapi.expect(toapi.response.status).toBe(200);\n});\n\ntoapi.test('返回有效用户列表', () => {\n  const data = JSON.parse(toapi.response.body);\n  toapi.expect(data.code).toBe(0);\n  toapi.expect(Array.isArray(data.items)).toBe(true);\n});\n\n// 提取第一个用户的 ID 到全局变量\ntry {\n  const data = JSON.parse(toapi.response.body);\n  if (data.items && data.items[0]) {\n    toapi.vars.set('firstUserId', data.items[0].id);\n  }\n} catch (e) {}`,
      },
      {
        id: 'req_login',
        collectionId: 'col_default',
        name: '模拟登录认证 (POST)',
        method: 'POST',
        url: '{{baseUrl}}auth/login',
        params: [],
        headers: [{ id: 'h2', key: 'Content-Type', value: 'application/json', enabled: true }],
        auth: { type: 'none' },
        body: {
          type: 'json',
          content: '{\n  "username": "admin",\n  "password": "secret_password"\n}',
        },
        disguise: { timeoutMs: 10000 },
        extractors: [
          {
            id: 'ext_token',
            variable: 'authToken',
            source: 'body-json',
            expression: '$.data.token',
            scope: 'global',
          },
        ],
        preScript: '',
        postScript: `toapi.test('登录成功返回 Token', () => {\n  toapi.expect(toapi.response.status).toBe(200);\n  const res = JSON.parse(toapi.response.body);\n  toapi.expect(Boolean(res.data?.token)).toBe(true);\n});`,
      },
      {
        id: 'req_not_found',
        collectionId: 'col_default',
        name: '模拟 404 响应',
        method: 'GET',
        url: '{{baseUrl}}status/404',
        params: [],
        headers: [],
        auth: { type: 'none' },
        body: { type: 'none' },
        disguise: { timeoutMs: 10000 },
        extractors: [],
        preScript: '',
        postScript: `toapi.test('响应 404', () => {\n  toapi.expect(toapi.response.status).toBe(404);\n});`,
      },
    ],
    environments: [
      {
        id: 'env_dev',
        name: '开发环境',
        variables: [
          { id: 'v1', key: 'baseUrl', value: 'mock://', enabled: true },
          { id: 'v2', key: 'timeout', value: '5000', enabled: true },
        ],
      },
      {
        id: 'env_prod',
        name: '生产环境',
        variables: [{ id: 'v3', key: 'baseUrl', value: 'https://api.example.com/', enabled: true }],
      },
    ],
    activeEnvironmentId: 'env_dev',
    globals: [{ id: 'g1', key: 'appName', value: 'ToAPI Workbench', enabled: true }],
    tasks: [
      {
        id: 'task_health',
        name: '每 5 分钟健康自检',
        targetCollectionId: 'col_default',
        cronOrInterval: '*/5 * * * *',
        enabled: false,
      },
    ],
    history: [],
  };
}

/** Local storage / memory storage adapter with synchronous cache for fast reactivity. */
class StorageAdapter {
  private inMemoryCache: WorkspaceSnapshot | null = null;

  async load(): Promise<WorkspaceSnapshot> {
    if (this.inMemoryCache) return this.inMemoryCache;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      const validation = safeParseWorkspaceSnapshot(parsed);
      if (!validation.success) throw new Error('Invalid stored API workspace');
      this.inMemoryCache = validation.data;
      return validation.data;
    }
    const initial = createInitialWorkspaceSnapshot();
    await this.save(initial);
    return initial;
  }

  save(snapshot: WorkspaceSnapshot): Promise<void> {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      this.inMemoryCache = snapshot;
      return Promise.resolve();
    } catch (failure) {
      return Promise.reject(
        failure instanceof Error ? failure : new Error(String(failure), { cause: failure }),
      );
    }
  }

  async clearHistory(): Promise<void> {
    const current = await this.load();
    const updated: WorkspaceSnapshot = {
      ...current,
      history: [],
    };
    await this.save(updated);
  }

  async getUsage(): Promise<{ dbSizeFormatted: string; count: number }> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY) ?? '';
        const bytes = new Blob([raw]).size;
        const kb = (bytes / 1024).toFixed(1);
        const snapshot = await this.load();
        const count =
          snapshot.projects.length +
          snapshot.collections.length +
          snapshot.requests.length +
          snapshot.history.length;
        return {
          dbSizeFormatted: `${kb} KB`,
          count,
        };
      }
    } catch {
      // fallback
    }
    throw new Error('Workspace storage usage unavailable');
  }
}

export function createMockApiWorkbenchService(): ApiWorkbenchPort {
  const storage = new StorageAdapter();

  return {
    transfer: browserWorkspaceTransfer,
    capabilities: {
      mode: 'mock',
      disguise: false, // UA, proxy, and fingerprint require backend relay
      corsFree: false, // Browser direct requests subject to CORS
      persistentTasks: false, // No scheduler is implemented by this service
    },

    workspace: {
      load: () => storage.load(),
      save: (snapshot: WorkspaceSnapshot) => storage.save(snapshot),
      clearHistory: () => storage.clearHistory(),
      getUsage: () => storage.getUsage(),
    },

    transport: {
      execute: async (req: ResolvedRequest, signal?: AbortSignal): Promise<ExecutionResult> => {
        const startTime = Date.now();

        // 1. Mock Server route
        if (req.url.startsWith('mock://')) {
          try {
            const res = await dispatchMockRoute(req);
            return { ok: true, response: res };
          } catch (err) {
            return {
              ok: false,
              failure: {
                kind: 'network',
                message: err instanceof Error ? err.message : 'Mock server error',
              },
            };
          }
        }

        // 2. Real Browser Direct Fetch
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, req.timeoutMs || 10000);

          if (signal) {
            signal.addEventListener('abort', () => controller.abort());
          }

          const fetchHeaders: Record<string, string> = { ...req.headers };
          // Do not send user-agent or forbidden headers via browser fetch
          delete fetchHeaders['user-agent'];
          delete fetchHeaders['host'];

          const fetchOptions: RequestInit = {
            method: req.method,
            headers: fetchHeaders,
            signal: controller.signal,
            ...(req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined
              ? { body: req.body }
              : {}),
          };

          const rawResponse = await fetch(req.url, fetchOptions);
          clearTimeout(timeoutId);

          const durationMs = Date.now() - startTime;
          const bodyText = await rawResponse.text();
          const sizeBytes = new Blob([bodyText]).size;

          const headersList: [string, string][] = [];
          rawResponse.headers.forEach((val, key) => {
            headersList.push([key, val]);
          });

          return {
            ok: true,
            response: {
              status: rawResponse.status,
              statusText: rawResponse.statusText,
              durationMs,
              sizeBytes,
              headers: headersList,
              body: bodyText,
            },
          };
        } catch (error: unknown) {
          const durationMs = Date.now() - startTime;
          const isAbort =
            (error instanceof DOMException && error.name === 'AbortError') ||
            (error instanceof Error && error.name === 'AbortError');

          if (isAbort) {
            return {
              ok: false,
              failure: {
                kind: 'timeout',
                message: `请求超时或被中断 (${durationMs}ms)`,
                details: '已超过设置的超时时间，或用户手动取消了本次请求。',
              },
            };
          }

          if (error instanceof TypeError) {
            return {
              ok: false,
              failure: {
                kind: 'cors',
                message: '跨域限制 (CORS) 或网络不可达',
                details:
                  '浏览器直发跨域请求受到 Same-Origin Policy 限制。如果目标服务未配置 Access-Control-Allow-Origin，浏览器将拦截响应。后续可切换至后端 Relay 模式以彻底解除跨域限制。',
              },
            };
          }

          return {
            ok: false,
            failure: {
              kind: 'network',
              message: error instanceof Error ? error.message : '未知网络错误',
              details: String(error),
            },
          };
        }
      },
    },

    tasks: {
      list: async (): Promise<readonly TaskDefinition[]> => {
        const snap = await storage.load();
        return snap.tasks;
      },
      upsert: async (task: TaskDefinition): Promise<void> => {
        const snap = await storage.load();
        const existing = snap.tasks.findIndex((t) => t.id === task.id);
        const tasks =
          existing >= 0
            ? snap.tasks.map((t) => (t.id === task.id ? task : t))
            : [...snap.tasks, task];
        await storage.save({ ...snap, tasks });
      },
      remove: async (id: string): Promise<void> => {
        const snap = await storage.load();
        await storage.save({ ...snap, tasks: snap.tasks.filter((t) => t.id !== id) });
      },
    },
  };
}
