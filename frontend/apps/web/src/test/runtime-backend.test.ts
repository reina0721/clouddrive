import { describe, expect, it, vi } from 'vitest';
import { createRuntimePort } from '../administration/runtime-backend';

const metadata = () => Promise.resolve({ configuration: [], capabilities: [] });
const build = {
  version: 'dev',
  commit: 'unknown',
  buildTime: 'unknown',
  goVersion: 'go1.26.10',
  dirty: true,
};
function response(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('独立运行信息读取', () => {
  it('503 的合法 fail 是探针结果，其他 HTTP 错误、无效协议与矛盾结果保留失败语义', async () => {
    for (const [status, body, expected] of [
      [200, { status: 'pass' }, 'pass'],
      [503, { status: 'fail' }, 'fail'],
      [200, { status: 'fail' }, 'protocol'],
      [503, { status: 'pass' }, 'protocol'],
      [503, {}, 'protocol'],
      [403, { status: 'fail' }, 'forbidden'],
      [401, {}, 'unauthenticated'],
      [500, {}, 'unavailable'],
    ] as const) {
      const request = vi.fn<typeof fetch>(async () => response(body, status));
      const port = createRuntimePort(metadata, () => 'owner', request);
      if (expected === 'pass' || expected === 'fail')
        expect(await port.probe('readiness')).toEqual({ status: expected });
      else await expect(port.probe('readiness')).rejects.toMatchObject({ code: expected });
      expect(request).toHaveBeenCalledWith(
        '/management/readyz',
        expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
      );
    }
  });
  it('各读取使用实际 typed 端点，原始文本只由显式读取调用', async () => {
    const request = vi.fn<typeof fetch>(async (input) => {
      if (input === '/management/build') return response(build);
      if (input === '/management/metrics-summary')
        return response({
          items: [{ key: 'go_goroutines', value: 8, unit: 'count' }],
          asOf: '2026-11-11T12:00:00Z',
        });
      if (input === '/management/metrics') return new Response('# HELP sample\nsample 8\n');
      return response({ status: 'pass' });
    });
    const port = createRuntimePort(metadata, () => 'owner', request);
    expect(await port.build()).toEqual(build);
    expect((await port.metrics()).items[0]?.value).toBe(8);
    expect(await port.probe('liveness')).toEqual({ status: 'pass' });
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      '/management/build',
      '/management/metrics-summary',
      '/management/livez',
    ]);
    expect(await port.metricsText()).toContain('sample 8');
  });
  it('响应内容受限且须校验，错误不伪装为零值或空列表', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() =>
        response({ items: [{ key: 'x', value: '8', unit: 'count' }], asOf: 'invalid' }),
      )
      .mockResolvedValueOnce(new Response('{broken'))
      .mockResolvedValueOnce(new Response('x'.repeat(1024 * 1024 + 1)));
    const port = createRuntimePort(metadata, () => 'owner', request);
    await expect(port.metrics()).rejects.toMatchObject({ code: 'protocol' });
    await expect(port.diagnostics()).rejects.toMatchObject({ code: 'protocol' });
    await expect(port.metricsText()).rejects.toMatchObject({ code: 'limit' });
    await expect(
      createRuntimePort(() => Promise.resolve({ configuration: null })).metadata(),
    ).rejects.toMatchObject({ code: 'protocol' });
  });
  it('账号变化后不交付旧响应或旧错误，未登录不发送请求', async () => {
    let owner: string | null = null;
    const request = vi.fn<typeof fetch>();
    const port = createRuntimePort(metadata, () => owner, request);
    await expect(port.build()).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(request).not.toHaveBeenCalled();
    owner = 'first';
    request.mockImplementationOnce(async () => {
      owner = 'second';
      return response(build);
    });
    await expect(port.build()).rejects.toMatchObject({ code: 'unauthenticated' });
    request.mockImplementationOnce(async () => {
      owner = null;
      return response({}, 403);
    });
    await expect(port.build()).rejects.toMatchObject({ code: 'unauthenticated' });
  });
  it('调用方取消传到网络层，元数据也接收同一取消信号', async () => {
    const controller = new AbortController();
    const request = vi.fn<typeof fetch>((_input, init) => {
      expect(init?.signal).toBeDefined();
      controller.abort();
      expect(init?.signal?.aborted).toBe(true);
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
    const readMetadata = vi.fn(metadata);
    const port = createRuntimePort(readMetadata, () => 'owner', request);
    await expect(port.build(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const metadataSignal = new AbortController().signal;
    await port.metadata(metadataSignal);
    expect(readMetadata).toHaveBeenCalledWith(metadataSignal);
    await expect(port.probe('liveness', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
