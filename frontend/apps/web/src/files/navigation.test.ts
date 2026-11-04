import { describe, expect, it, vi } from 'vitest';
import { FilesError, type PinListing } from '@clouddrive/surface/files';
import { authPageHref, authReturnDestination } from '../auth/contract';
import {
  fileShareAddress,
  parseFileShareAddress,
  readShareSaveIntent,
  saveShareIntentHref,
  withoutShareSaveIntent,
} from './share-address';
import { createFileNavigationPort } from './navigation';

describe('保存分享与登录返回的Host边界', () => {
  const token = 'a'.repeat(43),
    origin = 'http://localhost:3000';
  it('完整链接只允许本实例固定分享路径和单一有效片段', () => {
    const address = fileShareAddress(token, origin);
    expect(parseFileShareAddress(address, origin)).toBe(token);
    for (const invalid of [
      address.replace(origin, 'https://elsewhere.test'),
      origin + '/share?token=' + token,
      origin + '/share/' + token,
      origin + '/share#token=' + token + '&password=secret',
      origin + '/share#token=' + token + '&token=' + token,
      'http://user:pass@localhost:3000/share#token=' + token,
    ])
      expect(() => parseFileShareAddress(invalid, origin)).toThrow(FilesError);
  });
  it('登录和注册切换均把保存标识留在片段而非服务端请求地址', () => {
    const intent = saveShareIntentHref(token),
      login = new URL(authPageHref('/login', intent), origin);
    expect(login.search).not.toContain(token);
    expect(login.searchParams.get('returnTo')).toBe('/home/shared');
    const restored = authReturnDestination(login.searchParams.get('returnTo'), login.hash);
    expect(restored).toBe(intent);
    const register = new URL(authPageHref('/register', restored), origin);
    expect(register.search).not.toContain(token);
    expect(authReturnDestination(register.searchParams.get('returnTo'), register.hash)).toBe(
      intent,
    );
    expect(readShareSaveIntent(new URL(intent, origin).hash, origin)).toBe(
      fileShareAddress(token, origin),
    );
    expect(withoutShareSaveIntent('#saveShare=' + token + '&view=list')).toBe('#view=list');
    expect(authReturnDestination('https://elsewhere.test', '#returnFragment=hello')).toBe(
      '/#hello',
    );
  });
  it('不会将密码票据或畸形保存意图带入持久状态', () => {
    expect(readShareSaveIntent('#other=ok', origin)).toBeNull();
    for (const hash of [
      '#saveShare=bad',
      '#saveShare=' + token + '&ticket=secret',
      '#saveShare=' + token + '&saveShare=' + token,
    ])
      expect(() => readShareSaveIntent(hash, origin)).toThrow(FilesError);
  });
  it('固定写入保留读取版本，Host失效后不能生成旧账号链接', async () => {
    const call = vi.fn(() => Promise.resolve({ revision: 8 })),
      assertCurrent = vi.fn();
    const nav = createFileNavigationPort(call, '/api/native/files', assertCurrent);
    const snapshot: PinListing = { items: [], revision: 7, limit: 20, metadataLimited: false };
    await nav.reorderPins(snapshot, []);
    expect(call).toHaveBeenCalledWith('/pins/order', {
      method: 'PUT',
      body: { revision: 7, ids: [] },
    });
    await nav.addPin(snapshot, { targetKind: 'shared', targetId: '' });
    expect(call).toHaveBeenLastCalledWith('/pins', {
      method: 'POST',
      body: { revision: 7, targetKind: 'shared', targetId: '' },
    });
    assertCurrent.mockImplementation(() => {
      throw new FilesError('canceled');
    });
    expect(() => nav.shortcutHref('private-id')).toThrow(FilesError);
  });
});
