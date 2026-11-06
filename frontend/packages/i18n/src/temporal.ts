import { parseAbsolute, parseDateTime, toCalendarDateTime, toZoned } from '@internationalized/date';
import { isSupportedTimeZone, resolveTimeZone } from './format';

export type TimeOccurrence = 'reject' | 'earlier' | 'later';
export type WallTime = Readonly<{ day: string; clock: string; timeZone: string }>;
export type WallTimeResult =
  | Readonly<{ ok: true; instant: string }>
  | Readonly<{ ok: false; code: 'invalid' | 'zone' | 'gap' }>
  | Readonly<{ ok: false; code: 'overlap'; earlier: string; later: string }>;

/** instantWallTime 只暴露日历字段和实际时区，不让第三方日期对象穿过边界。 */
export function instantWallTime(instant: string, timeZone: string): WallTime {
  const zone = resolveTimeZone(timeZone);
  const value = toCalendarDateTime(parseAbsolute(instant, zone)).toString();
  return { day: value.slice(0, 10), clock: value.slice(11, 16), timeZone: zone };
}

/** wallTimeInstant 拒绝DST跳过时间，重复时间必须明确选次；不自行计算UTC偏移。 */
export function wallTimeInstant(value: WallTime, occurrence: TimeOccurrence): WallTimeResult {
  if (!isSupportedTimeZone(value.timeZone) || value.timeZone === 'auto')
    return { ok: false, code: 'zone' };
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.clock))
    return { ok: false, code: 'invalid' };
  try {
    const local = parseDateTime(value.day + 'T' + value.clock);
    const earlier = toZoned(local, value.timeZone, 'earlier');
    const later = toZoned(local, value.timeZone, 'later');
    if (
      toCalendarDateTime(earlier).compare(local) !== 0 ||
      toCalendarDateTime(later).compare(local) !== 0
    )
      return { ok: false, code: 'gap' };
    const first = earlier.toAbsoluteString(),
      second = later.toAbsoluteString();
    if (first !== second && occurrence === 'reject')
      return { ok: false, code: 'overlap', earlier: first, later: second };
    return { ok: true, instant: occurrence === 'later' ? second : first };
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, code: 'invalid' };
    throw error;
  }
}
