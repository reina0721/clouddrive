/**
 * Workspace Snapshot Schema & Validation.
 *
 * Lightweight, zero-dependency JSON structure validation on import and persistence.
 */

import type {
  ApiCollection,
  ApiEnvironment,
  ApiProject,
  ApiRequestDefinition,
  HttpMethod,
  KeyValueEntry,
  RequestAuth,
  RequestBody,
  RequestDisguise,
  RequestHistoryItem,
  TaskDefinition,
  WorkspaceSnapshot,
} from './model';

const VALID_METHODS: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
}

function parseKeyValue(item: unknown): KeyValueEntry | null {
  if (!isObject(item)) return null;
  if (
    typeof item.id !== 'string' ||
    typeof item.key !== 'string' ||
    typeof item.value !== 'string'
  ) {
    return null;
  }
  return {
    id: item.id,
    key: item.key,
    value: item.value,
    enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    ...(typeof item.description === 'string' ? { description: item.description } : {}),
  };
}

function parseAuth(auth: unknown): RequestAuth {
  if (!isObject(auth)) return { type: 'none' };
  if (auth.type === 'bearer' && typeof auth.token === 'string') {
    return { type: 'bearer', token: auth.token };
  }
  if (
    auth.type === 'basic' &&
    typeof auth.username === 'string' &&
    typeof auth.password === 'string'
  ) {
    return { type: 'basic', username: auth.username, password: auth.password };
  }
  if (
    auth.type === 'api-key' &&
    typeof auth.key === 'string' &&
    typeof auth.value === 'string' &&
    (auth.in === 'header' || auth.in === 'query')
  ) {
    return { type: 'api-key', key: auth.key, value: auth.value, in: auth.in };
  }
  return { type: 'none' };
}

function parseBody(body: unknown): RequestBody {
  if (!isObject(body)) return { type: 'none' };
  if (
    (body.type === 'json' || body.type === 'text' || body.type === 'xml') &&
    typeof body.content === 'string'
  ) {
    return { type: body.type, content: body.content };
  }
  if (
    (body.type === 'form-urlencoded' || body.type === 'form-data') &&
    Array.isArray(body.entries)
  ) {
    const entries = body.entries.map(parseKeyValue).filter((e): e is KeyValueEntry => e !== null);
    return { type: body.type, entries };
  }
  return { type: 'none' };
}

function parseDisguise(disguise: unknown): RequestDisguise {
  if (!isObject(disguise)) return { timeoutMs: 10000 };
  return {
    timeoutMs: typeof disguise.timeoutMs === 'number' ? disguise.timeoutMs : 10000,
    ...(typeof disguise.userAgent === 'string' ? { userAgent: disguise.userAgent } : {}),
    ...(typeof disguise.proxy === 'string' ? { proxy: disguise.proxy } : {}),
    ...(typeof disguise.fingerprint === 'string' ? { fingerprint: disguise.fingerprint } : {}),
  };
}

