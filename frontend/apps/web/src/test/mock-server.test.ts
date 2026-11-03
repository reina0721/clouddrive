import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createMockServer } from './mock-server';

const server = createMockServer(
  http.get('http://localhost/foundation-status', () => HttpResponse.json({ status: 'ready' })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('mock server boundary', () => {
  it('用 MSW 拦截测试请求而不访问真实服务', async () => {
    const response = await fetch('http://localhost/foundation-status');
    await expect(response.json()).resolves.toEqual({ status: 'ready' });
  });
});
