import { describe, expect, it, vi } from 'vitest';
import { createVersionsPort } from './versions';
import type { createJsonClient } from '../api/json-client';
import { fileVersionPageSchema, type FileVersion } from '@clouddrive/surface/files';
vi.mock('./native-download', () => ({ nativeDownload: vi.fn() }));
const version: FileVersion = {
  revision: 1,
  current: false,
  name: 'original.txt',
  sizeBytes: 3,
  mediaType: 'text/plain',
  updatedAt: '2026-11-04T00:00:00Z',
};
function fixture() {
  const call = vi.fn<ReturnType<typeof createJsonClient>>();
  const assertCurrent = vi.fn();
  return { call, assertCurrent, ...createVersionsPort(call, '/files', assertCurrent) };
}
describe('历史内容客户端边界', () => {
  it('按明确版本读取文本，拒绝超额、二进制和变化的长度', async () => {
    const f = fixture();
    f.call.mockResolvedValue(new Blob(['old']));
    await expect(f.port.text('id', version, 1024)).resolves.toBe('old');
    expect(f.call).toHaveBeenCalledWith(
      '/id/versions/1/content',
      expect.objectContaining({ responseType: 'blob' }),
    );
    await expect(f.port.text('id', version, 2)).rejects.toMatchObject({ code: 'large' });
    f.call.mockResolvedValue(new Blob(['\0xx']));
    await expect(f.port.text('id', version, 1024)).rejects.toMatchObject({ code: 'unsupported' });
    f.call.mockResolvedValue(new Blob(['longer']));
    await expect(f.port.text('id', version, 1024)).rejects.toMatchObject({ code: 'conflict' });
  });
  it('失效账号拒绝读取或交付结果，UTF8 解码保留原因', async () => {
    const f = fixture();
    f.call.mockResolvedValue(new Blob([new Uint8Array([255, 255, 255])]));
    await expect(f.port.text('id', version, 1024)).rejects.toMatchObject({
      code: 'unsupported',
    });
    await expect(f.port.text('id', version, 1024)).rejects.toHaveProperty('cause');
    f.assertCurrent.mockImplementation(() => {
      throw new Error('owner changed');
    });
    const calls = f.call.mock.calls.length;
    await expect(f.port.text('id', version, 1024)).rejects.toThrow('owner changed');
    expect(f.call).toHaveBeenCalledTimes(calls);
  });
  it('下载先使用 HEAD，清理发送双版本 CAS', async () => {
    const f = fixture();
    f.call.mockResolvedValue(null);
    await f.port.download('id', version);
    expect(f.call).toHaveBeenCalledWith('/id/versions/1/content', {
      method: 'HEAD',
      responseType: 'blob',
    });
    const input = {
      expectedContentRevision: 2,
      expectedHistoryRevision: 1,
      mode: 'selected' as const,
      revisions: [1],
    };
    await f.port.remove('id', input);
    expect(f.call).toHaveBeenCalledWith('/id/versions', { method: 'DELETE', body: input });
  });
  it('拒绝重复版本、错误当前标识及矛盾空间统计', () => {
    const entry = {
      id: 'id',
      parentId: '',
      kind: 'file',
      name: 'current.txt',
      sizeBytes: 3,
      mediaType: 'text/plain',
      createdAt: 'x',
      updatedAt: 'x',
      trashedAt: null,
      contentRevision: 2,
    };
    const page = {
      entry,
      items: [version, { ...version, revision: 2, current: true }],
      page: 1,
      pageSize: 5,
      total: 2,
      contentRevision: 2,
      historyRevision: 1,
      historyEnabled: true,
      historyPreferences: { revision: 0, enabled: true, extensions: [], maxVersions: 0 },
      historyApplies: true,
      perFile: 20,
      perOwner: 1000,
      fileHistoryBytes: 3,
      ownerHistoryBytes: 3,
      ownerUsedBytes: 6,
      quotaBytes: 100,
      maxTextBytes: 1024,
      maxMediaBytes: 1024,
      pdfReader: {
        maxBytes: 1024,
        maxPages: 500,
        maxCanvasPixels: 4194304,
        maxImagePixels: 8388608,
        maxOutlineEntries: 500,
        maxOutlineDepth: 16,
        maxThumbnailPixels: 65536,
        maxThumbnailBytes: 524288,
        workTimeoutMs: 30000,
        workerReadyTimeoutMs: 10000,
      },
    };
    expect(fileVersionPageSchema.safeParse(page).success).toBe(true);
    for (const changed of [
      { ...page, items: [version, version] },
      { ...page, items: [{ ...version, current: true }] },
      { ...page, ownerUsedBytes: 2 },
    ])
      expect(fileVersionPageSchema.safeParse(changed).success).toBe(false);
  });
  it('并行内容按顺序读取，等待项取消不占传输通道', async () => {
    const f = fixture();
    let release: (value: unknown) => void = () => {};
    const gate = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    f.call.mockImplementationOnce(() => gate).mockResolvedValue(new Blob(['old']));
    const first = f.port.text('id', version, 1024);
    const controller = new AbortController();
    const canceled = f.port.text('id', version, 1024, controller.signal);
    const rejected = expect(canceled).rejects.toMatchObject({ code: 'canceled' });
    const third = f.port.text('id', version, 1024);
    await vi.waitFor(() => expect(f.call).toHaveBeenCalledTimes(1));
    controller.abort();
    release(new Blob(['old']));
    await expect(first).resolves.toBe('old');
    await rejected;
    await expect(third).resolves.toBe('old');
    expect(f.call).toHaveBeenCalledTimes(2);
  });
});
