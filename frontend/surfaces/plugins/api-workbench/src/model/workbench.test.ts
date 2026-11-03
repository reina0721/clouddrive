import { describe, expect, it } from 'vitest';
import { interpolateString, resolveVariableMap } from './interpolate';
import { base64Decode, base64Encode, md5 } from './crypto';
import { createExpectation } from './assertions';
import { evaluateJsonPath, runExtractors } from './extractors';
import { buildResolvedRequest } from './build-request';
import { parseCurl } from './curl';
import { dispatchMockRoute } from '@clouddrive/surface/api-workbench';
import { safeParseWorkspaceSnapshot } from '@clouddrive/surface/api-workbench';
import { runCollectionBatch } from './runner';
import type {
  ApiRequestDefinition,
  ExecutedResponse,
  RequestTransport,
} from '@clouddrive/surface/api-workbench';

describe('API Workbench - interpolate', () => {
  it('resolves variables with env overriding globals and built-in variables', () => {
    const globals = [
      { id: '1', key: 'baseUrl', value: 'https://global.com', enabled: true },
      { id: '2', key: 'token', value: 'global_token', enabled: true },
    ];
    const envVars = [{ id: '3', key: 'baseUrl', value: 'https://env.com', enabled: true }];

    const map = resolveVariableMap(envVars, globals);
    expect(map.baseUrl).toBe('https://env.com');
    expect(map.token).toBe('global_token');

    const result = interpolateString('{{baseUrl}}/users?t={{token}}', map);
    expect(result).toBe('https://env.com/users?t=global_token');

    const tsResult = interpolateString('time={{$timestamp}}', map);
    expect(tsResult).toMatch(/^time=\d+$/);

    const uuidResult = interpolateString('id={{$uuid}}', map);
    expect(uuidResult.length).toBeGreaterThan(10);
  });
});

describe('API Workbench - crypto', () => {
  it('computes correct MD5 hashes against known test vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('secret')).toBe('5ebe2294ecd0e0f08eab7690d2a6ee69');
    expect(md5('admin')).toBe('21232f297a57a5a743894a0e4a801fc3');
  });

  it('encodes and decodes base64 strings accurately', () => {
    const encoded = base64Encode('admin:password123');
    expect(encoded).toBe('YWRtaW46cGFzc3dvcmQxMjM=');
    expect(base64Decode(encoded)).toBe('admin:password123');
  });
});

describe('API Workbench - assertions', () => {
  it('passes valid expectations and throws on invalid', () => {
    const exp200 = createExpectation(200);
    expect(() => exp200.toBe(200)).not.toThrow();
    expect(() => exp200.toBe(404)).toThrow();
    expect(() => exp200.toBeGreaterThan(100)).not.toThrow();
    expect(() => exp200.toBeLessThan(100)).toThrow();

    const expObj = createExpectation({ code: 0, items: [1, 2] });
    expect(() => expObj.toEqual({ code: 0, items: [1, 2] })).not.toThrow();
    expect(() => expObj.toEqual({ code: 1 })).toThrow();

    const expStr = createExpectation('success response');
    expect(() => expStr.toContain('success')).not.toThrow();
    expect(() => expStr.not.toContain('error')).not.toThrow();
    expect(() => expStr.toContain('missing')).toThrow();
  });
});

describe('API Workbench - extractors', () => {
  it('evaluates nested JSONPath and extracts values correctly', () => {
    const data = {
      code: 0,
      data: {
        token: 'jwt_xyz_123',
        user: { id: 'usr_42' },
      },
      items: [{ id: 'item_1' }, { id: 'item_2' }],
    };

    expect(evaluateJsonPath(data, '$.data.token')).toBe('jwt_xyz_123');
    expect(evaluateJsonPath(data, '$.data.user.id')).toBe('usr_42');
    expect(evaluateJsonPath(data, '$.items[1].id')).toBe('item_2');

    const fakeResponse: ExecutedResponse = {
      status: 200,
      statusText: 'OK',
      durationMs: 50,
      sizeBytes: 100,
      headers: [['X-Custom-Header', 'custom_value']],
      body: JSON.stringify(data),
    };

    const extractors = [
      {
        id: '1',
        variable: 'authToken',
        source: 'body-json' as const,
        expression: '$.data.token',
        scope: 'env' as const,
      },
      {
        id: '2',
        variable: 'headerVal',
        source: 'header' as const,
        expression: 'x-custom-header',
        scope: 'global' as const,
      },
      {
        id: '3',
        variable: 'httpStatus',
        source: 'status' as const,
        expression: '',
        scope: 'env' as const,
      },
    ];

    const results = runExtractors(extractors, fakeResponse);
    expect(results).toEqual([
      { key: 'authToken', value: 'jwt_xyz_123', scope: 'env' },
      { key: 'headerVal', value: 'custom_value', scope: 'global' },
      { key: 'httpStatus', value: '200', scope: 'env' },
    ]);
  });
});

