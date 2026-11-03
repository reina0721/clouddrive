// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { createLocalStorage } from './local';
import { createSessionStorage } from './session';

type Payload = { theme: 'light' | 'dark' };

describe('web storage adapters (jsdom)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('localStorage roundtrip（StorageValue JSON 形状）', () => {
    const storage = createLocalStorage<Payload>();
    // persist middleware 写入的是 { state, version }（StorageValue）；这里模拟之。
    storage.setItem('clouddrive.shell', { state: { theme: 'dark' }, version: 1 });
    expect(storage.getItem('clouddrive.shell')).toEqual({
      state: { theme: 'dark' },
      version: 1,
    });
    expect(window.localStorage.getItem('clouddrive.shell')).toContain('"theme":"dark"');
  });

  it('sessionStorage roundtrip + remove', () => {
    const storage = createSessionStorage<Payload>();
    storage.setItem('clouddrive.session', { state: { theme: 'light' }, version: 1 });
    expect(storage.getItem('clouddrive.session')).toEqual({
      state: { theme: 'light' },
      version: 1,
    });
    storage.removeItem('clouddrive.session');
    expect(storage.getItem('clouddrive.session')).toBeNull();
  });

  it('raw key 直接落 Web Storage（namespace 由 persist name 承载）', () => {
    const storage = createLocalStorage<Payload>();
    storage.setItem('clouddrive.shell', { state: { theme: 'dark' }, version: 1 });
    // key 不加额外前缀（避免双重前缀）；与历史 clouddrive.shell 兼容。
    expect(window.localStorage.getItem('clouddrive.shell')).not.toBeNull();
  });

  it('unavailablePolicy=noop 工厂可创建（lazy，无 window 也不崩）', () => {
    const storage = createLocalStorage<Payload>({ unavailablePolicy: 'noop' });
    expect(typeof storage.getItem).toBe('function');
  });
});
