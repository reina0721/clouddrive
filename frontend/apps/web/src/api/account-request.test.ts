import { afterEach, expect, it, vi } from 'vitest';
import { createAccountRequest } from './account-request';
import { createFilesRuntime } from '../files/backend';
import { createBackendIdentityService } from '../identity/backend-service';
import { createBackendAccountSecurity } from '../auth/account-security-service';

afterEach(() => vi.unstubAllGlobals());

it('文件创建在 CSRF 响应体期间切换账户后不会发送创建请求', async () => {
  let owner = 'first';
  const response = Response.json({ token: 'fixture' });
  vi.spyOn(response, 'json').mockImplementation(() => {
    owner = 'second';
    return Promise.resolve({ token: 'fixture' });
  });
  const request = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal('fetch', request);
  const files = createFilesRuntime('/api', () => owner, vi.fn(), vi.fn());
  try {
    await expect(files.port.folder('', 'old intent')).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(request).toHaveBeenCalledTimes(1);
  } finally {
    await files.dispose();
  }
});

it('身份角色操作与会话撤销绑定发起账户，不能越过 CSRF 等待', async () => {
  for (const operation of ['identity', 'sessions']) {
    let owner = 'first';
    const request = vi.fn(() => {
      owner = 'second';
      return Promise.resolve(Response.json({ token: 'fixture' }));
    });
    const guarded = createAccountRequest(() => owner, 'first', request);
    const pending =
      operation === 'identity'
        ? createBackendIdentityService('/api', guarded).setStatus(
            'a85dc835-bd72-44b7-ae08-c46eab423fe8',
            1,
            'disabled',
          )
        : createBackendAccountSecurity('/api', guarded).revokeOtherSessions();
    await expect(pending).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(request).toHaveBeenCalledTimes(1);
  }
});

it('旧账户包装器在新账户下不能发送请求，新包装器可正常发送', async () => {
  let owner = 'first';
  const request = vi.fn(() => Promise.resolve(Response.json({})));
  const old = createAccountRequest(() => owner, owner, request);
  owner = 'second';
  await expect(old('/api')).rejects.toMatchObject({ status: 401 });
  expect(request).not.toHaveBeenCalled();
  await createAccountRequest(() => owner, owner, request)('/api');
  expect(request).toHaveBeenCalledTimes(1);
});