export function safeParseWorkspaceSnapshot(
  input: unknown,
): { success: true; data: WorkspaceSnapshot } | { success: false; error: string } {
  if (!isObject(input)) {
    return { success: false, error: 'Snapshot must be a valid JSON object' };
  }

  const projects: ApiProject[] = Array.isArray(input.projects)
    ? input.projects
        .filter(isObject)
        .map((p) => ({ id: asString(p.id), name: asString(p.name) }))
        .filter((p) => Boolean(p.id && p.name))
    : [];

  const collections: ApiCollection[] = Array.isArray(input.collections)
    ? input.collections
        .filter(isObject)
        .map((c) => ({
          id: asString(c.id),
          projectId: asString(c.projectId),
          name: asString(c.name),
        }))
        .filter((c) => Boolean(c.id && c.projectId && c.name))
    : [];

  const requests: ApiRequestDefinition[] = Array.isArray(input.requests)
    ? input.requests
        .filter(isObject)
        .map((r) => {
          const method = (
            VALID_METHODS.includes(r.method as HttpMethod) ? r.method : 'GET'
          ) as HttpMethod;
          const params = Array.isArray(r.params)
            ? r.params.map(parseKeyValue).filter((p): p is KeyValueEntry => p !== null)
            : [];
          const headers = Array.isArray(r.headers)
            ? r.headers.map(parseKeyValue).filter((h): h is KeyValueEntry => h !== null)
            : [];
          const extractors = Array.isArray(r.extractors)
            ? r.extractors
                .filter(isObject)
                .map((e) => {
                  const scope: 'env' | 'global' = e.scope === 'global' ? 'global' : 'env';
                  const source = (
                    ['body-json', 'header', 'status'].includes(asString(e.source))
                      ? e.source
                      : 'body-json'
                  ) as 'body-json' | 'header' | 'status';
                  return {
                    id: asString(e.id),
                    variable: asString(e.variable),
                    source,
                    expression: asString(e.expression),
                    scope,
                  };
                })
                .filter((e) => Boolean(e.id && e.variable))
            : [];

          return {
            id: asString(r.id),
            collectionId: asString(r.collectionId),
            name: asString(r.name, '未命名接口'),
            method,
            url: asString(r.url),
            params,
            headers,
            auth: parseAuth(r.auth),
            body: parseBody(r.body),
            disguise: parseDisguise(r.disguise),
            extractors,
            preScript: typeof r.preScript === 'string' ? r.preScript : '',
            postScript: typeof r.postScript === 'string' ? r.postScript : '',
          };
        })
        .filter((r) => Boolean(r.id && r.collectionId))
    : [];

  const environments: ApiEnvironment[] = Array.isArray(input.environments)
    ? input.environments
        .filter(isObject)
        .map((env) => ({
          id: asString(env.id),
          name: asString(env.name),
          variables: Array.isArray(env.variables)
            ? env.variables.map(parseKeyValue).filter((v): v is KeyValueEntry => v !== null)
            : [],
        }))
        .filter((env) => Boolean(env.id && env.name))
    : [];

  const globals: KeyValueEntry[] = Array.isArray(input.globals)
    ? input.globals.map(parseKeyValue).filter((g): g is KeyValueEntry => g !== null)
    : [];

  const tasks: TaskDefinition[] = Array.isArray(input.tasks)
    ? input.tasks
        .filter(isObject)
        .map((t) => ({
          id: asString(t.id),
          name: asString(t.name),
          targetCollectionId: asString(t.targetCollectionId),
          cronOrInterval: asString(t.cronOrInterval, '*/5 * * * *'),
          enabled: Boolean(t.enabled),
          ...(isObject(t.lastRun)
            ? {
                lastRun: {
                  time: asString(t.lastRun.time),
                  passed: Boolean(t.lastRun.passed),
                  message: asString(t.lastRun.message),
                },
              }
            : {}),
        }))
        .filter((t) => Boolean(t.id && t.name))
    : [];

  const history: RequestHistoryItem[] = Array.isArray(input.history)
    ? input.history
        .filter(isObject)
        .map((h) => ({
          id: asString(h.id),
          requestId: asString(h.requestId),
          timestamp: asString(h.timestamp),
          method: (VALID_METHODS.includes(h.method as HttpMethod) ? h.method : 'GET') as HttpMethod,
          url: asString(h.url),
          status: asNumber(h.status),
          durationMs: asNumber(h.durationMs),
          sizeBytes: asNumber(h.sizeBytes),
          ...(isObject(h.request)
            ? {
                request: parseWorkspaceSnapshot({ requests: [h.request] }).requests[0],
              }
            : {}),
          ...(typeof h.environmentId === 'string' ? { environmentId: h.environmentId } : {}),
        }))
        .filter((h) => Boolean(h.id && h.url))
    : [];

  const data: WorkspaceSnapshot = {
    version: 1,
    projects,
    collections,
    requests,
    environments,
    ...(typeof input.activeEnvironmentId === 'string'
      ? { activeEnvironmentId: input.activeEnvironmentId }
      : {}),
    globals,
    tasks,
    history,
  };

  return { success: true, data };
}

export function parseWorkspaceSnapshot(input: unknown): WorkspaceSnapshot {
  const parsed = safeParseWorkspaceSnapshot(input);
  if (!parsed.success) {
    throw new Error(parsed.error);
  }
  return parsed.data;
}
