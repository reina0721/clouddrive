import { describe, it, expect, vi } from 'vitest';
import { createDocumentReader } from './document-reader';
import { type FileDocumentProps, FilesError } from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';
const bytes = '%PDF-test';
const props: FileDocumentProps = {
  entry: {
    id: 'pdf',
    name: 'read.pdf',
    mediaType: 'application/pdf',
    sizeBytes: bytes.length,
    contentRevision: 1,
  },
  limits: {
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
  closeRequestSequence: 0,
  onClose: () => {},
};
const entry = {
  ...props.entry,
  parentId: '',
  kind: 'file',
  createdAt: 'now',
  updatedAt: 'now',
  trashedAt: null,
};
function fixture() {
  const call = vi.fn<ReturnType<typeof createJsonClient>>(),
    version = vi.fn<Parameters<typeof createDocumentReader>[1]>(),
    assert = vi.fn();
  call.mockResolvedValue({ entry, historyRevision: 0 });
  return { call, version, assert, read: createDocumentReader(call, version, assert) };
}
describe('PDF本人内容读取边界', () => {
  it('当前内容前后版本围栏及流预算明确传入', async () => {
    const f = fixture();
    f.call
      .mockResolvedValueOnce({ entry, breadcrumbs: [] })
      .mockResolvedValueOnce(new Blob([bytes]))
      .mockResolvedValueOnce({ entry, breadcrumbs: [] });
    const result = await f.read(props, new AbortController().signal);
    expect(new TextDecoder().decode(result)).toBe(bytes);
    expect(f.call).toHaveBeenCalledTimes(3);
    expect(f.call.mock.calls[1]?.[1]).toMatchObject({
      maxBlobBytes: 1024,
      timeoutMs: 30000,
      responseType: 'blob',
    });
  });
  it('同长度覆盖后拒绝交付', async () => {
    const f = fixture();
    f.call
      .mockResolvedValueOnce({ entry, breadcrumbs: [] })
      .mockResolvedValueOnce(new Blob([bytes]))
      .mockResolvedValueOnce({ entry: { ...entry, contentRevision: 2 }, breadcrumbs: [] });
    await expect(f.read(props, new AbortController().signal)).rejects.toMatchObject({
      code: 'conflict',
    });
  });
  it('历史版本使用明确revision和相同预算', async () => {
    const f = fixture();
    f.version.mockResolvedValue(new Blob([bytes]));
    const signal = new AbortController().signal;
    await f.read({ ...props, version: 1 }, signal);
    expect(f.call).not.toHaveBeenCalled();
    expect(f.version).toHaveBeenCalledWith('pdf', 1, signal, {
      maxBlobBytes: 1024,
      timeoutMs: 30000,
    });
  });
  it('超额和取消在读取前终止', async () => {
    const f = fixture();
    await expect(
      f.read({ ...props, limits: { ...props.limits, maxBytes: 1 } }, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'large' });
    const c = new AbortController();
    c.abort();
    await expect(f.read(props, c.signal)).rejects.toMatchObject({ code: 'canceled' });
    expect(f.call).not.toHaveBeenCalled();
  });
  it('账号切换、错误签名及变化的长度不交付', async () => {
    for (const content of ['<html>xx', '%PDF-longer']) {
      const f = fixture();
      f.call
        .mockResolvedValueOnce({ entry, breadcrumbs: [] })
        .mockResolvedValueOnce(new Blob([content]));
      await expect(f.read(props, new AbortController().signal)).rejects.toBeInstanceOf(FilesError);
    }
    const f = fixture();
    f.assert.mockImplementation(() => {
      throw new FilesError('canceled');
    });
    await expect(f.read(props, new AbortController().signal)).rejects.toMatchObject({
      code: 'canceled',
    });
    expect(f.call).not.toHaveBeenCalled();
  });
});
