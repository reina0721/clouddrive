import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { createJsonClient } from '../api/json-client';
import type * as JsonClientModule from '../api/json-client';
import { ApiError } from '../api/json-client';
import { createFilesRuntime } from './backend';

const { transport } = vi.hoisted(() => ({
  transport: vi.fn<ReturnType<typeof createJsonClient>>(),
}));
vi.mock('../api/json-client', async (original) => ({
  ...(await original<typeof JsonClientModule>()),
  createJsonClient: () => transport,
}));

describe('串行媒体读取的通道预算', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    transport.mockReset();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());
  const runtime = () => createFilesRuntime('/api', () => 'media-owner', vi.fn(), vi.fn());
  it('真实HTTP繁忙映射可恢复，不把429变成格式错误', async () => {
    const files = runtime(),
      blob = new Blob(['png']);
    transport.mockRejectedValueOnce(new ApiError('http', 429)).mockResolvedValue(blob);
    try {
      const reading = files.readMedia('first', 3, new AbortController().signal);
      await vi.runAllTimersAsync();
      expect(await reading).toBe(blob);
      expect(transport).toHaveBeenCalledTimes(2);
    } finally {
      await files.dispose();
    }
  });
  it('退避时继续占有媒体队列，不让后续读取形成重试风暴', async () => {
    const files = runtime(),
      blob = new Blob(['png']);
    transport.mockRejectedValueOnce(new ApiError('http', 429)).mockResolvedValue(blob);
    try {
      const reading = Promise.all([
        files.readMedia('first', 3, new AbortController().signal),
        files.readMedia('second', 3, new AbortController().signal),
      ]);
      await vi.runAllTimersAsync();
      await reading;
      expect(transport.mock.calls.map(([path]) => path)).toEqual([
        '/native/files/first/content',
        '/native/files/first/content',
        '/native/files/second/content',
      ]);
    } finally {
      await files.dispose();
    }
  });
  it('runtime销毁会取消媒体退避并释放定时器，不再发出旧请求', async () => {
    const files = runtime();
    transport.mockRejectedValue(new ApiError('http', 429));
    const reading = files.readMedia('first', 3, new AbortController().signal);
    const canceled = expect(reading).rejects.toMatchObject({ code: 'canceled' });
    await vi.advanceTimersByTimeAsync(0);
    expect(transport).toHaveBeenCalledTimes(2);
    await files.dispose();
    await canceled;
    await vi.runAllTimersAsync();
    expect(transport).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
