import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesError } from '@clouddrive/surface/files';
import { createFileSidebarPreferences } from './sidebar-preferences';

describe('设备侧栏偏好的迁移和隔离', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  const legacyKey = 'clouddrive.files.sidebar.v1.one';
  const key = 'clouddrive.files.sidebar.v2.one';
  it('保留旧折叠值，成功写新键后删除旧键，不改服务器视图配置', () => {
    localStorage.setItem(legacyKey, 'true');
    localStorage.setItem('clouddrive.files.view.v2.one', 'retained-view');
    const port = createFileSidebarPreferences('one', vi.fn());
    expect(port.loadSidebarPreferences()).toEqual({ collapsed: true, autoExpandTree: true });
    expect(localStorage.getItem(legacyKey)).toBeNull();
    port.saveSidebarPreferences({ collapsed: false, autoExpandTree: false });
    expect(port.loadSidebarPreferences()).toEqual({ collapsed: false, autoExpandTree: false });
    expect(localStorage.getItem('clouddrive.files.view.v2.one')).toBe('retained-view');
  });
  it('新文档落盘失败时保留旧键及错误链', () => {
    localStorage.setItem(legacyKey, 'true');
    const cause = new Error('storage unavailable');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw cause;
    });
    const port = createFileSidebarPreferences('one', vi.fn());
    expect(() => port.loadSidebarPreferences()).toThrow(expect.objectContaining({ cause }));
    expect(localStorage.getItem(legacyKey)).toBe('true');
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('损坏旧值和新文档不静默变成默认值', () => {
    const port = createFileSidebarPreferences('one', vi.fn());
    localStorage.setItem(legacyKey, '{"collapsed":true}');
    expect(() => port.loadSidebarPreferences()).toThrow(FilesError);
    expect(localStorage.getItem(legacyKey)).not.toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    localStorage.setItem(key, '{"collapsed":false,"autoExpandTree":true,"unknown":true}');
    expect(() => port.loadSidebarPreferences()).toThrow(FilesError);
    expect(localStorage.getItem(key)).toContain('unknown');
  });
  it('账号设置分别保存，失效Host拒绝读取和写入', () => {
    let current = true;
    const one = createFileSidebarPreferences('one', () => {
      if (!current) throw new FilesError('canceled');
    });
    const two = createFileSidebarPreferences('two', vi.fn());
    one.saveSidebarPreferences({ collapsed: true, autoExpandTree: false });
    expect(two.loadSidebarPreferences()).toEqual({ collapsed: false, autoExpandTree: true });
    current = false;
    expect(() => one.loadSidebarPreferences()).toThrow(
      expect.objectContaining({ code: 'canceled' }),
    );
    expect(() => one.saveSidebarPreferences({ collapsed: false, autoExpandTree: true })).toThrow();
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      collapsed: true,
      autoExpandTree: false,
    });
  });
});
