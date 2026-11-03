/**
 * Chart 几何与尺度计算（纯函数）。
 *
 * 职责边界：
 * - 只做数据 → 坐标/路径/比例的确定性计算，不读 DOM、不依赖 React、不做 Intl 格式化；
 * - 颜色只通过 Design System 语义 chart 角色（`--color-chart-*`）的 utility class 引用，
 *   组件本身不声明 hex；
 * - viewBox 尺寸是 SVG 几何（不是 CSS 像素宽度），组件用 `w-full` + `preserveAspectRatio`
 *   响应式缩放，因此不出现固定像素宽度。
 *
 * 这些函数是 chart primitives 的可测试核心：unit test 只断言本文件的数学结果。
 */

export type ChartPoint = Readonly<{ x: number; y: number }>;

export type ChartSeries = Readonly<{
  id: string;
  label: string;
  points: readonly ChartPoint[];
}>;

export type ChartSegment = Readonly<{
  id: string;
  label: string;
  value: number;
}>;

export type ChartBarItem = ChartSegment;

export type ChartDomain = Readonly<{ min: number; max: number }>;

export type ChartBox = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type ChartPadding = Readonly<{
  top: number;
  right: number;
  bottom: number;
  left: number;
}>;

/** AreaChart / BarChart 的默认 viewBox 尺寸（响应式缩放，不是固定像素宽度）。 */
export const CHART_VIEW_WIDTH = 640;
export const CHART_VIEW_HEIGHT = 280;
export const CHART_PADDING: ChartPadding = { top: 20, right: 20, bottom: 40, left: 64 };

/** DonutChart 的默认 viewBox 尺寸。 */
export const DONUT_VIEW_SIZE = 200;
export const DONUT_OUTER_RADIUS = 92;
export const DONUT_INNER_RADIUS = 60;

/** Sparkline 的默认 viewBox 尺寸。 */
export const SPARKLINE_VIEW_WIDTH = 160;
export const SPARKLINE_VIEW_HEIGHT = 48;

/**
 * 分类色板（chart-1 … chart-5）。只暴露语义 utility class：
 * 具体色值由 Design System tokens（light/dark）决定，组件不感知 hex。
 */
const CHART_FILL_CLASSES = [
  'fill-chart-1',
  'fill-chart-2',
  'fill-chart-3',
  'fill-chart-4',
  'fill-chart-5',
] as const;
const CHART_STROKE_CLASSES = [
  'stroke-chart-1',
  'stroke-chart-2',
  'stroke-chart-3',
  'stroke-chart-4',
  'stroke-chart-5',
] as const;
const CHART_SWATCH_CLASSES = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
] as const;

function toneIndex(index: number): number {
  if (!Number.isFinite(index)) return 0;
  const normalized = Math.trunc(index) % CHART_FILL_CLASSES.length;
  return normalized < 0 ? normalized + CHART_FILL_CLASSES.length : normalized;
}

/** 第 index 条 series 的填充色 utility（超出色板长度时循环）。 */
export function chartFillClass(index: number): string {
  return CHART_FILL_CLASSES[toneIndex(index)] ?? 'fill-chart-1';
}

/** 第 index 条 series 的描边色 utility（超出色板长度时循环）。 */
export function chartStrokeClass(index: number): string {
  return CHART_STROKE_CLASSES[toneIndex(index)] ?? 'stroke-chart-1';
}

/** 第 index 条 series 的图例色块 utility（超出色板长度时循环）。 */
export function chartSwatchClass(index: number): string {
  return CHART_SWATCH_CLASSES[toneIndex(index)] ?? 'bg-chart-1';
}

function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** 归一化 domain：非法值回退、零跨度给出可用区间，避免 NaN 坐标与除零。 */
export function normalizeDomain(min: number, max: number): ChartDomain {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) ? max : 0;
  if (safeMax > safeMin) return { min: safeMin, max: safeMax };
  return { min: Math.min(safeMin, 0), max: Math.max(safeMax, 0) + 1 };
}

/** 从给定跨度推导「好看的」刻度步长（1/2/5 × 10^n）。 */
export function niceStep(span: number, targetTicks = 4): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const rough = span / Math.max(1, Math.trunc(targetTicks));
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

