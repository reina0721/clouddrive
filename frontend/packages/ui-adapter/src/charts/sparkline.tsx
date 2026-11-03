import {
  SPARKLINE_VIEW_HEIGHT,
  SPARKLINE_VIEW_WIDTH,
  buildSparklineGeometry,
  summarizeValues,
} from './scale';

export type SparklineTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export type SparklineProps = Readonly<{
  /** 可访问名称（隐藏数据表 caption）。 */
  label: string;
  values: readonly number[];
  tone?: SparklineTone;
  /** 数值格式化（调用方经 i18n 注入；影响 aria-label 与隐藏表格）。 */
  formatValue?: (value: number) => string;
}>;

const toneClass: Record<SparklineTone, string> = {
  neutral: 'text-ink-muted',
  brand: 'text-brand',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

const defaultFormatValue = (value: number): string =>
  Number.isFinite(value) ? String(Math.round(value)) : '—';

/**
 * Sparkline —— KPI 卡片内的迷你趋势线（可访问、无动画）。
 *
 * 视觉是纯趋势提示，数值由 `sr-only` 表格承载；颜色跟随 semantic tone（currentColor），
 * 不引入新的色值。它刻意不是可聚焦的数据点集合：一张 KPI 卡片塞进几十个 tab 停靠点
 * 会破坏键盘浏览，逐点探索交给同一数据集的 AreaChart。
 */
export function Sparkline({
  label,
  values,
  tone = 'brand',
  formatValue = defaultFormatValue,
}: SparklineProps) {
  const geometry = buildSparklineGeometry(values, {
    width: SPARKLINE_VIEW_WIDTH,
    height: SPARKLINE_VIEW_HEIGHT,
  });
  const summary = summarizeValues(values);
  const accessibleLabel =
    values.length > 0
      ? `${label}: ${formatValue(summary.min)} – ${formatValue(summary.max)}`
      : label;

  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">{label}</figcaption>
      <svg
        aria-label={accessibleLabel}
        className={`h-auto w-full ${toneClass[tone]}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${SPARKLINE_VIEW_WIDTH} ${SPARKLINE_VIEW_HEIGHT}`}
      >
        <path
          aria-hidden="true"
          d={geometry.path}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {values.map((value, index) => (
              <tr key={`${label}-${index}`}>
                <th scope="row">{index + 1}</th>
                <td>{formatValue(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
