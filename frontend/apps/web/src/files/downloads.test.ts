import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilesError, type OfflineDownload } from '@clouddrive/surface/files';
import { createDownloadsRuntime } from './downloads';

const task: OfflineDownload = {
  metadataLimited: false,
  id: 'd25f5cc7-8a0d-4483-9764-7b70580a39fc',
  clientKey: 'offline-host-fixture',
  kind: 'http',
  origin: 'https://source.example',
  name: 'saved.bin',
  parentId: '',
  destinationPath: '/',
  destinationAvailable: true,
  state: 'paused',
  failureCode: '',
  sourceStatus: 0,
  declaredBytes: 20,
  receivedBytes: 8,
  rateBytesPerSecond: 0,
  progressAt: null,
  resumable: true,
  attempts: 1,
  revision: 4,
  entryId: '',
  resultAvailable: false,
  cleanupPending: false,
  createdAt: '2026-11-04T00:00:00Z',
  updatedAt: '2026-11-04T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  expiresAt: '2026-11-05T00:00:00Z',
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('离线下载Host的账号与计时器生命周期', () => {
  it('隐藏页面不轮询，恢复可见时刷新，退出后清除全部订阅', () => {
    vi.useFakeTimers();
    const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('document', document);
    vi.stubGlobal('window', { setInterval, clearInterval });
    const runtime = createDownloadsRuntime(vi.fn(), () => {});
    const refresh = vi.fn();
    runtime.port.watch(refresh);
    vi.advanceTimersByTime(5000);
    expect(refresh).toHaveBeenCalledTimes(1);
    document.visibilityState = 'hidden';
    vi.advanceTimersByTime(20_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    document.visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(2);
    runtime.dispose();
    vi.advanceTimersByTime(20_000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('账号失效会停止轮询，重新激活不会恢复旧订阅', () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    vi.stubGlobal('window', { setInterval, clearInterval });
    let current = true;
    const runtime = createDownloadsRuntime(vi.fn(), () => {
      if (!current) throw new FilesError('canceled');
    });
    const refresh = vi.fn();
    runtime.port.watch(refresh);
    current = false;
    vi.advanceTimersByTime(5000);
    expect(refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    runtime.dispose();
    runtime.activate();
    current = true;
    vi.advanceTimersByTime(5000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('只有明确复制操作读取原始URL，读取期间账号变化时不写剪贴板', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    let resolveSource: (value: unknown) => void = () => {};
    const call = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveSource = resolve;
        }),
    );
    let current = true;
    const runtime = createDownloadsRuntime(call, () => {
      if (!current) throw new FilesError('canceled');
    });
    expect(call).not.toHaveBeenCalled();
    const copy = runtime.port.copySource(task);
    current = false;
    resolveSource({ uri: 'https://source.example/file?signature=private' });
    await expect(copy).rejects.toMatchObject({ code: 'canceled' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('操作携带用户读取的版本，销毁后不再请求旧账号', async () => {
    const call = vi.fn(() => Promise.resolve({ ...task, revision: 5 }));
    const runtime = createDownloadsRuntime(call, () => {});
    await runtime.port.command(task, 'resume');
    expect(call).toHaveBeenCalledWith('/downloads/' + task.id + '/resume', {
      method: 'POST',
      body: { revision: 4 },
    });
    runtime.dispose();
    await expect(runtime.port.command(task, 'cancel')).rejects.toMatchObject({ code: 'canceled' });
    expect(call).toHaveBeenCalledTimes(1);
  });
});
