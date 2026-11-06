import { describe, expect, it, vi } from 'vitest';
import { FilesError, type FileEntry } from '../../../src/files/model';
import {
  directoryChildren,
  directoryTreePageSize,
  directoryTreeRoot,
  maxDirectoryTreeFolders,
  type DirectoryTreeReader,
} from '../../../src/files/directory-tree';
import { createDirectoryTreeController } from './directory-tree';

const folder = (id: string, parentId = '', name = id): FileEntry => ({
  id,
  parentId,
  name,
  kind: 'folder',
  sizeBytes: 0,
  mediaType: '',
  createdAt: '',
  updatedAt: '',
  trashedAt: null,
  contentRevision: 1,
});
function setup(children: FileEntry[], read?: DirectoryTreeReader) {
  const list = vi.fn<DirectoryTreeReader>(
    read ??
      ((query) =>
        Promise.resolve({
          items: children.slice(
            ((query.page ?? 1) - 1) * directoryTreePageSize,
            (query.page ?? 1) * directoryTreePageSize,
          ),
          breadcrumbs: [],
          total: children.length,
          page: query.page ?? 1,
          pageSize: directoryTreePageSize,
        })),
  );
  const controller = createDirectoryTreeController({ list });
  controller.start();
  controller.synchronize({ revision: '0', parent: '', automatic: true });
  return { list, controller, snapshot: () => controller.store.getState() };
}
describe('工作区目录树的读取与生命周期', () => {
  it('根按需读取，重复展开复用缓存，页码动作不会二次推进', async () => {
    const entries = Array.from({ length: 51 }, (_, i) => folder('folder-' + i));
    const { controller, list, snapshot } = setup(entries);
    expect(list).not.toHaveBeenCalled();
    controller.toggleRoot();
    await controller.loadNext(directoryTreeRoot, 1);
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]![0]).toMatchObject({
      parent: '',
      page: 1,
      pageSize: 50,
      filters: { kinds: ['folder'], scope: 'folder' },
    });
    await controller.loadNext(directoryTreeRoot, 2);
    expect(directoryChildren(snapshot(), directoryTreeRoot)).toHaveLength(51);
    await controller.loadNext(directoryTreeRoot, 2);
    expect(list).toHaveBeenCalledTimes(2);
    controller.toggleRoot();
    controller.toggleRoot();
    await controller.loadNext(directoryTreeRoot, 1);
    expect(list).toHaveBeenCalledTimes(2);
    controller.stop();
  });
  it('失败不冒充空分支，重试成功后移除错误', async () => {
    const { controller, list, snapshot } = setup([folder('a')]);
    list.mockRejectedValueOnce(new FilesError('forbidden'));
    controller.toggleRoot();
    await controller.loadNext(directoryTreeRoot, 1);
    expect(snapshot().branches.get(directoryTreeRoot)).toMatchObject({
      phase: 'failed',
      failure: 'forbidden',
      page: 0,
    });
    await controller.loadNext(directoryTreeRoot, 1);
    expect(snapshot().branches.get(directoryTreeRoot)).toMatchObject({
      phase: 'ready',
      failure: '',
      page: 1,
    });
    expect(snapshot().folders.has('a')).toBe(true);
    controller.stop();
  });
  it('分页途中集合变化明确冲突，保留已读页而非截断成功', async () => {
    const entries = Array.from({ length: 51 }, (_, i) => folder('folder-' + i));
    const { controller, list, snapshot } = setup(entries);
    controller.toggleRoot();
    await controller.loadNext(directoryTreeRoot, 1);
    list.mockResolvedValueOnce({ items: [], breadcrumbs: [], total: 50, page: 2, pageSize: 50 });
    await controller.loadNext(directoryTreeRoot, 2);
    expect(snapshot().branches.get(directoryTreeRoot)).toMatchObject({
      phase: 'failed',
      failure: 'conflict',
      page: 1,
      failedPage: 2,
    });
    expect(directoryChildren(snapshot(), directoryTreeRoot)).toHaveLength(50);
    await controller.loadNext(directoryTreeRoot, 2);
    expect(directoryChildren(snapshot(), directoryTreeRoot)).toHaveLength(51);
    controller.stop();
  });
  it('自动跟随由真实祖先链投影，当前路径在后续分页中不会重复', async () => {
    const a = folder('a'),
      b = folder('b', 'a');
    const siblings = Array.from({ length: 50 }, (_, i) => folder('sibling-' + i));
    const { controller, snapshot } = setup([], (query) =>
      Promise.resolve({
        items:
          query.parent === 'a'
            ? [b]
            : query.parent === 'b'
              ? []
              : query.page === 2
                ? [a]
                : siblings,
        breadcrumbs: query.parent === 'b' ? [a, b] : query.parent === 'a' ? [a] : [],
        page: query.page ?? 1,
        pageSize: 50,
        total: query.parent === 'b' ? 0 : query.parent === 'a' ? 1 : 51,
      }),
    );
    controller.synchronize({ revision: '0', parent: 'b', automatic: true });
    await vi.waitFor(() => expect(snapshot().following).toBe(false));
    expect(snapshot().expanded.has('a')).toBe(true);
    expect(snapshot().expanded.has('b')).toBe(true);
    expect(directoryChildren(snapshot(), directoryTreeRoot)).toContain('a');
    expect(snapshot().branches.get(directoryTreeRoot)?.items).not.toContain('a');
    await controller.loadNext(directoryTreeRoot, 2);
    expect(directoryChildren(snapshot(), directoryTreeRoot)).toHaveLength(51);
    controller.stop();
  });
  it('关闭跟随保持手动探索，重新开启后读取当前路径', async () => {
    const a = folder('a');
    const { controller, list, snapshot } = setup([], (query) =>
      Promise.resolve({
        items: query.parent ? [] : [a],
        breadcrumbs: query.parent ? [a] : [],
        page: query.page ?? 1,
        pageSize: 50,
        total: query.parent ? 0 : 1,
      }),
    );
    controller.synchronize({ revision: '0', parent: 'a', automatic: false });
    expect(list).not.toHaveBeenCalled();
    controller.toggleRoot();
    await controller.loadNext(directoryTreeRoot, 1);
    expect(snapshot().expanded.size).toBe(0);
    controller.synchronize({ revision: '0', parent: 'a', automatic: true });
    await vi.waitFor(() => expect(snapshot().following).toBe(false));
    expect(snapshot().expanded.has('a')).toBe(true);
    controller.stop();
  });
  it('预算拒绝整页并保留原快照，刷新可以重置缓存', async () => {
    const entries = Array.from({ length: maxDirectoryTreeFolders }, (_, i) =>
      folder('folder-' + i),
    );
    const { controller, list, snapshot } = setup(entries);
    controller.toggleRoot();
    await controller.loadNext(directoryTreeRoot, 1);
    for (let page = 2; page <= maxDirectoryTreeFolders / directoryTreePageSize; page++)
      await controller.loadNext(directoryTreeRoot, page);
    expect(snapshot().folders.size).toBe(maxDirectoryTreeFolders);
    list.mockResolvedValueOnce({
      items: [folder('overflow', entries[0]!.id)],
      breadcrumbs: [entries[0]!],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    await controller.loadNext(entries[0]!.id, 1);
    expect(snapshot().branches.get(entries[0]!.id)).toMatchObject({
      phase: 'failed',
      failure: 'budget',
    });
    expect(snapshot().folders.has('overflow')).toBe(false);
    await controller.refresh();
    expect(snapshot().folders.size).toBe(directoryTreePageSize);
    controller.stop();
  });
  it('关闭工作区取消在途及排队请求，晚到响应不能写入缓存', async () => {
    let finish: ((value: Awaited<ReturnType<DirectoryTreeReader>>) => void) | undefined;
    const { controller, list, snapshot } = setup([folder('a'), folder('b')]);
    controller.toggleRoot();
    await controller.loadNext(directoryTreeRoot, 1);
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const first = controller.loadNext('a', 1);
    await vi.waitFor(() => expect(finish).toBeDefined());
    const queued = controller.loadNext('b', 1);
    controller.stop();
    expect(list.mock.calls[1]![1].aborted).toBe(true);
    expect(snapshot().ready).toBe(false);
    finish!({
      items: [folder('late', 'a')],
      breadcrumbs: [folder('a')],
      page: 1,
      pageSize: 50,
      total: 1,
    });
    await Promise.all([first, queued]);
    expect(list).toHaveBeenCalledTimes(2);
    expect(snapshot().folders.has('late')).toBe(false);
    expect(snapshot().branches.get('a')?.phase).toBe('idle');
  });
  it('刷新实际重读已展开探索分支，不用缓存清空冒充回收结果', async () => {
    const a = folder('a'),
      b = folder('b', 'a'),
      c = folder('c', 'b');
    let retained = true;
    const { controller, snapshot } = setup([], (query) =>
      Promise.resolve({
        items: query.parent === 'b' ? (retained ? [c] : []) : query.parent === 'a' ? [b] : [a],
        breadcrumbs: query.parent === 'b' ? [a, b] : query.parent === 'a' ? [a] : [],
        total: query.parent === 'b' && !retained ? 0 : 1,
        page: query.page ?? 1,
        pageSize: directoryTreePageSize,
      }),
    );
    controller.synchronize({ revision: '0', parent: 'a', automatic: true });
    await vi.waitFor(() => expect(snapshot().following).toBe(false));
    controller.expand(new Set(['a', 'b']));
    await controller.loadNext('b', 1);
    expect(snapshot().folders.has('c')).toBe(true);
    retained = false;
    await controller.refresh();
    expect(snapshot().ready).toBe(true);
    expect(snapshot().branches.get('b')).toMatchObject({ phase: 'ready', total: 0 });
    expect(snapshot().folders.has('c')).toBe(false);
    controller.stop();
  });
  it('effect停止并恢复时重新建立当前路径，旧响应不得覆盖新代次', async () => {
    const resolvers: ((value: Awaited<ReturnType<DirectoryTreeReader>>) => void)[] = [];
    const a = folder('a', '', '新名称');
    const { controller, snapshot } = setup([], (query) =>
      query.parent
        ? new Promise((resolve) => {
            resolvers.push(resolve);
          })
        : Promise.resolve({ items: [a], breadcrumbs: [], page: 1, pageSize: 50, total: 1 }),
    );
    controller.synchronize({ revision: '0', parent: 'a', automatic: true });
    await vi.waitFor(() => expect(resolvers).toHaveLength(1));
    controller.stop();
    controller.start();
    controller.synchronize({ revision: '0', parent: 'a', automatic: true });
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1]!({ items: [], breadcrumbs: [a], page: 1, pageSize: 50, total: 0 });
    await vi.waitFor(() => expect(snapshot().following).toBe(false));
    resolvers[0]!({
      items: [],
      breadcrumbs: [folder('a', '', '旧名称')],
      page: 1,
      pageSize: 50,
      total: 0,
    });
    await Promise.resolve();
    expect(snapshot().folders.get('a')?.name).toBe('新名称');
    expect(snapshot().ready).toBe(true);
    controller.stop();
  });
});
