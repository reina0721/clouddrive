/**
 * analytics —— 确定性 Mock 数据集（纯 TS，无渲染期随机）。
 *
 * 规则：
 * - 数据与渲染时间/时区无关：锚点日期固定（`ANALYTICS_ANCHOR_UTC`），seed 固定；
 * - 同一输入永远得到同一输出，因此测试可以断言具体数值与结构；
 * - 范围（7/30/90 天）只改变窗口切片与派生占比，不改变历史序列本身；
 * - 所有数值都是整数计数，展示层负责经 i18n 格式化。
 */

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const ANALYTICS_METRIC_IDS = ['users', 'visits', 'downloads', 'usage'] as const;
export type AnalyticsMetricId = (typeof ANALYTICS_METRIC_IDS)[number];

export type AnalyticsSeriesId = 'visits' | 'downloads' | 'uniqueVisitors';
export type AnalyticsSourceId = 'direct' | 'organic' | 'referral' | 'social';
export type AnalyticsDeviceId = 'desktop' | 'mobile' | 'tablet';

export type AnalyticsPoint = Readonly<{ x: number; y: number }>;

export type AnalyticsKpi = Readonly<{
  id: AnalyticsMetricId;
  /** 当前窗口合计。 */
  value: number;
  /** 上一等长窗口合计（delta 的比较基线）。 */
  previousValue: number;
  /** (value - previousValue) / previousValue；基线为 0 时为 0。 */
  deltaRatio: number;
  /** 全量历史（365 天）合计，即「总量」。 */
  lifetimeTotal: number;
  /** 当前窗口逐日序列（x = 当日 UTC epoch ms）。 */
  points: readonly AnalyticsPoint[];
}>;

export type AnalyticsSeries = Readonly<{
  id: AnalyticsSeriesId;
  points: readonly AnalyticsPoint[];
}>;

export type AnalyticsCount = Readonly<{
  id: AnalyticsSourceId | AnalyticsDeviceId;
  value: number;
}>;

export type AnalyticsPageRank = Readonly<{
  id: string;
  path: string;
  views: number;
  /** views / 当前窗口访问量（0…1）。 */
  share: number;
}>;

export type AnalyticsDataset = Readonly<{
  mode: 'mock';
  range: AnalyticsRange;
  isEmpty: boolean;
  window: Readonly<{ startMs: number; endMs: number; dayCount: number }>;
  kpis: readonly AnalyticsKpi[];
  traffic: readonly AnalyticsSeries[];
  visitors: readonly AnalyticsSeries[];
  sources: readonly AnalyticsCount[];
  devices: readonly AnalyticsCount[];
  pages: readonly AnalyticsPageRank[];
}>;

/** 历史窗口天数（固定 365 天，支撑 90 天窗口 + 90 天环比 + 总量）。 */
export const ANALYTICS_HISTORY_DAYS = 365;

/**
 * 数据集锚点：2026-03-31T12:00:00Z（固定日期，不受运行时间影响）。
 *
 * 取当日正午而非午夜，使所有常见时区下按本地日期格式化都不会跨到前一天/后一天。
 */
export const ANALYTICS_ANCHOR_UTC = Date.UTC(2026, 2, 31, 12);

const DAY_MS = 86_400_000;

/** 判断任意输入是否为受支持的演示范围（Toolbar / 测试共用）。 */
export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return ANALYTICS_RANGES.some((range) => range === value);
}

/** mulberry32 变体：确定性、无外部状态的伪随机序列。 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type MetricProfile = Readonly<{
  base: number;
  weeklyAmplitude: number;
  growth: number;
  seed: number;
}>;

const METRIC_PROFILES: Readonly<Record<AnalyticsMetricId, MetricProfile>> = {
  users: { base: 480, weeklyAmplitude: 0.14, growth: 0.24, seed: 0x51ed_0001 },
  visits: { base: 2600, weeklyAmplitude: 0.18, growth: 0.32, seed: 0x51ed_0002 },
  downloads: { base: 190, weeklyAmplitude: 0.22, growth: 0.4, seed: 0x51ed_0003 },
  usage: { base: 7200, weeklyAmplitude: 0.1, growth: 0.18, seed: 0x51ed_0004 },
};

function buildHistory(metric: AnalyticsMetricId): readonly number[] {
  const profile = METRIC_PROFILES[metric];
  const random = createRandom(profile.seed);
  const history: number[] = [];
  for (let index = 0; index < ANALYTICS_HISTORY_DAYS; index += 1) {
    const weekday = (index + 2) % 7;
    const weekly = 1 + profile.weeklyAmplitude * Math.sin((weekday / 7) * Math.PI * 2);
    const trend = 1 + (profile.growth * index) / ANALYTICS_HISTORY_DAYS;
    const noise = 0.86 + random() * 0.28;
    history.push(Math.max(0, Math.round(profile.base * weekly * trend * noise)));
  }
  return history;
}

/** 历史序列在模块初始化时计算一次（纯函数 + 固定 seed，跨调用稳定）。 */
const HISTORY: Readonly<Record<AnalyticsMetricId, readonly number[]>> = {
  users: buildHistory('users'),
  visits: buildHistory('visits'),
  downloads: buildHistory('downloads'),
  usage: buildHistory('usage'),
};

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function toPoints(values: readonly number[], startMs: number): readonly AnalyticsPoint[] {
  return values.map((value, index) => ({ x: startMs + index * DAY_MS, y: value }));
}

