import { describe, it, expect } from 'vitest';
import { readBoundedBlob, BlobBodyError } from './blob-body';
describe('共享有界响应体', () => {
  it('按实际分块累计，忽略虚假的较小Content-Length', async () => {
    const response = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array(5));
          c.enqueue(new Uint8Array(5));
          c.close();
        },
      }),
      { headers: { 'Content-Length': '1' } },
    );
    await expect(readBoundedBlob(response, 8, new AbortController().signal)).rejects.toMatchObject({
      code: 'limit',
    });
  });
  it('保留主要错误和关闭错误', async () => {
    const primary = new Error('read'),
      cleanup = new Error('cancel');
    const response = {
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: () => Promise.reject(primary),
          cancel: () => Promise.reject(cleanup),
          releaseLock: () => {},
        }),
      },
    } as unknown as Response;
    try {
      await readBoundedBlob(response, 8, new AbortController().signal);
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BlobBodyError);
      expect((error as Error).cause).toBeInstanceOf(AggregateError);
      expect(((error as Error).cause as AggregateError).errors).toEqual([primary, cleanup]);
    }
  });
  it('成功只返回实际字节且取消请求拒绝', async () => {
    expect((await readBoundedBlob(new Response('abc'), 3, new AbortController().signal)).size).toBe(
      3,
    );
    const c = new AbortController();
    c.abort();
    await expect(readBoundedBlob(new Response('abc'), 3, c.signal)).rejects.toMatchObject({
      code: 'canceled',
    });
  });
});
