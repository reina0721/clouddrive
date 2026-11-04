import { File as NativeFile } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FilesError,
  publicShareSchema,
  readOnlySharePermissions,
  editorSharePermissions,
} from '@clouddrive/surface/files';
import { createPublicFilesRuntime } from './public-backend';
import { readPublicBlob } from './public-content';

const token = 's'.repeat(43),
  entry = {
    id: 'd25f5cc7-8a0d-4483-9764-7b70580a39fc',
    name: 'source.txt',
    kind: 'file' as const,
    sizeBytes: 3,
    mediaType: 'text/plain',
    updatedAt: '2026-11-04T00:00:00Z',
    contentRevision: 4,
  };
const metadata = {
  locked: false,
  root: { ...entry, kind: 'folder' },
  title: '公开链接',
  revision: 2,
  permissions: editorSharePermissions,
  limits: {
    maxFileBytes: 536870912,
    maxTextBytes: 1048576,
    maxPreviewBytes: 33554432,
    batchEntries: 20,
  },
  expiresAt: '2026-12-01T00:00:00Z',
};
const transfer = {
  id: '77ef740c-12da-4b91-a8ec-02a753710b47',
  name: entry.name,
  sizeBytes: 3,
  offsetBytes: 0,
  state: 'receiving',
  entryId: '',
  chunkBytes: 4,
  expiresAt: metadata.expiresAt,
  cleanupPending: false,
};
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.querySelectorAll('input[type=file]').forEach((input) => input.remove());
});

