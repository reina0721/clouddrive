import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSubtitle } from './subtitle-parser';
import { subtitleLimits, type SubtitleJob } from './subtitle-contract';

describe('字幕 Worker 生命周期', () => {
  const terminate = vi.fn();
  const postMessage = vi.fn();
  class ParserWorker extends EventTarget {
    postMessage = postMessage;
    terminate = terminate;
  }
  const job = (): SubtitleJob => ({ bytes: new ArrayBuffer(5), format: 'vtt' });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', ParserWorker);
    terminate.mockClear();
    postMessage.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('取消选中字幕时立即终止解析并移除超时等待', async () => {
    const controller = new AbortController();
    const input = job();
    const result = parseSubtitle(input, controller.signal);
    const checked = expect(result).rejects.toMatchObject({ code: 'canceled' });
    controller.abort();
    await checked;
    expect(postMessage).toHaveBeenCalledWith(input, [input.bytes]);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('无法完成解析时按预算终止 Worker', async () => {
    const controller = new AbortController();
    const result = parseSubtitle(job(), controller.signal);
    const checked = expect(result).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(subtitleLimits.parseTimeoutMs);
    await checked;
    controller.abort();
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