const PAGE_PATHS = [
  '/dashboard',
  '/users',
  '/roles',
  '/analytics',
  '/settings',
  '/audit-logs',
  '/notifications',
  '/workspace',
] as const;

const PAGE_WEIGHTS = [0.24, 0.19, 0.15, 0.12, 0.1, 0.08, 0.07, 0.05] as const;
const SOURCE_WEIGHTS = [0.42, 0.28, 0.18, 0.12] as const;
const SOURCE_IDS = ['direct', 'organic', 'referral', 'social'] as const;
const DEVICE_WEIGHTS = [0.58, 0.33, 0.09] as const;
const DEVICE_IDS = ['desktop', 'mobile', 'tablet'] as const;

export type AnalyticsDatasetInput = Readonly<{
  range: AnalyticsRange;
  /** true 时返回结构完整但无数据的数据集（Empty 状态演示）。 */
  empty?: boolean;
}>;

/**
 * 构建演示数据集。
 *
 * 同一 `{ range, empty }` 输入始终返回结构相同的值：窗口切片来自固定历史序列，
 * 来源/设备/页面的轻微扰动也来自固定 seed（seed 含 range，因此切换范围会重算）。
 */
export function buildAnalyticsDataset(input: AnalyticsDatasetInput): AnalyticsDataset {
  const { range } = input;
  const empty = input.empty ?? false;
  const dayCount = range;
  const endMs = ANALYTICS_ANCHOR_UTC;
  const startMs = endMs - (dayCount - 1) * DAY_MS;
  const windowInfo = { startMs, endMs, dayCount };

  if (empty) {
    return {
      mode: 'mock',
      range,
      isEmpty: true,
      window: windowInfo,
      kpis: ANALYTICS_METRIC_IDS.map((id) => ({
        id,
        value: 0,
        previousValue: 0,
        deltaRatio: 0,
        lifetimeTotal: 0,
        points: [],
      })),
      traffic: [],
      visitors: [],
      sources: [],
      devices: [],
      pages: [],
    };
  }

  const kpis: AnalyticsKpi[] = ANALYTICS_METRIC_IDS.map((id) => {
    const history = HISTORY[id];
    const current = history.slice(-dayCount);
    const previous = history.slice(-dayCount * 2, -dayCount);
    const value = sum(current);
    const previousValue = sum(previous);
    return {
      id,
      value,
      previousValue,
      deltaRatio: previousValue > 0 ? (value - previousValue) / previousValue : 0,
      lifetimeTotal: sum(history),
      points: toPoints(current, startMs),
    };
  });

  const visitsHistory = HISTORY.visits;
  const downloadsHistory = HISTORY.downloads;
  const currentVisits = visitsHistory.slice(-dayCount);
  const currentDownloads = downloadsHistory.slice(-dayCount);
  const uniqueVisitors = currentVisits.map((value) => Math.round(value * 0.42));
  const visitsTotal = sum(currentVisits);

  const random = createRandom(0xa11ce + range * 7919);
  const jitter = (): number => 0.94 + random() * 0.12;

  const sources: AnalyticsCount[] = SOURCE_IDS.map((id, index) => ({
    id,
    value: Math.max(1, Math.round(visitsTotal * (SOURCE_WEIGHTS[index] ?? 0) * jitter())),
  }));
  const devices: AnalyticsCount[] = DEVICE_IDS.map((id, index) => ({
    id,
    value: Math.max(1, Math.round(visitsTotal * (DEVICE_WEIGHTS[index] ?? 0) * jitter())),
  }));

  const pages: AnalyticsPageRank[] = PAGE_PATHS.map((path, index) => {
    const views = Math.max(1, Math.round(visitsTotal * (PAGE_WEIGHTS[index] ?? 0) * jitter()));
    return {
      id: `page-${index + 1}`,
      path,
      views,
      share: visitsTotal > 0 ? views / visitsTotal : 0,
    };
  })
    .sort((left, right) => right.views - left.views)
    .slice(0, 5);

  return {
    mode: 'mock',
    range,
    isEmpty: false,
    window: windowInfo,
    kpis,
    traffic: [
      { id: 'visits', points: toPoints(currentVisits, startMs) },
      { id: 'downloads', points: toPoints(currentDownloads, startMs) },
    ],
    visitors: [{ id: 'uniqueVisitors', points: toPoints(uniqueVisitors, startMs) }],
    sources,
    devices,
    pages,
  };
}
