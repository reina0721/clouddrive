/**
 * Intl formatters（i18n Foundation 唯一 Intl 边界）。
 *
 * 日期、数字、单位和相对时间统一经本包格式化；Feature/Plugin 不直接创建
 * `Intl.*Format`。纯日期不因时区偏移（业务按 dateFormat 排版）；时刻显示按
 * 所选时区（'auto' = 本地）输出。
 */

export type HourCycleOption = 'h24' | 'h12';

export type TimeDisplayOptions = Readonly<{
  /** 'auto' = 系统时区；其余 = IANA 时区名。 */
  timeZone: string;
  hourCycle: HourCycleOption;
  /** 是否显示秒。 */
  showSeconds: boolean;
}>;

export type InstantDisplayOptions = TimeDisplayOptions &
  Readonly<{
    dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  }>;

/** isSupportedTimeZone 校验当前运行环境能否解析时区，不把无效值静默当UTC。 */
export function isSupportedTimeZone(timeZone: string): boolean {
  if (timeZone === 'auto') return true;
  if (!timeZone || /^[+-]/.test(timeZone)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

/** resolveTimeZone 在创建输入草稿时固定系统时区，避免稍后被重新解释。 */
export function resolveTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en', timeZone === 'auto' ? {} : { timeZone }).resolvedOptions()
    .timeZone;
}

/** supportedTimeZones 返回实际运行环境支持的候选，并保留有效的既有别名。 */
export function supportedTimeZones(current?: string): string[] {
  const zones = new Set(['UTC', ...Intl.supportedValuesOf('timeZone')]);
  if (current && current !== 'auto' && isSupportedTimeZone(current)) zones.add(current);
  return ['auto', ...[...zones].sort()];
}

/** formatInstantDate 先按时区求日历日期，再按用户顺序排版；不改变纯日期语义。 */
export function formatInstantDate(
  prefs: InstantDisplayOptions,
  value: Date | number | string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en', {
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(prefs.timeZone === 'auto' ? {} : { timeZone: prefs.timeZone }),
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const found = parts.find((item) => item.type === type)?.value;
    if (!found) throw new RangeError('Missing instant date component');
    return found;
  };
  const year = part('year').padStart(4, '0'),
    month = part('month'),
    day = part('day');
  if (prefs.dateFormat === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  if (prefs.dateFormat === 'DD/MM/YYYY') return `${day}/${month}/${year}`;
  return `${year}-${month}-${day}`;
}

export function formatInstant(
  locale: string,
  prefs: InstantDisplayOptions,
  value: Date | number | string,
): string {
  return formatInstantDate(prefs, value) + ' · ' + formatTimeOfDay(locale, prefs, value);
}

/** 时刻显示：timeZone + hourCycle + showSeconds → Intl.DateTimeFormat。 */
export function formatTimeOfDay(
  locale: string,
  prefs: TimeDisplayOptions,
  value: Date | number | string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...(prefs.showSeconds ? { second: '2-digit' as const } : {}),
    ...(prefs.hourCycle === 'h24' ? { hourCycle: 'h23' as const } : { hour12: true }),
    ...(prefs.timeZone !== 'auto' ? { timeZone: prefs.timeZone } : {}),
  };
  return new Intl.DateTimeFormat(locale, options).format(date);
}
