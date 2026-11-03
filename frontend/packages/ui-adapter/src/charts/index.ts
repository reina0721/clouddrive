/**
 * Chart primitives（product-neutral，数据驱动）。
 *
 * 消费方式：`@clouddrive/ui-adapter/charts`（由 integrator 登记 package exports
 * 与 contract evidence；本目录不自带 package.json 变更）。
 *
 * 共同契约：
 * - 可访问：SVG `role="img"` + `aria-label`，数据点可聚焦（`tabindex` + 方向键），
 *   每个图表内置 `sr-only` 数据表（caption 来自 `label`）；
 * - 响应式：`viewBox` + `preserveAspectRatio` + `w-full`，无固定像素宽度；
 * - 无动画：不注册 keyframes/duration，reduced-motion 无需分支；
 * - 颜色：只消费 Design System 语义 chart token（`--color-chart-*` 的 utility class），
 *   不出现 hex/rgb，light/dark 由 tokens 决定。
 */
export { AreaChart, type AreaChartProps } from './area-chart';
export { BarChart, type BarChartProps } from './bar-chart';
export { DonutChart, type DonutChartProps } from './donut-chart';
export { Sparkline, type SparklineProps, type SparklineTone } from './sparkline';
export { moveChartPointFocus } from './focus';
export {
  CHART_PADDING,
  CHART_VIEW_HEIGHT,
  CHART_VIEW_WIDTH,
  DONUT_INNER_RADIUS,
  DONUT_OUTER_RADIUS,
  DONUT_VIEW_SIZE,
  SPARKLINE_VIEW_HEIGHT,
  SPARKLINE_VIEW_WIDTH,
  buildAreaChartGeometry,
  buildBarGeometry,
  buildDonutGeometry,
  buildSparklineGeometry,
  chartFillClass,
  chartStrokeClass,
  chartSwatchClass,
  createTicks,
  niceStep,
  normalizeDomain,
  resolveShare,
  scaleLinear,
  summarizeValues,
} from './scale';
export type {
  AreaChartGeometry,
  AreaChartOptions,
  AreaPointGeometry,
  AreaSeriesGeometry,
  BarGeometry,
  BarItemGeometry,
  BarOptions,
  ChartBarItem,
  ChartBox,
  ChartDomain,
  ChartPadding,
  ChartPoint,
  ChartSegment,
  ChartSeries,
  DonutGeometry,
  DonutOptions,
  DonutSliceGeometry,
  SparklineGeometry,
  SparklineOptions,
} from './scale';
