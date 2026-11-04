import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesError } from '@clouddrive/surface/files';
import { createTransferRuntime } from './transfer-runtime';
import { hashFile } from './file-hash';

vi.mock('./file-hash', () => ({ hashFile: vi.fn() }));

function fixture(initialOwner = 'owner-one') {
  let owner = initialOwner;
  const call = vi.fn(() =>
    Promise.resolve({
      items: [],
      nextCursor: '',
      chunkBytes: 4 * 1024 * 1024,
      maxFileBytes: 512 * 1024 * 1024,
      maxQueueEntries: 500,
      concurrentUploads: 2,
    }),
  );
  const source = new File(['private bytes'], 'source.txt');
  const released = vi.fn();
  const runtime = createTransferRuntime({
    call,
    owner: () => owner,
    dataURL: (id) => '/api/console/v1/native/files/transfers/' + id + '/data',
    csrf: () => Promise.resolve('test-csrf'),
    takeSource: () => source,
    releaseSource: released,
    resolveParent: (_candidate, parent) => Promise.resolve(parent),
    chooseSource: () => Promise.resolve(source),
  });
  return {
    runtime,
    call,
    source,
    released,
    changeOwner: () => {
      owner = 'owner-two';
    },
  };
}

describe('持久传输的资源和身份边界', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(hashFile).mockImplementation(
      (_file, _chunk, signal) =>
        new Promise((_resolve, reject) => {
          const abort = () => reject(new FilesError('canceled'));
          if (signal.aborted) abort();
          else signal.addEventListener('abort', abort, { once: true });
        }),
    );
  });
  it('并发上限、批量暂停与继续、等待项取消和销毁都等待资源退出', async () => {
    const { runtime, source, released } = fixture();
    runtime.activate();
    const candidates = Array.from({ length: 3 }, (_, index) => ({
      id: crypto.randomUUID(),
      name: `source-${index}.txt`,
      sizeBytes: source.size,
    }));
    await runtime.port.enqueue(candidates, '');
    await vi.waitFor(() => expect(vi.mocked(hashFile)).toHaveBeenCalledTimes(2));
    expect(runtime.port.getSnapshot().items.map((item) => item.phase)).toEqual([
      'hashing',
      'hashing',
      'waiting',
    ]);
    expect(released).toHaveBeenCalledTimes(3);
    const descriptor = localStorage.getItem(localStorage.key(0)!);
    expect(descriptor).not.toContain('private bytes');
    expect(descriptor).not.toContain('test-csrf');
    await runtime.port.pauseAll();
    expect(
      runtime.port
        .getSnapshot()
        .items.every(
          (item) =>
            item.phase === 'paused' && item.bytesPerSecond === 0 && item.remainingSeconds === null,
        ),
    ).toBe(true);
    await runtime.port.cancel(candidates[2]!.id);
    expect(runtime.port.getSnapshot().items[2]?.phase).toBe('canceled');
    await runtime.port.resumeAll();
    await vi.waitFor(() => expect(vi.mocked(hashFile)).toHaveBeenCalledTimes(4));
    await runtime.dispose();
    expect(
      runtime.port
        .getSnapshot()
        .items.every((item) => item.phase === 'paused' || item.phase === 'canceled'),
    ).toBe(true);
  });
  it('账号变化后拒绝继续访问原队列，持久描述符不跨 owner 恢复', async () => {
    const { runtime, source, changeOwner, call } = fixture();
    runtime.activate();
    await runtime.port.enqueue(
      [{ id: crypto.randomUUID(), name: 'owner-private.txt', sizeBytes: source.size }],
      '',
    );
    const count = call.mock.calls.length;
    changeOwner();
    await expect(runtime.port.refresh()).rejects.toMatchObject({ code: 'canceled' });
    expect(call.mock.calls).toHaveLength(count);
    await runtime.dispose();
    const another = fixture('owner-two');
    another.runtime.activate();
    expect(another.runtime.port.getSnapshot().items).toHaveLength(0);
    await another.runtime.dispose();
  });
  it('上传新版本固定目标名称和 CAS，暂停后描述符保留目标，拒绝改投目录', async () => {
    const f = fixture();
    f.runtime.activate();
    const candidate = { id: crypto.randomUUID(), name: 'different.txt', sizeBytes: f.source.size };
    const target = {
      id: 'target',
      parentId: 'parent',
      kind: 'file' as const,
      name: 'existing.txt',
      sizeBytes: 3,
      mediaType: 'text/plain',
      createdAt: 'x',
      updatedAt: 'x',
      trashedAt: null,
      contentRevision: 7,
    };
    await f.runtime.port.replace(candidate, target);
    await vi.waitFor(() => expect(f.runtime.port.getSnapshot().items[0]?.phase).toBe('hashing'));
    expect(f.runtime.port.getSnapshot().items[0]).toMatchObject({
      name: 'existing.txt',
      replacementId: 'target',
      parentId: 'parent',
    });
    await f.runtime.port.pauseAll();
    const descriptor = localStorage.getItem(localStorage.key(0)!);
    expect(descriptor).toContain('"entryId":"target"');
    expect(descriptor).toContain('"contentRevision":7');
    await expect(
      f.runtime.port.retarget(candidate.id, 'elsewhere', 'other.txt'),
    ).rejects.toMatchObject({
      code: 'conflict',
    });
    await f.runtime.dispose();
    const restored = fixture();
    restored.runtime.activate();
    expect(restored.runtime.port.getSnapshot().items[0]).toMatchObject({ replacementId: 'target' });
    await restored.runtime.dispose();
  });
});
