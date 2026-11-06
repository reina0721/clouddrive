import { describe, it, expect, vi } from 'vitest';
import { FilesError } from '@clouddrive/surface/files';
import { createHistoryPreferences } from './history-preferences';
import type { createJsonClient } from '../api/json-client';
const value = { revision: 2, enabled: true, extensions: ['txt'], maxVersions: 3 };
describe('服务器版本规则的账号与失败边界', () => {
  it('读取与保存使用独立CAS文档，不写本机视图', async () => {
    const call = vi.fn().mockResolvedValue(value);
    const current = vi.fn();
    const port = createHistoryPreferences(call as ReturnType<typeof createJsonClient>, current);
    expect(await port.loadHistoryPreferences()).toEqual(value);
    expect(call).toHaveBeenLastCalledWith('/preferences/history', {});
    expect(await port.saveHistoryPreferences(value)).toEqual(value);
    expect(call).toHaveBeenLastCalledWith('/preferences/history', { method: 'PUT', body: value });
    expect(current).toHaveBeenCalledTimes(4);
  });
  it('冲突与网络错误完整上抛，不以本机或默认规则伪造成功', async () => {
    const failure = new FilesError('conflict');
    const call = vi.fn().mockRejectedValue(failure);
    const port = createHistoryPreferences(call as ReturnType<typeof createJsonClient>, () => {});
    await expect(port.loadHistoryPreferences()).rejects.toBe(failure);
    await expect(port.saveHistoryPreferences(value)).rejects.toBe(failure);
  });
  it('响应后账号失效或取消不会交付旧账号规则', async () => {
    const controller = new AbortController();
    const call = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.resolve(value);
    });
    const port = createHistoryPreferences(call as ReturnType<typeof createJsonClient>, () => {});
    await expect(port.loadHistoryPreferences(controller.signal)).rejects.toMatchObject({
      code: 'canceled',
    });
    const invalid = createHistoryPreferences(
      vi.fn().mockResolvedValue(value) as ReturnType<typeof createJsonClient>,
      () => {
        throw new FilesError('canceled');
      },
    );
    await expect(invalid.saveHistoryPreferences(value)).rejects.toMatchObject({ code: 'canceled' });
  });
});
