import { afterEach, expect, it, vi } from 'vitest';
import { createAdministrationPort } from './backend';

afterEach(() => vi.unstubAllGlobals());

it('CSRF 响应体读取后再次检查账户，不能沿用新账户会话发送旧写入', async () => {
  let owner = 'first';
  const csrf = Response.json({ token: 'fixture' });
  vi.spyOn(csrf, 'json').mockImplementation(() => {
    owner = 'second';
    return Promise.resolve({ token: 'fixture' });
  });
  const request = vi.fn(() => Promise.resolve(csrf));
  vi.stubGlobal('fetch', request);
  await expect(
    createAdministrationPort('/api', () => owner).createTodo('old intent'),
  ).rejects.toMatchObject({ status: 401 });
  expect(request).toHaveBeenCalledTimes(1);
});

it('CSRF 等待期间切换账户会阻止旧管理意图发送业务请求', async () => {
  let owner: string | null = 'first';
  const request = vi.fn(() => {
    owner = 'second';
    return Promise.resolve(Response.json({ token: 'fixture' }));
  });
  vi.stubGlobal('fetch', request);
  await expect(
    createAdministrationPort('/api', () => owner).createTodo('old intent'),
  ).rejects.toMatchObject({ status: 401 });
  expect(request).toHaveBeenCalledTimes(1);
  expect(request).toHaveBeenCalledWith(
    '/api/auth/csrf',
    expect.objectContaining({ credentials: 'include' }),
  );
});

it.each([false, true])('账户变化后隔离业务响应，包括请求失败=%s', async (failed) => {
  let owner = 'first';
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      owner = 'second';
      return failed
        ? Promise.reject(new Error('fixture network failure'))
        : Promise.resolve(Response.json({}));
    }),
  );
  await expect(createAdministrationPort('/api', () => owner).profile()).rejects.toMatchObject({
    status: 401,
  });
});

it('退出账户时不发送请求；同一适配器后续可以服务新的有效账户', async () => {
  let owner: string | null = null;
  const request = vi.fn(() => Promise.resolve(Response.json({ items: [], total: 0 })));
  vi.stubGlobal('fetch', request);
  const port = createAdministrationPort('/api', () => owner);
  await expect(port.todos()).rejects.toMatchObject({ status: 401 });
  expect(request).not.toHaveBeenCalled();
  owner = 'second';
  await expect(port.todos()).resolves.toEqual([]);
});

it('归属不变时写操作仍依次获取 CSRF 并发送业务请求', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ token: 'fixture' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', request);
  await expect(
    createAdministrationPort('/api', () => 'owner').createTodo('current intent'),
  ).resolves.toBeUndefined();
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1]?.[1]).toMatchObject({
    method: 'POST',
    headers: { 'X-CSRF-Token': 'fixture' },
    body: JSON.stringify({ title: 'current intent' }),
  });
});
