import { describe, expect, it } from 'vitest';

import {
  ANALYTICS_ANCHOR_UTC,
  ANALYTICS_METRIC_IDS,
  ANALYTICS_RANGES,
  buildAnalyticsDataset,
  isAnalyticsRange,
} from './analytics-data';

const DAY_MS = 86_400_000;

describe('analytics demo dataset', () => {
  it('同一输入产生完全相同的输出（没有渲染期随机）', () => {
    expect(buildAnalyticsDataset({ range: 30 })).toEqual(buildAnalyticsDataset({ range: 30 }));
    expect(buildAnalyticsDataset({ range: 7, empty: true })).toEqual(
      buildAnalyticsDataset({ range: 7, empty: true }),
    );
  });

  it.each(ANALYTICS_RANGES)('范围 %i 天：窗口、KPI 序列与合计自洽', (range) => {
    const dataset = buildAnalyticsDataset({ range });

    expect(dataset.mode).toBe('mock');
    expect(dataset.range).toBe(range);
    expect(dataset.isEmpty).toBe(false);
    expect(dataset.window.dayCount).toBe(range);
    expect(dataset.window.endMs).toBe(ANALYTICS_ANCHOR_UTC);
    expect(dataset.window.startMs).toBe(ANALYTICS_ANCHOR_UTC - (range - 1) * DAY_MS);
    expect(dataset.kpis.map((kpi) => kpi.id)).toEqual([...ANALYTICS_METRIC_IDS]);

    for (const kpi of dataset.kpis) {
      const points = kpi.points;
      expect(points).toHaveLength(range);
      const first = points[0];
      const last = points[points.length - 1];
      expect(first?.x).toBe(dataset.window.startMs);
      expect(last?.x).toBe(dataset.window.endMs);
      for (let index = 1; index < points.length; index += 1) {
        const current = points[index];
        const previous = points[index - 1];
        expect((current?.x ?? 0) - (previous?.x ?? 0)).toBe(DAY_MS);
      }
      const summed = points.reduce((total, point) => total + point.y, 0);
      expect(kpi.value).toBe(summed);
      expect(kpi.value).toBeGreaterThan(0);
      expect(kpi.lifetimeTotal).toBeGreaterThan(kpi.value);
    }
  });

  it('环比使用上一等长窗口，deltaRatio 与两个窗口合计一致', () => {
    for (const range of ANALYTICS_RANGES) {
      const dataset = buildAnalyticsDataset({ range });
      for (const kpi of dataset.kpis) {
        expect(Number.isFinite(kpi.previousValue)).toBe(true);
        expect(kpi.previousValue).toBeGreaterThan(0);
        const expected =
          kpi.previousValue > 0 ? (kpi.value - kpi.previousValue) / kpi.previousValue : 0;
        expect(kpi.deltaRatio).toBeCloseTo(expected, 12);
      }
    }
  });

  it('范围越大，窗口累计访问量越大（同一历史序列的确定性切片）', () => {
    const visits = ANALYTICS_RANGES.map(
      (range) =>
        buildAnalyticsDataset({ range }).kpis.find((kpi) => kpi.id === 'visits')?.value ?? 0,
    );
    expect(visits[0]).toBeLessThan(visits[1] ?? 0);
    expect(visits[1]).toBeLessThan(visits[2] ?? 0);
  });

  it('来源 / 设备 / 页面占比都可从同一访问量推导', () => {
    const dataset = buildAnalyticsDataset({ range: 30 });
    const visits = dataset.kpis.find((kpi) => kpi.id === 'visits')?.value ?? 0;
    expect(dataset.sources).toHaveLength(4);
    expect(dataset.devices).toHaveLength(3);
    expect(dataset.pages).toHaveLength(5);

    for (const source of dataset.sources) expect(source.value).toBeGreaterThan(0);
    for (const device of dataset.devices) expect(device.value).toBeGreaterThan(0);

    const pages = [...dataset.pages].sort((left, right) => right.views - left.views);
    expect(pages).toEqual([...dataset.pages]);
    for (const page of dataset.pages) {
      expect(page.views).toBeGreaterThan(0);
      expect(page.share).toBeCloseTo(page.views / visits, 10);
    }

    const sourceTotal = dataset.sources.reduce((total, source) => total + source.value, 0);
    expect(sourceTotal).toBeGreaterThan(visits * 0.8);
    expect(sourceTotal).toBeLessThan(visits * 1.2);
  });

  it('空数据集保留结构并清空数据（Empty 状态可演示且可断言）', () => {
    const dataset = buildAnalyticsDataset({ range: 90, empty: true });
    expect(dataset.isEmpty).toBe(true);
    expect(dataset.window.dayCount).toBe(90);
    expect(dataset.kpis).toHaveLength(ANALYTICS_METRIC_IDS.length);
    for (const kpi of dataset.kpis) {
      expect(kpi.value).toBe(0);
      expect(kpi.points).toEqual([]);
      expect(kpi.deltaRatio).toBe(0);
      expect(kpi.lifetimeTotal).toBe(0);
    }
    expect(dataset.traffic).toEqual([]);
    expect(dataset.visitors).toEqual([]);
    expect(dataset.sources).toEqual([]);
    expect(dataset.devices).toEqual([]);
    expect(dataset.pages).toEqual([]);
  });

  it('趋势与访客序列和 KPI 使用同一窗口', () => {
    const dataset = buildAnalyticsDataset({ range: 7 });
    expect(dataset.traffic.map((series) => series.id)).toEqual(['visits', 'downloads']);
    expect(dataset.visitors.map((series) => series.id)).toEqual(['uniqueVisitors']);
    const visitsKpi = dataset.kpis.find((kpi) => kpi.id === 'visits');
    expect(dataset.traffic[0]?.points).toEqual(visitsKpi?.points ?? []);
    expect(dataset.visitors[0]?.points).toHaveLength(7);
  });

  it('isAnalyticsRange 只接受受控范围', () => {
    expect(isAnalyticsRange(7)).toBe(true);
    expect(isAnalyticsRange(30)).toBe(true);
    expect(isAnalyticsRange(90)).toBe(true);
    expect(isAnalyticsRange(14)).toBe(false);
    expect(isAnalyticsRange('30')).toBe(false);
    expect(isAnalyticsRange(null)).toBe(false);
  });
});
