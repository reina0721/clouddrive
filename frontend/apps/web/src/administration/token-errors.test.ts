import { afterEach, expect, it, vi } from 'vitest';
import { createAdministrationPort } from './backend';

afterEach(() => vi.unstubAllGlobals());

it.each([
  [401, 'unauthenticated'],
  [403, 'forbidden'],
  [404, 'not-found'],
  [409, 'conflict'],
  [412, 'conflict'],
  [422, 'validation'],
  [503, 'unavailable'],
])('令牌 HTTP %s 保留业务失败 %s', async (status, code) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}', { status }))),
  );
  const port = createAdministrationPort('/api', () => 'owner');
  await expect(port.tokens()).rejects.toMatchObject({ code });
});

it('账号在失败请求期间变化时，旧账号的错误不会泄露到新会话', async () => {
  let owner = 'first';
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      owner = 'second';
      return Promise.resolve(new Response('{}', { status: 409 }));
    }),
  );
  await expect(createAdministrationPort('/api', () => owner).tokens()).rejects.toMatchObject({
    code: 'unauthenticated',
  });
});

it('损坏的令牌列表转换为协议错误', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({ items: [{}] }))),
  );
  await expect(createAdministrationPort('/api', () => 'owner').tokens()).rejects.toMatchObject({
    code: 'protocol',
  });
});