/** 生成覆盖 domain 的刻度值（含两端对齐到步长）。 */
export function createTicks(domain: ChartDomain, count = 4): readonly number[] {
  const normalized = normalizeDomain(domain.min, domain.max);
  const step = niceStep(normalized.max - normalized.min, count);
  const start = Math.floor(normalized.min / step) * step;
  const end = Math.ceil(normalized.max / step) * step;
  const ticks: number[] = [];
  const maxIterations = 64;
  for (let index = 0; index < maxIterations; index += 1) {
    const value = start + index * step;
    if (value > end + step / 2) break;
    ticks.push(roundTo(value, 6));
  }
  return ticks.length > 0 ? ticks : [roundTo(normalized.min, 6), roundTo(normalized.max, 6)];
}

/** 数值序列摘要（空序列给出稳定的 0 值，调用方无需额外判空）。 */
export function summarizeValues(values: readonly number[]): Readonly<{
  min: number;
  max: number;
  total: number;
  count: number;
  first: number;
  last: number;
}> {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 0, total: 0, count: 0, first: 0, last: 0 };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let total = 0;
  for (const value of finite) {
    min = Math.min(min, value);
    max = Math.max(max, value);
    total += value;
  }
  return {
    min,
    max,
    total,
    count: finite.length,
    first: finite[0] ?? 0,
    last: finite[finite.length - 1] ?? 0,
  };
}

/** 占比（0…1）；0/非法/负总数一律 0，避免 NaN 进入路径。 */
export function resolveShare(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0 || value <= 0) return 0;
  return Math.min(1, value / total);
}

/** 线性映射：domain → range。 */
export function scaleLinear(
  domain: ChartDomain,
  range: Readonly<{ min: number; max: number }>,
): (value: number) => number {
  const normalized = normalizeDomain(domain.min, domain.max);
  const span = normalized.max - normalized.min;
  return (value: number) => {
    const ratio = (clamp(value, normalized.min, normalized.max) - normalized.min) / span;
    return range.min + ratio * (range.max - range.min);
  };
}

export type AreaPointGeometry = Readonly<{
  x: number;
  y: number;
  dataX: number;
  dataY: number;
}>;

export type AreaSeriesGeometry = Readonly<{
  id: string;
  label: string;
  points: readonly AreaPointGeometry[];
  linePath: string;
  areaPath: string;
}>;

export type AreaChartGeometry = Readonly<{
  box: ChartBox;
  domain: ChartDomain;
  baselineY: number;
  yTicks: readonly Readonly<{ value: number; y: number }>[];
  xTicks: readonly Readonly<{ value: number; x: number }>[];
  series: readonly AreaSeriesGeometry[];
  summary: ReturnType<typeof summarizeValues>;
}>;

export type AreaChartOptions = Readonly<{
  width?: number;
  height?: number;
  padding?: ChartPadding;
  yTickCount?: number;
  xTickCount?: number;
}>;

function buildLinePath(points: readonly AreaPointGeometry[]): string {
  if (points.length === 0) return '';
  const [head, ...rest] = points;
  if (!head) return '';
  return [
    `M ${roundTo(head.x, 2)} ${roundTo(head.y, 2)}`,
    ...rest.map((point) => `L ${roundTo(point.x, 2)} ${roundTo(point.y, 2)}`),
  ].join(' ');
}

function buildAreaPath(points: readonly AreaPointGeometry[], baselineY: number): string {
  if (points.length === 0) return '';
  const head = points[0];
  const tail = points[points.length - 1];
  if (!head || !tail) return '';
  return [
    `M ${roundTo(head.x, 2)} ${roundTo(baselineY, 2)}`,
    ...points.map((point) => `L ${roundTo(point.x, 2)} ${roundTo(point.y, 2)}`),
    `L ${roundTo(tail.x, 2)} ${roundTo(baselineY, 2)}`,
    'Z',
  ].join(' ');
}

/**
 * AreaChart 几何：y 轴从 0 起（area 语义需要基线），x 轴取所有 series 的 dataX 并集。
 * 空 series 仍返回完整坐标轴（供空状态渲染，不产生 NaN）。
 */
