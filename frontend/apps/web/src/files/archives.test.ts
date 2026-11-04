import { afterEach, describe, expect, it, vi } from 'vitest';
import type { createJsonClient } from '../api/json-client';
import { createArchivesRuntime } from './archives';
const access = { id: 'archive', expectedRevision: 3, password: 'public-fixture-password' };
const signal = new AbortController().signal;
function fixture() {
  const call = vi.fn<ReturnType<typeof createJsonClient>>();
  const assertCurrent = vi.fn();
  return { call, assertCurrent, ...createArchivesRuntime(call, assertCurrent) };
}
afterEach(() => vi.unstubAllGlobals());
describe('压缩成员Host资源边界', () => {
  it('文本按实际字节检查长度、预算、UTF8与二进制，密码只进入body', async () => {
    const f = fixture(),
      m = { path: 'docs/a.txt', kind: 'file' as const, sizeBytes: 3 };
    f.call.mockResolvedValue(new Blob(['abc']));
    await expect(f.port.text(access, m, 10, signal)).resolves.toBe('abc');
    expect(f.call).toHaveBeenCalledWith(
      '/archive/archive/member',
      expect.objectContaining({
        body: { expectedRevision: 3, password: access.password, path: m.path },
      }),
    );
    await expect(f.port.text(access, m, 2, signal)).rejects.toMatchObject({ code: 'large' });
    f.call.mockResolvedValue(new Blob(['long']));
    await expect(f.port.text(access, m, 10, signal)).rejects.toMatchObject({ code: 'conflict' });
    for (const bytes of [new Uint8Array([0, 1, 2]), new Uint8Array([255, 255, 255])]) {
      f.call.mockResolvedValue(new Blob([bytes]));
      await expect(f.port.text(access, m, 10, signal)).rejects.toMatchObject({
        code: 'unsupported',
      });
    }
  });
  it('已取消或账号切换不交付预览、不创建URL', async () => {
    const f = fixture(),
      m = { path: 'a.txt', kind: 'file' as const, sizeBytes: 3 };
    const controller = new AbortController();
    controller.abort();
    f.call.mockResolvedValue(new Blob(['abc']));
    await expect(f.port.text(access, m, 10, controller.signal)).rejects.toMatchObject({
      code: 'canceled',
    });
    f.assertCurrent.mockImplementation(() => {
      throw new Error('owner changed');
    });
    const count = f.call.mock.calls.length;
    await expect(f.port.text(access, m, 10, signal)).rejects.toThrow('owner changed');
    expect(f.call).toHaveBeenCalledTimes(count);
  });
  it('栅格签名后创建租约，关闭/运行域销毁各释放一次，拒绝SVG', async () => {
    const f = fixture();
    let next = 0;
    const createObjectURL = vi.fn(() => 'blob:archive-' + ++next),
      revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const content = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    f.call.mockResolvedValue(new Blob([content]));
    const m = { path: 'a.png', kind: 'file' as const, sizeBytes: 8 };
    const first = await f.port.image(access, m, 100, signal),
      second = await f.port.image(access, m, 100, signal);
    first.release();
    first.release();
    f.dispose();
    second.release();
    f.dispose();
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL.mock.calls).toEqual([['blob:archive-1'], ['blob:archive-2']]);
    const svg = '<svg/>';
    f.call.mockResolvedValue(new Blob([svg]));
    await expect(
      f.port.image(access, { ...m, sizeBytes: svg.length }, 100, signal),
    ).rejects.toMatchObject({ code: 'unsupported' });
    expect(createObjectURL).toHaveBeenCalledTimes(2);
  });
});
