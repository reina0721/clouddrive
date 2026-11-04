import { describe, it, expect, vi, afterEach } from 'vitest';
import { PDFFrameSession, checkedOutline } from './session';
import { emptyPdfState, isPdfCommand, pdfProtocolVersion } from './protocol';
import type { PDFReaderLimits } from '@clouddrive/surface/files';
const limits: PDFReaderLimits = {
  maxBytes: 1024,
  maxPages: 500,
  maxCanvasPixels: 4194304,
  maxImagePixels: 8388608,
  maxOutlineEntries: 500,
  maxOutlineDepth: 16,
  maxThumbnailPixels: 65536,
  maxThumbnailBytes: 524288,
  workTimeoutMs: 30000,
  workerReadyTimeoutMs: 10000,
};
afterEach(() => vi.useRealTimers());
describe('PDF frame协议与生命周期', () => {
  it('只接受明确指令、有限比例和有界查询', () => {
    const base = { nonce: 'n', id: 1 };
    expect(isPdfCommand({ ...base, kind: 'scale', scale: 1 })).toBe(true);
    for (const invalid of [
      { kind: 'scale', scale: Infinity },
      { kind: 'page', page: 0 },
      { kind: 'find', query: 'a'.repeat(513) },
      { kind: 'script', value: 'execute' },
    ])
      expect(isPdfCommand({ ...base, ...invalid })).toBe(false);
  });
  it('大纲叶节点边界有效，拒绝超深、超数和未经校验的标题', () => {
    const leaf = { id: '1', title: 'Chapter', navigable: true, items: [] };
    expect(checkedOutline([leaf], { ...limits, maxOutlineDepth: 1 })).toEqual([leaf]);
    expect(() =>
      checkedOutline([{ ...leaf, items: [leaf] }], { ...limits, maxOutlineDepth: 1 }),
    ).toThrow();
    expect(() => checkedOutline([leaf, leaf], { ...limits, maxOutlineEntries: 1 })).toThrow();
    expect(() => checkedOutline([{ ...leaf, title: 'x'.repeat(4097) }], limits)).toThrow();
  });
  it('拒绝其他窗口/来源/旧nonce，关闭后拒绝迟到消息并移除frame内容', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const cb = {
      state: vi.fn(),
      ready: vi.fn(),
      password: vi.fn(),
      error: vi.fn(),
      close: vi.fn(),
    };
    const session = new PDFFrameSession(frame, limits, cb);
    const opened = session.open(new ArrayBuffer(5), 'zh-CN', 'light');
    const child = frame.contentWindow!;
    const post = vi.spyOn(child, 'postMessage').mockImplementation(() => {});
    const send = (data: unknown, origin = location.origin, source: MessageEventSource = child) =>
      window.dispatchEvent(new MessageEvent('message', { data, source, origin }));
    send({ kind: 'boot', version: pdfProtocolVersion });
    await opened;
    const payload = post.mock.calls[0]?.[0] as { nonce: string };
    const event = {
      kind: 'ready',
      nonce: payload.nonce,
      state: { ...emptyPdfState, pages: 1, rendered: true },
    };
    send(event, 'https://invalid.test');
    send({ ...event, nonce: 'stale' });
    send(event, location.origin, window);
    expect(cb.ready).not.toHaveBeenCalled();
    send(event);
    expect(cb.ready).toHaveBeenCalledOnce();
    session.forceClose();
    send(event);
    expect(cb.ready).toHaveBeenCalledOnce();
    expect(frame.getAttribute('src')).toBe('about:blank');
    await expect(session.command({ kind: 'save' })).rejects.toMatchObject({ code: 'canceled' });
    frame.remove();
  });
  it('Worker启动未完成时按预算终止，不接受假Worker降级', async () => {
    vi.useFakeTimers();
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const cb = {
      state: vi.fn(),
      ready: vi.fn(),
      password: vi.fn(),
      error: vi.fn(),
      close: vi.fn(),
    };
    const session = new PDFFrameSession(frame, limits, cb);
    const pending = session.open(new ArrayBuffer(5), 'en', 'light');
    await vi.advanceTimersByTimeAsync(limits.workerReadyTimeoutMs);
    await pending;
    expect(cb.error).toHaveBeenCalledWith(expect.objectContaining({ code: 'timeout' }));
    expect(frame.getAttribute('src')).toBe('about:blank');
    frame.remove();
  });
});