export function buildAreaChartGeometry(
  series: readonly ChartSeries[],
  options: AreaChartOptions = {},
): AreaChartGeometry {
  const width = options.width ?? CHART_VIEW_WIDTH;
  const height = options.height ?? CHART_VIEW_HEIGHT;
  const padding = options.padding ?? CHART_PADDING;
  const yTickCount = options.yTickCount ?? 4;
  const xTickCount = options.xTickCount ?? 6;

  const box: ChartBox = {
    x: padding.left,
    y: padding.top,
    width: Math.max(1, width - padding.left - padding.right),
    height: Math.max(1, height - padding.top - padding.bottom),
  };

  const allPoints = series.flatMap((entry) => entry.points);
  const summary = summarizeValues(allPoints.map((point) => point.y));
  const rawMax = summary.max > 0 ? summary.max : 1;
  const step = niceStep(rawMax, yTickCount);
  const domain: ChartDomain = { min: 0, max: Math.max(step, Math.ceil(rawMax / step) * step) };
  const baselineY = box.y + box.height;

  const yScale = scaleLinear(domain, { min: baselineY, max: box.y });
  const yTicks = createTicks(domain, yTickCount)
    .filter((value) => value >= domain.min && value <= domain.max)
    .map((value) => ({ value, y: yScale(value) }));

  const dataXs = [...new Set(allPoints.map((point) => point.x))].sort(
    (left, right) => left - right,
  );
  const xMin = dataXs[0] ?? 0;
  const xMax = dataXs[dataXs.length - 1] ?? xMin + 1;
  const xScale = scaleLinear(normalizeDomain(xMin, xMax), { min: box.x, max: box.x + box.width });

  const tickTotal = Math.max(2, Math.min(Math.trunc(xTickCount), dataXs.length));
  const xTicks: { value: number; x: number }[] = [];
  if (dataXs.length > 0) {
    const seen = new Set<number>();
    for (let index = 0; index < tickTotal; index += 1) {
      const position =
        tickTotal === 1 ? 0 : Math.round((index * (dataXs.length - 1)) / (tickTotal - 1));
      const value = dataXs[position];
      if (value === undefined || seen.has(value)) continue;
      seen.add(value);
      xTicks.push({ value, x: xScale(value) });
    }
  }

  return {
    box,
    domain,
    baselineY,
    yTicks,
    xTicks,
    summary,
    series: series.map((entry) => {
      const points: AreaPointGeometry[] = entry.points.map((point) => ({
        x: xScale(point.x),
        y: yScale(point.y),
        dataX: point.x,
        dataY: point.y,
      }));
      return {
        id: entry.id,
        label: entry.label,
        points,
        linePath: buildLinePath(points),
        areaPath: buildAreaPath(points, baselineY),
      };
    }),
  };
}

export type DonutSliceGeometry = Readonly<{
  id: string;
  label: string;
  value: number;
  share: number;
  startAngle: number;
  endAngle: number;
  path: string;
}>;

export type DonutGeometry = Readonly<{
  total: number;
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  slices: readonly DonutSliceGeometry[];
}>;

export type DonutOptions = Readonly<{
  cx?: number;
  cy?: number;
  outerRadius?: number;
  innerRadius?: number;
}>;

function pointOnCircle(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): Readonly<{ x: number; y: number }> {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function fullRingPath(cx: number, cy: number, outer: number, inner: number): string {
  const outerRing = [
    `M ${roundTo(cx - outer, 2)} ${roundTo(cy, 2)}`,
    `A ${outer} ${outer} 0 1 1 ${roundTo(cx + outer, 2)} ${roundTo(cy, 2)}`,
    `A ${outer} ${outer} 0 1 1 ${roundTo(cx - outer, 2)} ${roundTo(cy, 2)}`,
    'Z',
  ].join(' ');
  const innerRing = [
    `M ${roundTo(cx - inner, 2)} ${roundTo(cy, 2)}`,
    `A ${inner} ${inner} 0 1 1 ${roundTo(cx + inner, 2)} ${roundTo(cy, 2)}`,
    `A ${inner} ${inner} 0 1 1 ${roundTo(cx - inner, 2)} ${roundTo(cy, 2)}`,
    'Z',
  ].join(' ');
  return `${outerRing} ${innerRing}`;
}

/** 环形扇区路径（外弧顺时针 + 内弧逆时针；调用方用 evenodd 填充规则）。 */
function annularSectorPath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startAngle: number,
  endAngle: number,
): string {
  if (!(endAngle - startAngle > 0.0001) || outer <= 0) return '';
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const outerStart = pointOnCircle(cx, cy, outer, startAngle);
  const outerEnd = pointOnCircle(cx, cy, outer, endAngle);
  const innerEnd = pointOnCircle(cx, cy, inner, endAngle);
  const innerStart = pointOnCircle(cx, cy, inner, startAngle);
  return [
    `M ${roundTo(outerStart.x, 2)} ${roundTo(outerStart.y, 2)}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${roundTo(outerEnd.x, 2)} ${roundTo(outerEnd.y, 2)}`,
    `L ${roundTo(innerEnd.x, 2)} ${roundTo(innerEnd.y, 2)}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${roundTo(innerStart.x, 2)} ${roundTo(innerStart.y, 2)}`,
    'Z',
  ].join(' ');
}

