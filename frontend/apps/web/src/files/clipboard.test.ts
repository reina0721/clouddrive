import { describe, it, expect, vi } from 'vitest';
import {
  FilesError,
  type FileEntry,
  type FilesPort,
  fileClipboardMaxEntries,
} from '@clouddrive/surface/files';
import { createFileClipboard } from './clipboard';
import { createFilesRuntime } from './backend';
const entry = (id: string, parentId = 'source', kind: 'file' | 'folder' = 'file'): FileEntry => ({
  id,
  parentId,
  kind,
  name: id + '.txt',
  sizeBytes: 3,
  mediaType: 'text/plain',
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
  trashedAt: null,
  contentRevision: 1,
});
function setup() {
  let active = true;
  const detail = vi.fn<FilesPort['detail']>((id) =>
    Promise.resolve({
      entry: entry(id, id === 'dest' ? '' : 'source', id === 'dest' ? 'folder' : 'file'),
      breadcrumbs: [],
    }),
  );
  const copy = vi.fn<FilesPort['copy']>((id, parent, name) =>
    Promise.resolve({
      ...entry(id + '-copy', parent),
      name,
    }),
  );
  const update = vi.fn<FilesPort['update']>((id, change) =>
    Promise.resolve({ ...entry(id), ...change }),
  );
  const runtime = createFileClipboard(
    () => {
      if (!active) throw new FilesError('canceled');
    },
    { detail, copy, update },
  );
  return {
    ...runtime,
    detail,
    copy,
    update,
    deactivate: () => {
      active = false;
    },
  };
}
describe('账号内文件待处理剪贴板', () => {
  it('快照稳定且不可变；拒绝空、重复、超限和快捷方式', () => {
    const r = setup();
    expect(r.port.getSnapshot()).toBe(r.port.getSnapshot());
    const item = entry('a');
    r.port.set('copy', [item]);
    item.name = 'mutated';
    expect(r.port.getSnapshot().entries[0]?.name).toBe('a.txt');
    expect(Object.isFrozen(r.port.getSnapshot().entries)).toBe(true);
    expect(() => r.port.set('cut', [])).toThrow(FilesError);
    expect(() => r.port.set('cut', [entry('a'), entry('a')])).toThrow(FilesError);
    expect(() =>
      r.port.set(
        'copy',
        Array.from({ length: fileClipboardMaxEntries + 1 }, (_, i) => entry(String(i))),
      ),
    ).toThrow(FilesError);
    expect(() => r.port.set('copy', [{ ...entry('x'), kind: 'shortcut' }])).toThrow(FilesError);
    expect(r.copy).not.toHaveBeenCalled();
  });
  it('全部预检先于写入；复制使用当前名称且保留列表便于再次粘贴', async () => {
    const r = setup();
    r.port.set('copy', [entry('a'), entry('b')]);
    r.detail.mockImplementation((id) =>
      Promise.resolve({
        entry: {
          ...entry(id, id === 'dest' ? '' : 'source', id === 'dest' ? 'folder' : 'file'),
          name: 'fresh-' + id,
        },
        breadcrumbs: [],
      }),
    );
    r.copy.mockImplementation((id, parentId, name) => {
      expect(r.detail).toHaveBeenCalledTimes(3);
      return Promise.resolve({ ...entry(id, parentId), name });
    });
    expect(await r.port.paste('dest')).toEqual({ completed: 2, failures: [] });
    expect(r.copy).toHaveBeenCalledWith('a', 'dest', 'fresh-a');
    expect(r.port.getSnapshot().entries).toHaveLength(2);
    expect(r.port.getSnapshot().pending).toBe(false);
  });
  it('移动部分失败保留失败原原因与待处理项，不伪造原子成功', async () => {
    const r = setup(),
      cause = new FilesError('conflict');
    r.port.set('cut', [entry('a'), entry('b')]);
    r.update.mockRejectedValueOnce(cause);
    const result = await r.port.paste('dest');
    expect(result.completed).toBe(1);
    expect(result.failures[0]?.error).toBe(cause);
    expect(r.port.getSnapshot().entries.map((e) => e.id)).toEqual(['a']);
    expect(r.copy).not.toHaveBeenCalled();
  });
  it('源预检失败时无写入且草稿不丢失', async () => {
    const r = setup();
    r.port.set('copy', [entry('a'), entry('b')]);
    const error = new FilesError('missing');
    r.detail.mockRejectedValueOnce(error);
    await expect(r.port.paste('dest')).rejects.toBe(error);
    expect(r.copy).not.toHaveBeenCalled();
    expect(r.port.getSnapshot().entries).toHaveLength(2);
    expect(r.port.getSnapshot().pending).toBe(false);
  });
  it('拒绝移到同父、复制到自身或后代及重叠源', async () => {
    for (const mode of ['same', 'self', 'descendant', 'overlap'] as const) {
      const r = setup();
      r.port.set(
        mode === 'same' ? 'cut' : 'copy',
        mode === 'overlap' ? [entry('a'), entry('b')] : [entry('a')],
      );
      r.detail.mockImplementation((id) =>
        Promise.resolve({
          entry: entry(id, mode === 'same' ? 'dest' : 'source', id === 'dest' ? 'folder' : 'file'),
          breadcrumbs:
            (mode === 'descendant' && id === 'dest') || (mode === 'overlap' && id === 'b')
              ? [entry('a', 'source', 'folder')]
              : [],
        }),
      );
      await expect(r.port.paste(mode === 'self' ? 'a' : 'dest')).rejects.toBeInstanceOf(FilesError);
      expect(r.copy).not.toHaveBeenCalled();
      expect(r.update).not.toHaveBeenCalled();
    }
  });
  it('pending期间拒绝set/clear和第二次paste', async () => {
    const r = setup();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    r.detail.mockImplementationOnce(async () => {
      await wait;
      return { entry: entry('dest', '', 'folder'), breadcrumbs: [] };
    });
    r.port.set('copy', [entry('a')]);
    const writing = r.port.paste('dest');
    expect(r.port.getSnapshot().pending).toBe(true);
    expect(() => r.port.clear()).toThrow(FilesError);
    expect(() => r.port.set('cut', [entry('b')])).toThrow(FilesError);
    await expect(r.port.paste('dest')).rejects.toMatchObject({ code: 'busy' });
    release();
    await writing;
  });
  it('owner在await中漂移后不执行写入，旧port读取空快照且不可清空', async () => {
    const r = setup();
    r.port.set('copy', [entry('a')]);
    r.detail.mockImplementationOnce(() => {
      r.deactivate();
      return Promise.resolve({ entry: entry('dest', '', 'folder'), breadcrumbs: [] });
    });
    await expect(r.port.paste('dest')).rejects.toMatchObject({ code: 'canceled' });
    expect(r.copy).not.toHaveBeenCalled();
    expect(r.port.getSnapshot().entries).toEqual([]);
    expect(() => r.port.clear()).toThrow(FilesError);
  });
  it('dispose/activate期间旧任务不能写入或修改新一代队列', async () => {
    const r = setup();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    r.detail.mockImplementationOnce(async () => {
      await wait;
      return { entry: entry('dest', '', 'folder'), breadcrumbs: [] };
    });
    r.port.set('copy', [entry('a')]);
    const old = r.port.paste('dest');
    r.dispose();
    expect(() => r.port.set('copy', [entry('ended')])).toThrow(FilesError);
    expect(() => r.port.subscribe(() => {})).toThrow(FilesError);
    r.activate();
    r.port.set('cut', [entry('b')]);
    release();
    await expect(old).rejects.toMatchObject({ code: 'canceled' });
    expect(r.copy).not.toHaveBeenCalled();
    expect(r.port.getSnapshot()).toMatchObject({
      mode: 'cut',
      pending: false,
      entries: [{ id: 'b' }],
    });
  });
  it('取消错误停止后续目标；订阅可释放且清空无文件写入', async () => {
    const r = setup(),
      listener = vi.fn(),
      off = r.port.subscribe(listener);
    r.port.set('cut', [entry('a'), entry('b')]);
    expect(listener).toHaveBeenCalledTimes(1);
    r.update.mockRejectedValueOnce(new FilesError('canceled'));
    await expect(r.port.paste('dest')).rejects.toMatchObject({ code: 'canceled' });
    expect(r.update).toHaveBeenCalledTimes(1);
    off();
    const count = listener.mock.calls.length;
    r.port.clear();
    expect(listener).toHaveBeenCalledTimes(count);
    expect(r.copy).not.toHaveBeenCalled();
  });
  it('实际Host键盘只在文件区分发，输入和浮层保留文本操作', async () => {
    const r = createFilesRuntime(
      '/api/console/v1',
      () => 'owner',
      () => {},
      () => {},
    );
    r.activate();
    const listener = vi.fn(),
      off = r.port.subscribeShortcuts(listener);
    document.body.innerHTML =
      '<main id="main-content" tabindex="-1"><input/><div role="menu"></div></main>';
    const key = (target: Element, key: string, options: KeyboardEventInit = {}) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }),
      );
    key(document.body, 'c', { ctrlKey: true });
    expect(listener).not.toHaveBeenCalled();
    document.querySelector('[role="menu"]')!.remove();
    key(document.querySelector('input')!, 'v', { ctrlKey: true });
    expect(listener).not.toHaveBeenCalled();
    expect(key(document.body, 'v', { ctrlKey: true })).toBe(true);
    expect(listener).not.toHaveBeenCalled();
    r.port.clipboard.set('copy', [entry('a')]);
    for (const [keyName, code] of [
      ['c', 'copySelection'],
      ['x', 'cutSelection'],
      ['v', 'pasteSelection'],
    ] as const) {
      key(document.body, keyName, { ctrlKey: true });
      expect(listener).toHaveBeenLastCalledWith(code);
    }
    key(document.body, 'ArrowUp', { altKey: true });
    expect(listener).toHaveBeenLastCalledWith('parentFolder');
    off();
    await r.dispose();
    document.body.innerHTML = '';
  });
});
