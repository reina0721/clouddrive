import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFilesRuntime } from './backend';
import { fileDestinationHref } from './destinations';
const runtimes: ReturnType<typeof createFilesRuntime>[] = [];
function fixture(owner: () => string | null = () => 'workspace-one') {
  const runtime = createFilesRuntime('/api', owner, vi.fn(), vi.fn());
  runtimes.push(runtime);
  return runtime;
}
beforeEach(() => localStorage.clear());
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose();
});
describe('文件工作区Host边界', () => {
  it('浏览条件只能进入文件路由，名称中的URL字符不会变成另一条参数', () => {
    const href = fileDestinationHref('files', { parent: 'folder', search: 'report&trash=true?#' });
    const url = new URL(href, 'https://example.test');
    expect(url.searchParams.get('search')).toBe('report&trash=true?#');
    expect(url.searchParams.has('trash')).toBe(false);
    expect(fileDestinationHref('shares', { parent: 'private' })).toBe('/home/shares');
  });
  it('折叠偏好按账号隔离，旧运行域在账号改变后拒绝读写', () => {
    let owner = 'workspace-one';
    const first = fixture(() => owner);
    first.port.saveSidebarPreferences({ collapsed: true, autoExpandTree: false });
    const second = fixture(() => 'workspace-two');
    expect(second.port.loadSidebarPreferences()).toEqual({
      collapsed: false,
      autoExpandTree: true,
    });
    expect(first.port.loadSidebarPreferences()).toEqual({ collapsed: true, autoExpandTree: false });
    owner = 'workspace-two';
    expect(() =>
      first.port.saveSidebarPreferences({ collapsed: false, autoExpandTree: true }),
    ).toThrow();
    expect(() => first.port.loadSidebarPreferences()).toThrow();
  });
  it('损坏的侧栏记录不会静默覆盖文件视图偏好', () => {
    const runtime = fixture();
    localStorage.setItem('clouddrive.files.sidebar.v1.workspace-one', '{"collapsed":true}');
    expect(() => runtime.port.loadSidebarPreferences()).toThrow();
    expect(localStorage.getItem('clouddrive.files.view.v1.workspace-one')).toBe(null);
  });
  it('目录树拥有自己的按键，不把删除、改名或全选转给主文件列表', async () => {
    const runtime = fixture();
    const listener = vi.fn();
    runtime.port.subscribeShortcuts(listener);
    const collection = document.createElement('div');
    collection.setAttribute('role', 'treegrid');
    const focused = document.createElement('div');
    focused.setAttribute('role', 'row');
    collection.append(focused);
    document.body.append(collection);
    try {
      for (const key of ['Delete', 'F2', 'Enter', 'a']) {
        const event = new KeyboardEvent('keydown', {
          key,
          ctrlKey: key === 'a',
          bubbles: true,
          cancelable: true,
        });
        focused.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(listener).not.toHaveBeenCalled();
    } finally {
      collection.remove();
      await runtime.dispose();
    }
  });
  it('限定搜索订阅不吞F5、表单或输入法按键，销毁后不保留监听', async () => {
    const runtime = fixture(),
      listener = vi.fn();
    runtime.port.subscribeShortcuts(listener, ['search']);
    const refresh = new KeyboardEvent('keydown', { key: 'F5', cancelable: true, bubbles: true });
    document.body.dispatchEvent(refresh);
    expect(refresh.defaultPrevented).toBe(false);
    const search = new KeyboardEvent('keydown', { key: '/', cancelable: true, bubbles: true });
    document.body.dispatchEvent(search);
    expect(search.defaultPrevented).toBe(true);
    expect(listener).toHaveBeenCalledWith('search');
    listener.mockClear();
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: '/', cancelable: true, bubbles: true }),
    );
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '/',
        isComposing: true,
        cancelable: true,
        bubbles: true,
      }),
    );
    expect(listener).not.toHaveBeenCalled();
    input.remove();
    await runtime.dispose();
    const after = new KeyboardEvent('keydown', { key: '/', cancelable: true, bubbles: true });
    document.body.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
