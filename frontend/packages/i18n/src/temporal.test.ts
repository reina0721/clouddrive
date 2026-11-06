import { describe, expect, it } from 'vitest';
import { instantWallTime, wallTimeInstant } from './temporal';
import {
  formatInstant,
  formatInstantDate,
  isSupportedTimeZone,
  resolveTimeZone,
  supportedTimeZones,
} from './format';

const region = {
  timeZone: 'America/New_York',
  dateFormat: 'YYYY-MM-DD',
  hourCycle: 'h24',
  showSeconds: true,
} as const;
describe('文件瞬间与壁钟时间的时区边界', () => {
  it('按瞬间所在时区跨日，并保留用户指定的日期顺序和秒', () => {
    const instant = '2026-03-05T00:08:42Z';
    expect(formatInstantDate(region, instant)).toBe('2026-03-04');
    expect(formatInstantDate({ ...region, dateFormat: 'DD/MM/YYYY' }, instant)).toBe('04/03/2026');
    expect(
      formatInstantDate({ ...region, dateFormat: 'MM/DD/YYYY', timeZone: 'Asia/Tokyo' }, instant),
    ).toBe('03/05/2026');
    expect(formatInstant('en', region, instant)).toBe('2026-03-04 · 19:08:42');
    expect(
      formatInstant('en', { ...region, hourCycle: 'h12', showSeconds: false }, instant),
    ).toMatch(/2026-03-04 · 07:08\s*PM/);
  });
  it('系统与UTC候选可用，保留有效别名，拒绝无效时区及数字偏移', () => {
    expect(isSupportedTimeZone('auto')).toBe(true);
    expect(isSupportedTimeZone('not/a-zone')).toBe(false);
    expect(isSupportedTimeZone('+05:30')).toBe(false);
    expect(resolveTimeZone('auto')).toBeTruthy();
    const zones = supportedTimeZones('Asia/Kolkata');
    expect(zones).toContain('Asia/Kolkata');
    expect(zones).toContain('UTC');
    expect(zones.length).toBeGreaterThan(100);
    expect(new Set(zones).size).toBe(zones.length);
  });
  it('非法时区或瞬间不静默返回当前日期', () => {
    expect(() => formatInstantDate(region, 'invalid')).toThrow(RangeError);
    expect(() => formatInstantDate({ ...region, timeZone: 'not/a-zone' }, Date.now())).toThrow(
      RangeError,
    );
  });
  it('把绝对时刻投影为明确时区的壁钟，再还原同一时刻', () => {
    const fields = instantWallTime('2026-03-05T00:08:00.000Z', 'Asia/Kathmandu');
    expect(fields).toMatchObject({ day: '2026-03-05', clock: '05:53' });
    expect(['Asia/Kathmandu', 'Asia/Katmandu']).toContain(fields.timeZone);
    expect(wallTimeInstant(fields, 'reject')).toEqual({
      ok: true,
      instant: '2026-03-05T00:08:00.000Z',
    });
  });
  it('拒绝春季不存在的时间，明确选早晚也不能绕过', () => {
    const fields = { day: '2026-03-08', clock: '02:30', timeZone: 'America/New_York' };
    for (const occurrence of ['reject', 'earlier', 'later'] as const)
      expect(wallTimeInstant(fields, occurrence)).toEqual({ ok: false, code: 'gap' });
  });
  it('重复时间必须选择，前后两次相差一小时', () => {
    const fields = { day: '2026-11-01', clock: '01:30', timeZone: 'America/New_York' };
    expect(wallTimeInstant(fields, 'reject')).toEqual({
      ok: false,
      code: 'overlap',
      earlier: '2026-11-01T05:30:00.000Z',
      later: '2026-11-01T06:30:00.000Z',
    });
    expect(wallTimeInstant(fields, 'earlier')).toEqual({
      ok: true,
      instant: '2026-11-01T05:30:00.000Z',
    });
    expect(wallTimeInstant(fields, 'later')).toEqual({
      ok: true,
      instant: '2026-11-01T06:30:00.000Z',
    });
  });
  it('支持半小时夏令时，不以固定一小时猜测重复时刻', () => {
    const fields = { day: '2026-04-05', clock: '01:45', timeZone: 'Australia/Lord_Howe' };
    const result = wallTimeInstant(fields, 'reject');
    expect(result.ok).toBe(false);
    if (result.ok || result.code !== 'overlap') throw new Error('未识别真实的半小时重复时刻');
    expect(Date.parse(result.later) - Date.parse(result.earlier)).toBe(30 * 60 * 1000);
  });
  it('拒绝日期滚动、非法分钟和未解析系统时区，不修正为另一天', () => {
    for (const day of ['2026-02-29', '2026-02-30', '2026-13-01'])
      expect(wallTimeInstant({ day, clock: '18:30', timeZone: 'UTC' }, 'reject')).toEqual({
        ok: false,
        code: 'invalid',
      });
    expect(
      wallTimeInstant({ day: '2028-02-29', clock: '18:30', timeZone: 'UTC' }, 'reject').ok,
    ).toBe(true);
    expect(
      wallTimeInstant({ day: '2026-03-05', clock: '18:60', timeZone: 'UTC' }, 'reject').ok,
    ).toBe(false);
    expect(
      wallTimeInstant({ day: '2026-03-05', clock: '18:30', timeZone: 'auto' }, 'reject'),
    ).toEqual({ ok: false, code: 'zone' });
  });
});