/** DonutChart 几何：从 12 点方向顺时针分配扇区，零/负值保持 0 占比。 */
export function buildDonutGeometry(
  segments: readonly ChartSegment[],
  options: DonutOptions = {},
): DonutGeometry {
  const size = DONUT_VIEW_SIZE;
  const cx = options.cx ?? size / 2;
  const cy = options.cy ?? size / 2;
  const outerRadius = options.outerRadius ?? DONUT_OUTER_RADIUS;
  const innerRadius = Math.min(options.innerRadius ?? DONUT_INNER_RADIUS, outerRadius - 1);
  const total = segments.reduce(
    (sum, segment) => (Number.isFinite(segment.value) ? sum + Math.max(0, segment.value) : sum),
    0,
  );
  const startAngle = -Math.PI / 2;
  const slices: DonutSliceGeometry[] = [];
  let cursor = startAngle;
  for (const segment of segments) {
    const value = Number.isFinite(segment.value) ? Math.max(0, segment.value) : 0;
    const share = resolveShare(value, total);
    const sweep = share * Math.PI * 2;
    const endAngle = cursor + sweep;
    const path =
      share >= 0.9999
        ? fullRingPath(cx, cy, outerRadius, innerRadius)
        : annularSectorPath(cx, cy, outerRadius, innerRadius, cursor, endAngle);
    slices.push({
      id: segment.id,
      label: segment.label,
      value,
      share,
      startAngle: cursor,
      endAngle,
      path,
    });
    cursor = endAngle;
  }
  return { total, cx, cy, outerRadius, innerRadius, slices };
}

export type BarItemGeometry = Readonly<{
  id: string;
  label: string;
  value: number;
  share: number;
  y: number;
  height: number;
  width: number;
}>;

export type BarGeometry = Readonly<{
  max: number;
  total: number;
  barWidth: number;
  rowHeight: number;
  gap: number;
  height: number;
  items: readonly BarItemGeometry[];
}>;

export type BarOptions = Readonly<{
  barWidth?: number;
  rowHeight?: number;
  gap?: number;
}>;

/** 横向条形图几何：宽度按最大值归一，行高/间距固定为几何参数。 */
export function buildBarGeometry(
  items: readonly ChartSegment[],
  options: BarOptions = {},
): BarGeometry {
  const barWidth = options.barWidth ?? 400;
  const rowHeight = options.rowHeight ?? 26;
  const gap = options.gap ?? 16;
  const values = items.map((item) => (Number.isFinite(item.value) ? Math.max(0, item.value) : 0));
  const rows = Math.max(1, items.length);
  const height = rows * rowHeight + Math.max(0, rows - 1) * gap;
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    max,
    total,
    barWidth,
    rowHeight,
    gap,
    height,
    items: items.map((item, index) => {
      const value = values[index] ?? 0;
      const share = resolveShare(value, max);
      return {
        id: item.id,
        label: item.label,
        value,
        share,
        y: index * (rowHeight + gap),
        height: rowHeight,
        width: roundTo(share * barWidth, 2),
      };
    }),
  };
}

export type SparklineGeometry = Readonly<{
  points: readonly ChartPoint[];
  path: string;
  min: number;
  max: number;
}>;

export type SparklineOptions = Readonly<{
  width?: number;
  height?: number;
  padding?: number;
}>;

/** Sparkline 几何：单值居中为水平线，多值线性归一；空序列返回空路径。 */
export function buildSparklineGeometry(
  values: readonly number[],
  options: SparklineOptions = {},
): SparklineGeometry {
  const width = options.width ?? SPARKLINE_VIEW_WIDTH;
  const height = options.height ?? SPARKLINE_VIEW_HEIGHT;
  const padding = options.padding ?? 2;
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { points: [], path: '', min: 0, max: 0 };
  const summary = summarizeValues(finite);
  const innerWidth = Math.max(1, width - padding * 2);
  const domain = normalizeDomain(summary.min, summary.max);
  const yScale = scaleLinear(domain, { min: height - padding, max: padding });
  const points: ChartPoint[] =
    finite.length === 1
      ? [
          { x: roundTo(width / 2, 2), y: roundTo(yScale(summary.max), 2) },
          { x: roundTo(width / 2, 2), y: roundTo(yScale(summary.max), 2) },
        ]
      : finite.map((value, index) => ({
          x: roundTo(padding + (index / (finite.length - 1)) * innerWidth, 2),
          y: roundTo(yScale(value), 2),
        }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  return { points, path, min: summary.min, max: summary.max };
}
