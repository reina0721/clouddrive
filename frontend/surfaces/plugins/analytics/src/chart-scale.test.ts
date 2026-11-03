/**
 * Chart 尺度/几何计算的单元测试。
 *
 * ui-adapter 目前没有 vitest 配置（也没有 `chart.test.ts` 运行环境），因此按
 * VP-06 的约定把可测的纯数学留在 `packages/ui-adapter/src/charts/scale.ts`，
 * 并从插件测试经 charts 子路径消费/断言（`@clouddrive/ui-adapter/charts`
 * 由 integrator 在 package exports 中登记后解析）。
 */
import { describe, expect, it } from 'vitest';

import {
  CHART_PADDING,
  CHART_VIEW_HEIGHT,
  CHART_VIEW_WIDTH,
  buildAreaChartGeometry,
  buildBarGeometry,
  buildDonutGeometry,
  buildSparklineGeometry,
  chartFillClass,
  createTicks,
  normalizeDomain,
  resolveShare,
  summarizeValues,
  type ChartSeries,
} from '@clouddrive/ui-adapter/charts';

const SERIES: readonly ChartSeries[] = [
  {
    id: 'visits',
    label: 'Visits',
    points: [
      { x: 0, y: 10 },
      { x: 1, y: 20 },
      { x: 2, y: 5 },
      { x: 3, y: 40 },
    ],
  },
];

