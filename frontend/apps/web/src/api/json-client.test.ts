import { describe, expect, it, vi } from 'vitest';
import { createJsonClient, ApiError } from './json-client';
describe('JSON 传输的 HEAD 与错误链', () => {
  it('HEAD 只请求一次，不获取 CSRF，不发送正文', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    await createJsonClient('/api', request)('/history', { method: 'HEAD', responseType: 'blob' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      '/api/history',
      expect.objectContaining({ method: 'HEAD', credentials: 'include', cache: 'no-store' }),
    );
    expect(request.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });
  it('网络错误保留原始原因，HTTP 错误保持状态', async () => {
    const cause = new Error('synthetic network failure');
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(cause)
      .mockResolvedValueOnce(new Response('{}', { status: 409 }));
    const call = createJsonClient('/api', request);
    await expect(call('/history')).rejects.toMatchObject({ code: 'network', cause });
    await expect(call('/history')).rejects.toBeInstanceOf(ApiError);
  });
});
