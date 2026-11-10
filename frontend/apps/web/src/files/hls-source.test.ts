import { describe, expect, it, vi } from 'vitest';
import { type FileEntry, type FilesPort } from '@clouddrive/surface/files';
import { createPrivateHlsSource, privateHlsPath } from './hls-source';

function file(name: string, overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    id: name,
    name,
    kind: 'file',
    parentId: '',
    sizeBytes: 4,
    mediaType: 'application/octet-stream',
    createdAt: '',
    updatedAt: '',
    trashedAt: null,
    contentRevision: 1,
    ...overrides,
  };
}

function setup() {
  const folder = file('高清 版', { kind: 'folder' });
  const root = file('影片.m3u8', { parentId: folder.id });
  const fragment = file('片段 1.ts', { parentId: folder.id, sizeBytes: 20 });
  const detail = vi
    .fn<FilesPort['detail']>()
    .mockResolvedValue({ entry: root, breadcrumbs: [folder] });
  const list = vi.fn<FilesPort['list']>().mockImplementation(({ parent, page, filters }) => {
    const items = [folder, fragment].filter(
      (entry) => entry.parentId === parent && entry.name === filters?.keywords?.[0],
    );
    return Promise.resolve({ items, total: items.length, page, pageSize: 50 } as Awaited<
      ReturnType<FilesPort['list']>
    >);
  });
  const read = vi.fn().mockResolvedValue(new Blob(['abcd']));
  const assertCurrent = vi.fn();
  const open = createPrivateHlsSource({ detail, list }, read, assertCurrent);
  const controller = new AbortController();
  return { folder, root, fragment, detail, list, read, open, controller, assertCurrent };
}

describe('私有 HLS 文件读取', () => {
  it('解析 Unicode 和空格，阻止第三方、查询参数及编码分隔符', () => {
    expect(privateHlsPath('https://private-hls.invalid/%E7%89%87%20%E6%AE%B5.ts')).toEqual([
      '片 段.ts',
    ]);
    for (const address of [
      'https://third-party.invalid/seg.ts',
      'https://private-hls.invalid/seg.ts?other=1',
      'https://private-hls.invalid/folder%2Fseg.ts',
      'https://private-hls.invalid/folder%5Cseg.ts',
    ])
      expect(() => privateHlsPath(address)).toThrow();
  });

  it('根列表按选中修订打开，直播刷新读取后续修订', async () => {
    const { root, folder, detail, read, open, controller } = setup();
    const session = await open(root, 32, controller.signal);
    const resource = { url: session.url, kind: 'playlist' } as const;
    await session.read(resource, controller.signal);
    expect(read.mock.calls[0]?.slice(0, 2)).toEqual([root.id, 1]);
    detail.mockResolvedValue({ entry: { ...root, contentRevision: 2 }, breadcrumbs: [folder] });
    await session.read(resource, controller.signal);
    expect(read.mock.calls[1]?.slice(0, 2)).toEqual([root.id, 2]);
    await expect(open(root, 32, controller.signal)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('逐级验证文件夹和切片，并限制字节范围与密钥长度', async () => {
    const { root, fragment, list, read, open, controller } = setup();
    const session = await open(root, 8, controller.signal);
    const url = new URL(encodeURIComponent(fragment.name), session.url).href;
    const resource = { url, kind: 'segment', range: { start: 4, endExclusive: 8 } } as const;
    expect((await session.read(resource, controller.signal)).byteLength).toBe(4);
    expect(read).toHaveBeenCalledWith(
      fragment.id,
      1,
      expect.any(AbortSignal),
      expect.objectContaining({
        maxBlobBytes: 4,
        range: { start: 4, endExclusive: 8, totalBytes: 20 },
      }),
    );
    expect(list).toHaveBeenCalledTimes(2);
    await expect(session.read({ url, kind: 'segment' }, controller.signal)).rejects.toMatchObject({
      code: 'large',
    });
    await expect(
      session.read({ ...resource, range: { start: 12, endExclusive: 21 } }, controller.signal),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(session.read({ url, kind: 'key' }, controller.signal)).rejects.toMatchObject({
      code: 'large',
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('关闭后取消实际读取并拒绝返回迟到字节', async () => {
    const { root, read, open, controller } = setup();
    const session = await open(root, 32, controller.signal);
    read.mockImplementation((_id, _revision, signal: AbortSignal) => {
      controller.abort();
      expect(signal.aborted).toBe(true);
      return Promise.resolve(new Blob(['abcd']));
    });
    await expect(
      session.read({ url: session.url, kind: 'playlist' }, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'canceled' });
  });
});