describe('API Workbench - buildRequest & curl', () => {
  it('builds resolved request with Auth headers and interpolated query', () => {
    const def: ApiRequestDefinition = {
      id: 'req_1',
      collectionId: 'c1',
      name: 'Test Req',
      method: 'POST',
      url: '{{baseUrl}}/test',
      params: [{ id: 'p1', key: 'q', value: 'search_{{term}}', enabled: true }],
      headers: [{ id: 'h1', key: 'X-Key', value: 'val', enabled: true }],
      auth: { type: 'bearer', token: '{{token}}' },
      body: { type: 'json', content: '{"hello":"{{name}}"}' },
      disguise: { timeoutMs: 5000 },
      extractors: [],
      preScript: '',
      postScript: '',
    };

    const resolved = buildResolvedRequest(def, {
      baseUrl: 'http://localhost',
      term: 'apple',
      token: 'tok_123',
      name: 'world',
    });

    expect(resolved.url).toBe('http://localhost/test?q=search_apple');
    expect(resolved.headers['X-Key']).toBe('val');
    expect(resolved.headers['Authorization']).toBe('Bearer tok_123');
    expect(resolved.headers['Content-Type']).toBe('application/json');
    expect(resolved.body).toBe('{"hello":"world"}');
  });

  it('parses cURL commands accurately', () => {
    const curl = `curl -X POST https://api.com/v1/auth -H "Content-Type: application/json" -H "Authorization: Bearer test" -d '{"username":"admin"}'`;
    const parsed = parseCurl(curl);
    expect(parsed).not.toBeNull();
    expect(parsed?.method).toBe('POST');
    expect(parsed?.url).toBe('https://api.com/v1/auth');
    expect(parsed?.headers.some((h) => h.key.toLowerCase() === 'authorization')).toBe(true);
    expect(parsed?.body.type).toBe('json');
  });
});

describe('API Workbench - mock server routes', () => {
  it('serves simulated mock routes', async () => {
    const usersRes = await dispatchMockRoute({
      method: 'GET',
      url: 'mock://users',
      headers: {},
      timeoutMs: 1000,
    });
    expect(usersRes.status).toBe(200);
    const usersBody = JSON.parse(usersRes.body) as { code: number; items: unknown[] };
    expect(usersBody.code).toBe(0);
    expect(usersBody.items.length).toBeGreaterThan(0);

    const notFoundRes = await dispatchMockRoute({
      method: 'GET',
      url: 'mock://status/404',
      headers: {},
      timeoutMs: 1000,
    });
    expect(notFoundRes.status).toBe(404);
  });
});

describe('API Workbench - runner batch execution', () => {
  it('executes collection requests and accumulates test outcomes', async () => {
    const mockTransport: RequestTransport = {
      execute: (req) => {
        if (req.url.includes('users')) {
          return Promise.resolve({
            ok: true,
            response: {
              status: 200,
              statusText: 'OK',
              durationMs: 25,
              sizeBytes: 80,
              headers: [['content-type', 'application/json']],
              body: JSON.stringify({ code: 0, items: [{ id: 'u1' }] }),
            },
          });
        }
        return Promise.resolve({
          ok: false,
          failure: { kind: 'network', message: 'Fail' },
        });
      },
    };

    const requests: ApiRequestDefinition[] = [
      {
        id: 'r1',
        collectionId: 'c1',
        name: 'Get Users',
        method: 'GET',
        url: 'http://test/users',
        params: [],
        headers: [],
        auth: { type: 'none' },
        body: { type: 'none' },
        disguise: { timeoutMs: 1000 },
        extractors: [
          {
            id: 'e1',
            variable: 'userId',
            source: 'body-json',
            expression: '$.items[0].id',
            scope: 'env',
          },
        ],
        preScript: '',
        postScript: `toapi.test('Status is 200', () => toapi.expect(toapi.response.status).toBe(200));`,
      },
    ];

    const result = await runCollectionBatch(requests, {}, {}, mockTransport);
    expect(result.total).toBe(1);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.items[0]?.passed).toBe(true);
    expect(result.items[0]?.tests[0]?.passed).toBe(true);
  });
});

describe('API Workbench - schema validation', () => {
  it('accepts valid workspace snapshot', () => {
    const snap = {
      version: 1,
      projects: [{ id: 'p1', name: 'Proj' }],
      collections: [{ id: 'c1', projectId: 'p1', name: 'Col' }],
      requests: [],
      environments: [],
      globals: [],
      tasks: [],
      history: [],
    };
    const parsed = safeParseWorkspaceSnapshot(snap);
    expect(parsed.success).toBe(true);
  });
});