describe('chart scale primitives', () => {
  it('summarizeValues 对空序列给出稳定零值', () => {
    expect(summarizeValues([])).toEqual({
      min: 0,
      max: 0,
      total: 0,
      count: 0,
      first: 0,
      last: 0,
    });
    expect(summarizeValues([4, 12, 8])).toEqual({
      min: 4,
      max: 12,
      total: 24,
      count: 3,
      first: 4,
      last: 8,
    });
  });

  it('resolveShare 处理 0/负值/非法值并夹到 0…1', () => {
    expect(resolveShare(5, 10)).toBe(0.5);
    expect(resolveShare(20, 10)).toBe(1);
    expect(resolveShare(0, 10)).toBe(0);
    expect(resolveShare(-4, 10)).toBe(0);
    expect(resolveShare(5, 0)).toBe(0);
    expect(resolveShare(Number.NaN, 10)).toBe(0);
  });

  it('normalizeDomain 为零跨度给出可用区间', () => {
    expect(normalizeDomain(5, 5).max).toBeGreaterThan(normalizeDomain(5, 5).min);
    expect(normalizeDomain(Number.NaN, Number.NaN).max).toBeGreaterThan(0);
    expect(normalizeDomain(2, 9)).toEqual({ min: 2, max: 9 });
  });

  it('createTicks 覆盖 domain、递增且有限', () => {
    const ticks = createTicks({ min: 0, max: 40 }, 4);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(40);
    for (let index = 1; index < ticks.length; index += 1) {
      expect((ticks[index] ?? 0) - (ticks[index - 1] ?? 0)).toBeGreaterThan(0);
    }
    for (const tick of ticks) expect(Number.isFinite(tick)).toBe(true);
  });

  it('AreaChart 几何：坐标落在绘图区内、路径闭合且不含 NaN', () => {
    const geometry = buildAreaChartGeometry(SERIES);
    const box = geometry.box;
    expect(box.x).toBe(CHART_PADDING.left);
    expect(box.y).toBe(CHART_PADDING.top);
    expect(box.width).toBe(CHART_VIEW_WIDTH - CHART_PADDING.left - CHART_PADDING.right);
    expect(box.height).toBe(CHART_VIEW_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom);
    expect(geometry.domain.min).toBe(0);
    expect(geometry.domain.max).toBeGreaterThanOrEqual(40);

    const series = geometry.series[0];
    expect(series?.points).toHaveLength(4);
    for (const point of series?.points ?? []) {
      expect(point.x).toBeGreaterThanOrEqual(box.x);
      expect(point.x).toBeLessThanOrEqual(box.x + box.width);
      expect(point.y).toBeGreaterThanOrEqual(box.y);
      expect(point.y).toBeLessThanOrEqual(box.y + box.height);
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
    expect(series?.points[0]?.dataY).toBe(10);
    expect(series?.points[3]?.dataY).toBe(40);

    expect(series?.linePath.startsWith('M ')).toBe(true);
    expect(series?.linePath.match(/L /g)).toHaveLength(3);
    expect(series?.areaPath.endsWith('Z')).toBe(true);
    expect(series?.linePath).not.toContain('NaN');
    expect(series?.areaPath).not.toContain('NaN');

    expect(geometry.xTicks.map((tick) => tick.value)).toEqual([0, 1, 2, 3]);
    expect(geometry.yTicks[0]?.value).toBe(0);
  });

  it('AreaChart 几何：空数据仍有稳定坐标轴', () => {
    const geometry = buildAreaChartGeometry([], { yTickCount: 3 });
    expect(geometry.series).toEqual([]);
    expect(geometry.summary.count).toBe(0);
    expect(geometry.domain.max).toBeGreaterThan(0);
    expect(geometry.yTicks.length).toBeGreaterThanOrEqual(2);
    expect(geometry.xTicks).toEqual([]);
  });

  it('DonutChart 几何：占比归一、角度累计、扇区路径非空', () => {
    const geometry = buildDonutGeometry([
      { id: 'a', label: 'A', value: 50 },
      { id: 'b', label: 'B', value: 30 },
      { id: 'c', label: 'C', value: 20 },
    ]);
    expect(geometry.total).toBe(100);
    expect(geometry.slices.map((slice) => Math.round(slice.share * 100))).toEqual([50, 30, 20]);
    const first = geometry.slices[0];
    expect(first?.startAngle).toBeCloseTo(-Math.PI / 2, 10);
    for (const slice of geometry.slices) {
      expect(slice.path.startsWith('M ')).toBe(true);
      expect(slice.path).toContain('A ');
      expect(slice.path).not.toContain('NaN');
    }
    expect(geometry.slices[2]?.endAngle).toBeCloseTo(-Math.PI / 2 + Math.PI * 2, 10);
  });

  it('DonutChart 几何：单一 100% 扇区保持环形（内外两条子路径）', () => {
    const geometry = buildDonutGeometry([{ id: 'all', label: 'All', value: 7 }]);
    const path = geometry.slices[0]?.path ?? '';
    expect(path.match(/M /g)).toHaveLength(2);
    expect(geometry.slices[0]?.share).toBe(1);
  });

  it('BarChart 几何：宽度按最大值归一、行高与间距稳定', () => {
    const geometry = buildBarGeometry(
      [
        { id: 'a', label: 'A', value: 10 },
        { id: 'b', label: 'B', value: 20 },
        { id: 'c', label: 'C', value: 30 },
      ],
      { barWidth: 300, rowHeight: 20, gap: 10 },
    );
    expect(geometry.max).toBe(30);
    expect(geometry.total).toBe(60);
    expect(geometry.height).toBe(3 * 20 + 2 * 10);
    expect(geometry.items[0]?.width).toBeCloseTo(100, 6);
    expect(geometry.items[2]?.width).toBeCloseTo(300, 6);
    expect(geometry.items[1]?.y).toBe(30);
    expect(geometry.items[0]?.share).toBeCloseTo(1 / 3, 10);
  });

  it('Sparkline 几何：单值居中、多值归一、空序列返回空路径', () => {
    const multi = buildSparklineGeometry([1, 2, 3], { width: 100, height: 40, padding: 2 });
    expect(multi.points).toHaveLength(3);
    expect(multi.points[0]?.x).toBe(2);
    expect(multi.points[2]?.x).toBe(98);
    expect(multi.points[0]?.y).toBeGreaterThan(multi.points[2]?.y ?? 0);
    expect(multi.path.startsWith('M ')).toBe(true);
    expect(multi.path.match(/L /g)).toHaveLength(2);

    const single = buildSparklineGeometry([5], { width: 100, height: 40 });
    expect(single.points).toHaveLength(2);
    expect(single.points[0]).toEqual(single.points[1]);
    expect(single.min).toBe(5);
    expect(single.max).toBe(5);

    expect(buildSparklineGeometry([]).path).toBe('');
  });

  it('分类色板按语义 chart token 循环（越界/负数安全）', () => {
    expect(chartFillClass(0)).toBe('fill-chart-1');
    expect(chartFillClass(4)).toBe('fill-chart-5');
    expect(chartFillClass(5)).toBe('fill-chart-1');
    expect(chartFillClass(-1)).toBe('fill-chart-5');
    expect(chartFillClass(Number.NaN)).toBe('fill-chart-1');
  });
});
