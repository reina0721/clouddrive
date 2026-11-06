import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesError, type ServerTransfer } from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';
import { createTransferRuntime } from './transfer-runtime';

function publicationFixture(failures: number, code: 'busy' | 'conflict' = 'busy') {
  let owner = 'publication-owner';
  const transfer: ServerTransfer = {
    id: crypto.randomUUID(),
    clientKey: crypto.randomUUID(),
    parentId: '',
    destinationPath: '/',
    destinationAvailable: true,
    name: 'complete.txt',
    sizeBytes: 3,
    sizeKnown: true,
    source: 'tus',
    offsetBytes: 3,
    state: 'receiving',
    failureCode: '',
    entryId: '',
    createdAt: '',
    updatedAt: '',
    expiresAt: '',
    revision: 1,
    cleanupPending: false,
    expectedEntryId: '',
    expectedContentRevision: 0,
  };
  let commits = 0;
  const call = vi.fn<ReturnType<typeof createJsonClient>>((path) => {
    if (path.startsWith('/transfers?'))
      return Promise.resolve({
        items: [transfer],
        nextCursor: '',
        chunkBytes: 1024,
        maxFileBytes: 1024,
        maxQueueEntries: 10,
        concurrentUploads: 2,
      });
    if (path.endsWith('/commit')) {
      commits++;
      if (commits <= failures) return Promise.reject(new FilesError(code));
      return Promise.resolve({
        ...transfer,
        state: 'completed',
        entryId: crypto.randomUUID(),
        revision: 2,
      });
    }
    return Promise.resolve(transfer);
  });
  const runtime = createTransferRuntime({
    call,
    owner: () => owner,
    dataURL: (id) => '/unused/' + id,
    csrf: () => Promise.resolve('test-csrf'),
    takeSource: () => undefined,
    releaseSource: vi.fn(),
    resolveParent: (_candidate, parent) => Promise.resolve(parent),
    chooseSource: () => Promise.resolve(undefined),
  });
  return {
    runtime,
    transfer,
    commits: () => commits,
    changeOwner: () => {
      owner = 'other-owner';
    },
    call,
  };
}

describe('上传完成发布的有界繁忙恢复', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());
  it('已上传字节不重新上传，同一会话繁忙后完成且只发布一次回执', async () => {
    const fixture = publicationFixture(2);
    fixture.runtime.activate();
    try {
      await fixture.runtime.port.refresh();
      await fixture.runtime.port.resume(fixture.transfer.id);
      await vi.runAllTimersAsync();
      expect(fixture.commits()).toBe(3);
      expect(fixture.runtime.port.getSnapshot().items[0]).toMatchObject({
        phase: 'completed',
        confirmedBytes: 3,
      });
      expect(fixture.runtime.port.getSnapshot().completedRevision).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await fixture.runtime.dispose();
    }
  });
  it('预算耗尽保留失败，不无限重试', async () => {
    const fixture = publicationFixture(Infinity);
    fixture.runtime.activate();
    try {
      await fixture.runtime.port.refresh();
      await fixture.runtime.port.resume(fixture.transfer.id);
      await vi.runAllTimersAsync();
      expect(fixture.commits()).toBe(4);
      expect(fixture.runtime.port.getSnapshot().items[0]).toMatchObject({
        phase: 'failed',
        failure: 'busy',
      });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await fixture.runtime.dispose();
    }
  });
  it('版本冲突等业务失败不自动重试', async () => {
    const fixture = publicationFixture(1, 'conflict');
    fixture.runtime.activate();
    try {
      await fixture.runtime.port.refresh();
      await fixture.runtime.port.resume(fixture.transfer.id);
      await vi.runAllTimersAsync();
      expect(fixture.commits()).toBe(1);
      expect(fixture.runtime.port.getSnapshot().items[0]).toMatchObject({
        phase: 'failed',
        failure: 'conflict',
      });
    } finally {
      await fixture.runtime.dispose();
    }
  });
  it('等待期间销毁会取消后续请求并释放定时器', async () => {
    const fixture = publicationFixture(Infinity);
    fixture.runtime.activate();
    await fixture.runtime.port.refresh();
    await fixture.runtime.port.resume(fixture.transfer.id);
    await vi.advanceTimersByTimeAsync(0);
    expect(fixture.commits()).toBe(2);
    expect(vi.getTimerCount()).toBe(1);
    await fixture.runtime.dispose();
    await vi.runAllTimersAsync();
    expect(fixture.commits()).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('等待期间账号变化后不再提交或读取旧会话', async () => {
    const fixture = publicationFixture(Infinity);
    fixture.runtime.activate();
    try {
      await fixture.runtime.port.refresh();
      await fixture.runtime.port.resume(fixture.transfer.id);
      await vi.advanceTimersByTimeAsync(0);
      const calls = fixture.call.mock.calls.length;
      fixture.changeOwner();
      await vi.runAllTimersAsync();
      expect(fixture.call).toHaveBeenCalledTimes(calls);
      expect(fixture.commits()).toBe(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await fixture.runtime.dispose();
    }
  });
});
