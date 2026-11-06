import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialShareExpiry, resolveShareExpiry } from './share-expiry';

describe('分享有效期的瞬间语义', () => {
  afterEach(() => vi.useRealTimers());
  it('保持原到期精度，草稿显示时区不重写原时刻', () => {
    const current = '2026-11-07T00:08:42.123Z';
    const draft = initialShareExpiry('America/New_York', current);
    expect(draft.day).toBe('2026-11-06');
    expect(draft.clock).toBe('19:08');
    expect(resolveShareExpiry(draft, current)).toEqual({ ok: true, value: current });
  });
  it('相对24小时跨夏令时仍为真实24小时，默认模式不擅自指定期限', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T17:00:00Z'));
    const draft = initialShareExpiry('America/New_York');
    expect(resolveShareExpiry(draft)).toEqual({ ok: true, value: undefined });
    expect(resolveShareExpiry({ ...draft, mode: '24' })).toEqual({
      ok: true,
      value: '2026-03-08T17:00:00.000Z',
    });
  });
  it('自定义期限导出实际瞬间，DST错误不输出空成功', () => {
    const draft = initialShareExpiry('America/New_York', '2026-11-01T05:30:00Z');
    expect(resolveShareExpiry({ ...draft, mode: 'custom' })).toMatchObject({
      ok: false,
      code: 'overlap',
    });
    expect(resolveShareExpiry({ ...draft, mode: 'custom', occurrence: 'later' })).toEqual({
      ok: true,
      value: '2026-11-01T06:30:00.000Z',
    });
    expect(
      resolveShareExpiry({ ...draft, mode: 'custom', day: '2026-03-08', clock: '02:30' }),
    ).toEqual({ ok: false, code: 'gap' });
  });
});
