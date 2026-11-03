import { useState } from 'react';

import { moveChartPointFocus } from './focus';
import {
  CHART_PADDING,
  CHART_VIEW_HEIGHT,
  CHART_VIEW_WIDTH,
  buildAreaChartGeometry,
  chartFillClass,
  chartStrokeClass,
  chartSwatchClass,
  type ChartSeries,
} from './scale';

export type AreaChartProps = Readonly<{
  /** 图表可访问名称（也是隐藏数据表的 caption 前缀）。 */
  label: string;
  series: readonly ChartSeries[];
  /** 数值格式化（由调用方经 i18n 注入；缺省为原始数值文本）。 */
  formatValue?: (value: number) => string;
  /** x 轴/数据点标签格式化（例如日期）。 */
  formatX?: (x: number) => string;
  /** 额外的可访问摘要（拼进 role="img" 的 aria-label）。 */
  summary?: string;
}>;

const defaultFormatValue = (value: number): string =>
  Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '—';

const defaultFormatX = (x: number): string => String(x);

const TOOLTIP_HEIGHT = 26;
const TOOLTIP_CHAR_WIDTH = 6.6;
const TOOLTIP_PADDING = 16;

type ActivePoint = Readonly<{ seriesId: string; pointIndex: number }>;

/**
 * AreaChart —— 响应式 SVG 面积图（可访问、无动画）。
 *
 * 可访问语义：
 * - SVG 根是 `role="img"` + `aria-label`；数据点可聚焦（`tabindex`），
 *   左右方向键在数据点之间移动焦点，聚焦/悬停时显示 tooltip；
 * - 每个 series 附带一个 `sr-only` 语义表格（caption = label + series 名称），
 *   屏幕阅读器可直接读取完整数据；
 * - 颜色只通过 Design System 的 chart 语义 token（`fill-chart-*` / `stroke-chart-*`）
 *   表达，light/dark 跟随 tokens；没有任何动画，因此无需 reduced-motion 分支。
 */
export function AreaChart({
  label,
  series,
  formatValue = defaultFormatValue,
  formatX = defaultFormatX,
  summary,
}: AreaChartProps) {
  const [active, setActive] = useState<ActivePoint | null>(null);
  const geometry = buildAreaChartGeometry(series, {
    width: CHART_VIEW_WIDTH,
    height: CHART_VIEW_HEIGHT,
    padding: CHART_PADDING,
  });
  const accessibleLabel = summary ? `${label}. ${summary}` : label;
  const isActive = (seriesId: string, pointIndex: number): boolean =>
    active?.seriesId === seriesId && active.pointIndex === pointIndex;

  return (
    <figure className="grid min-w-0 gap-3">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="min-w-0">
        <svg
          aria-label={accessibleLabel}
          className="h-auto w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`0 0 ${CHART_VIEW_WIDTH} ${CHART_VIEW_HEIGHT}`}
        >
          <g aria-hidden="true">
            {geometry.yTicks.map((tick) => (
              <g key={`y-${tick.value}`}>
                <line
                  className="stroke-border"
                  strokeWidth={1}
                  x1={geometry.box.x}
                  x2={geometry.box.x + geometry.box.width}
                  y1={tick.y}
                  y2={tick.y}
                />
                <text
                  className="fill-ink-muted text-xs"
                  dominantBaseline="middle"
                  textAnchor="end"
                  x={geometry.box.x - 12}
                  y={tick.y}
                >
                  {formatValue(tick.value)}
                </text>
              </g>
            ))}
            {geometry.xTicks.map((tick) => (
              <text
                className="fill-ink-muted text-xs"
                key={`x-${tick.value}`}
                textAnchor="middle"
                x={tick.x}
                y={geometry.box.y + geometry.box.height + 22}
              >
                {formatX(tick.value)}
              </text>
            ))}
            <line
              className="stroke-border-strong"
              strokeWidth={1}
              x1={geometry.box.x}
              x2={geometry.box.x + geometry.box.width}
              y1={geometry.baselineY}
              y2={geometry.baselineY}
            />
          </g>

          {geometry.series.map((entry, seriesIndex) => (
            <g aria-hidden="true" key={entry.id}>
              <path
                className={`${chartFillClass(seriesIndex)} opacity-20`}
                d={entry.areaPath}
                fillRule="evenodd"
              />
              <path
                className={chartStrokeClass(seriesIndex)}
                d={entry.linePath}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </g>
          ))}

          {geometry.series.flatMap((entry, seriesIndex) =>
            entry.points.map((point, pointIndex) => {
              const activePoint = isActive(entry.id, pointIndex);
              const pointLabel = `${entry.label} · ${formatX(point.dataX)}: ${formatValue(point.dataY)}`;
              const tooltipWidth = Math.min(
                geometry.box.width,
                pointLabel.length * TOOLTIP_CHAR_WIDTH + TOOLTIP_PADDING,
              );
              const tooltipX = Math.min(
                Math.max(4, point.x - tooltipWidth / 2),
                CHART_VIEW_WIDTH - tooltipWidth - 4,
              );
              const tooltipY =
                point.y - TOOLTIP_HEIGHT - 12 < 4 ? point.y + 14 : point.y - TOOLTIP_HEIGHT - 12;
              return (
                <g key={`${entry.id}-${pointIndex}`}>
                  {activePoint ? (
                    <circle
                      aria-hidden="true"
                      className="fill-none stroke-focus-ring"
                      cx={point.x}
                      cy={point.y}
                      r={7}
                      strokeWidth={2}
                    />
                  ) : null}
                  <circle
                    aria-label={pointLabel}
                    className={`${chartFillClass(seriesIndex)} stroke-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring`}
                    cx={point.x}
                    cy={point.y}
                    data-chart-point=""
                    onBlur={() => setActive(null)}
                    onFocus={() => setActive({ seriesId: entry.id, pointIndex })}
                    onKeyDown={(event) =>
                      moveChartPointFocus(event, event.key === 'ArrowRight' ? 1 : -1)
                    }
                    onMouseEnter={() => setActive({ seriesId: entry.id, pointIndex })}
                    onMouseLeave={() => setActive(null)}
                    r={4}
                    role="img"
                    strokeWidth={2}
                    tabIndex={seriesIndex === 0 && pointIndex === 0 ? 0 : -1}
                  >
                    <title>{pointLabel}</title>
                  </circle>
                  {activePoint ? (
                    <g aria-hidden="true" className="pointer-events-none">
                      <rect
                        className="fill-surface stroke-border"
                        height={TOOLTIP_HEIGHT}
                        rx={6}
                        strokeWidth={1}
                        width={tooltipWidth}
                        x={tooltipX}
                        y={tooltipY}
                      />
                      <text
                        className="fill-ink text-xs"
                        dominantBaseline="middle"
                        x={tooltipX + TOOLTIP_PADDING / 2}
                        y={tooltipY + TOOLTIP_HEIGHT / 2}
                      >
                        {pointLabel}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            }),
          )}
        </svg>
      </div>

      {series.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-muted">
          {series.map((entry, seriesIndex) => (
            <li className="inline-flex items-center gap-2" key={entry.id}>
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${chartSwatchClass(seriesIndex)}`}
              />
              <span>{entry.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {series.map((entry) => (
        <div className="sr-only" key={`table-${entry.id}`}>
          <table>
            <caption>{`${label} — ${entry.label}`}</caption>
            <tbody>
              {entry.points.map((point) => (
                <tr key={`${entry.id}-row-${point.x}`}>
                  <th scope="row">{formatX(point.x)}</th>
                  <td>{formatValue(point.y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </figure>
  );
}
