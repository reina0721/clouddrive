import { afterEach, expect, it, vi } from 'vitest';
import { verifyAccountPassword } from '../auth/unlock';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function backend(status: number, payload: unknown) {
  vi.stubEnv('NEXT_PUBLIC_AUTH_MODE', 'backend');
  vi.stubEnv('NEXT_PUBLIC_AUTH_API_BASE_URL', '/api/console/v1');
  const request = vi.fn((url: string, init?: RequestInit) => {
    void init;
    return Promise.resolve(
      url.endsWith('/auth/csrf')
        ? Response.json({ token: 'test-csrf' })
        : Response.json(payload, { status }),
    );
  });
  vi.stubGlobal('fetch', request);
  return request;
}

it('只发送密码并要求真实成功回执，不调用登录或更改会话', async () => {
  const request = backend(200, { verified: true });
  expect(await verifyAccountPassword('owner@example.test', 'candidate')).toEqual({ ok: true });
  expect(request.mock.calls[1]?.[0]).toBe('/api/console/v1/auth/password/verify');
  expect(request.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ password: 'candidate' }));
  expect(request.mock.calls[1]?.[1]?.credentials).toBe('include');
});

it.each([
  [401, { error: { code: 'credentials' } }, 'credentials'],
  [401, { error: { code: 'unauthenticated' } }, 'expired'],
  [429, { error: { code: 'forbidden' } }, 'locked'],
  [403, { error: { code: 'forbidden' } }, 'forbidden'],
  [500, { error: { code: 'unavailable' } }, 'unavailable'],
  [200, { verified: false }, 'unavailable'],
])('区分状态%s的结果且不回退演示认证', async (status, payload, code) => {
  backend(status, payload);
  expect(await verifyAccountPassword('owner@example.test', 'candidate')).toEqual({
    ok: false,
    code,
  });
});

it('网络失败可辨识，取消信号交给现有受控传输', async () => {
  const request = backend(200, { verified: true });
  request.mockRejectedValueOnce(new TypeError('offline'));
  const controller = new AbortController();
  expect(await verifyAccountPassword('owner@example.test', 'candidate', controller.signal)).toEqual(
    { ok: false, code: 'unavailable' },
  );
  expect(request.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
});