async function choose(runtime: ReturnType<typeof createPublicFilesRuntime>) {
  const pending = runtime.port.chooseUploads();
  const picker = document.querySelector<HTMLInputElement>('input[type=file]');
  if (!picker) throw new Error('缺少Host文件选择器');
  Object.defineProperty(picker, 'files', { value: [new NativeFile(['abc'], entry.name)] });
  picker.dispatchEvent(new Event('change'));
  const selected = await pending;
  const candidate = selected[0];
  if (!candidate) throw new Error('未返回上传候选');
  return candidate;
}
describe('分享Host的独立凭据、版本与上传生命周期', () => {
  it('锁定响应不得假装零预算，也不能夹带能力或根数据', () => {
    expect(
      publicShareSchema.safeParse({ locked: true, expiresAt: metadata.expiresAt }).success,
    ).toBe(true);
    expect(
      publicShareSchema.safeParse({ locked: true, root: entry, expiresAt: metadata.expiresAt })
        .success,
    ).toBe(false);
    expect(
      publicShareSchema.safeParse({ locked: false, root: entry, expiresAt: metadata.expiresAt })
        .success,
    ).toBe(false);
  });
  it('所有公开请求省略IAM凭据，并原样传递CAS而非自动重试', async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(json(entry)));
    vi.stubGlobal('fetch', fetcher);
    const runtime = createPublicFilesRuntime(token);
    await runtime.port.replaceText(entry, '新草稿');
    expect(fetcher).toHaveBeenCalledOnce();
    const options = fetcher.mock.calls[0]?.[1];
    expect(options?.credentials).toBe('omit');
    expect(options?.referrerPolicy).toBe('no-referrer');
    expect(JSON.parse(typeof options?.body === 'string' ? options.body : '')).toEqual({
      revision: 4,
      text: '新草稿',
    });
    runtime.dispose();
  });
  it('只读链接拒绝本地选择，不产生隐藏File候选', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json({ ...metadata, permissions: readOnlySharePermissions }))),
    );
    const runtime = createPublicFilesRuntime(token);
    await runtime.port.metadata();
    await expect(runtime.port.chooseUploads()).rejects.toMatchObject({ code: 'forbidden' });
    expect(document.querySelector('input[type=file]')).toBeNull();
    runtime.dispose();
  });
  it('按真实HEAD/PATCH偏移完成发布，候选随后释放', async () => {
    const fetcher = vi.fn((url: string, options?: RequestInit) => {
      if (url.endsWith('/transfers')) return Promise.resolve(json(transfer));
      if (options?.method === 'HEAD')
        return Promise.resolve(
          new Response(null, { headers: { 'Upload-Offset': '0', 'Tus-Resumable': '1.0.0' } }),
        );
      if (options?.method === 'PATCH')
        return Promise.resolve(
          new Response(null, {
            status: 204,
            headers: { 'Upload-Offset': '3', 'Tus-Resumable': '1.0.0' },
          }),
        );
      if (url.endsWith('/commit'))
        return Promise.resolve(
          json({ ...transfer, state: 'completed', entryId: entry.id, offsetBytes: 3 }),
        );
      return Promise.resolve(json(metadata));
    });
    vi.stubGlobal('fetch', fetcher);
    const runtime = createPublicFilesRuntime(token);
    await runtime.port.metadata();
    const candidate = await choose(runtime),
      progress = vi.fn();
    await runtime.port.upload(candidate, entry.id, progress, new AbortController().signal);
    expect(progress).toHaveBeenLastCalledWith({
      phase: 'completed',
      processedBytes: 3,
      totalBytes: 3,
    });
    const creation = fetcher.mock.calls.find(([url]) => url.endsWith('/transfers'))?.[1];
    expect(JSON.parse(typeof creation?.body === 'string' ? creation.body : '')).toMatchObject({
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      parentId: entry.id,
    });
    await expect(
      runtime.port.upload(candidate, entry.id, progress, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'invalid' });
    runtime.dispose();
  });
  it('取消清理已知候选并更换重试键，避免重试命中终止记录', async () => {
    const keys: string[] = [];
    let failed = true;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, options?: RequestInit) => {
        if (url.endsWith('/transfers')) {
          keys.push(
            (
              JSON.parse(typeof options?.body === 'string' ? options.body : '') as {
                clientKey: string;
              }
            ).clientKey,
          );
          return Promise.resolve(json(transfer));
        }
        if (url.endsWith('/cancel'))
          return Promise.resolve(json({ ...transfer, state: 'canceled' }));
        if (options?.method === 'HEAD')
          return Promise.resolve(new Response(null, { headers: { 'Upload-Offset': '0' } }));
        if (options?.method === 'PATCH') {
          if (failed) {
            failed = false;
            return Promise.resolve(new Response('', { status: 409 }));
          }
          return Promise.resolve(
            new Response(null, {
              status: 204,
              headers: { 'Upload-Offset': '3', 'Tus-Resumable': '1.0.0' },
            }),
          );
        }
        if (url.endsWith('/commit'))
          return Promise.resolve(
            json({ ...transfer, state: 'completed', entryId: entry.id, offsetBytes: 3 }),
          );
        return Promise.resolve(json(metadata));
      }),
    );
    const runtime = createPublicFilesRuntime(token);
    await runtime.port.metadata();
    const candidate = await choose(runtime);
    await expect(
      runtime.port.upload(candidate, entry.id, () => {}, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'conflict' });
    await runtime.port.upload(candidate, entry.id, () => {}, new AbortController().signal);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
    runtime.dispose();
  });
  it('最终响应丢失后以服务端完成回执恢复，不删除已发布文件', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, options?: RequestInit) => {
        if (url.endsWith('/transfers')) return Promise.resolve(json(transfer));
        if (url.endsWith('/cancel'))
          return Promise.resolve(
            json({ ...transfer, state: 'completed', entryId: entry.id, offsetBytes: 3 }),
          );
        if (options?.method === 'HEAD')
          return Promise.resolve(new Response(null, { headers: { 'Upload-Offset': '3' } }));
        if (url.endsWith('/commit')) return Promise.reject(new Error('模拟响应丢失'));
        return Promise.resolve(json(metadata));
      }),
    );
    const runtime = createPublicFilesRuntime(token);
    await runtime.port.metadata();
    const candidate = await choose(runtime),
      progress = vi.fn();
    await runtime.port.upload(candidate, entry.id, progress, new AbortController().signal);
    expect(progress).toHaveBeenLastCalledWith({
      phase: 'completed',
      processedBytes: 3,
      totalBytes: 3,
    });
    runtime.dispose();
  });
  it('退出会关闭选择器并拒绝之后的请求', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(metadata))),
    );
    const runtime = createPublicFilesRuntime(token);
    await runtime.port.metadata();
    const choosing = runtime.port.chooseUploads();
    runtime.dispose();
    await expect(choosing).rejects.toMatchObject({ code: 'canceled' });
    await expect(runtime.port.metadata()).rejects.toMatchObject({ code: 'canceled' });
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
});
describe('访客预览读取预算与流清理', () => {
  it('没有Content-Length时仍在读取期间拒绝超额', async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4));
        controller.enqueue(new Uint8Array(4));
      },
      cancel,
    });
    await expect(
      readPublicBlob(new Response(stream), 6, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'large' });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('保留读取和清理的两个错误', async () => {
    const primary = new FilesError('conflict'),
      cleanup = new Error('清理失败');
    const cancel = vi.fn(() => Promise.reject(cleanup)),
      releaseLock = vi.fn();
    const response = {
      headers: new Headers(),
      body: { getReader: () => ({ read: () => Promise.reject(primary), cancel, releaseLock }) },
    } as unknown as Response;
    let caught: unknown;
    try {
      await readPublicBlob(response, 6, new AbortController().signal);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(FilesError);
    if (!(caught instanceof FilesError)) throw new Error('缺少读取错误');
    expect(caught.code).toBe('conflict');
    expect(caught.cause).toBeInstanceOf(AggregateError);
    expect(releaseLock).toHaveBeenCalledOnce();
  });
});
