import { useState } from 'react';

import { moveChartPointFocus } from './focus';
import {
  DONUT_VIEW_SIZE,
  buildDonutGeometry,
  chartFillClass,
  chartSwatchClass,
  type ChartSegment,
} from './scale';

export type DonutChartProps = Readonly<{
  /** 图表可访问名称（隐藏数据表 caption 前缀）。 */
  label: string;
  segments: readonly ChartSegment[];
  /** 数值格式化（调用方经 i18n 注入）。 */
  formatValue?: (value: number) => string;
  /** 占比格式化（默认 `(share * 100).toFixed(1)%`）。 */
  formatShare?: (share: number) => string;
}>;

const defaultFormatValue = (value: number): string =>
  Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '—';

const defaultFormatShare = (share: number): string =>
  Number.isFinite(share) ? `${(share * 100).toFixed(1)}%` : '—';

/**
 * DonutChart —— 响应式 SVG 环形图（可访问、无动画）。
 *
 * 扇区可聚焦（左右方向键移动），聚焦/悬停时中心文本切换为该扇区的占比与名称；
 * 图例同时给出百分比，`sr-only` 表格给出完整数值，屏幕阅读器无需依赖视觉扇区。
 * 颜色只通过 Design System 的 chart 语义 token 表达。
 */
export function DonutChart({
  label,
  segments,
  formatValue = defaultFormatValue,
  formatShare = defaultFormatShare,
}: DonutChartProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const geometry = buildDonutGeometry(segments);
  const activeSlice = geometry.slices.find((slice) => slice.id === activeId) ?? null;
  // roving tabindex：整个图表只占一个 Tab 停靠点，其余扇区用方向键到达。
  const firstFocusableId = geometry.slices.find((slice) => slice.path)?.id ?? null;
  const accessibleLabel = `${label}. ${geometry.slices
    .map((slice) => `${slice.label} ${formatShare(slice.share)}`)
    .join(', ')}`;

  return (
    <figure className="grid min-w-0 gap-4 sm:grid-cols-2 sm:items-center">
      <figcaption className="sr-only">{label}</figcaption>
      <div className="mx-auto w-full max-w-56">
        <svg
          aria-label={accessibleLabel}
          className="h-auto w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`0 0 ${DONUT_VIEW_SIZE} ${DONUT_VIEW_SIZE}`}
        >
          <circle
            aria-hidden="true"
            className="fill-none stroke-surface-muted"
            cx={geometry.cx}
            cy={geometry.cy}
            r={geometry.outerRadius}
            strokeWidth={geometry.outerRadius - geometry.innerRadius}
          />
          {geometry.slices.map((slice, index) => {
            if (!slice.path) return null;
            const sliceLabel = `${slice.label}: ${formatValue(slice.value)} (${formatShare(slice.share)})`;
            return (
              <path
                aria-label={sliceLabel}
                className={`${chartFillClass(index)} outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                  activeId === slice.id ? 'opacity-100' : 'opacity-90'
                }`}
                d={slice.path}
                data-chart-point=""
                fillRule="evenodd"
                key={slice.id}
                onBlur={() => setActiveId(null)}
                onFocus={() => setActiveId(slice.id)}
                onKeyDown={(event) =>
                  moveChartPointFocus(event, event.key === 'ArrowRight' ? 1 : -1)
                }
                onMouseEnter={() => setActiveId(slice.id)}
                onMouseLeave={() => setActiveId(null)}
                role="img"
                tabIndex={slice.id === firstFocusableId ? 0 : -1}
              >
                <title>{sliceLabel}</title>
              </path>
            );
          })}
          <g aria-hidden="true">
            <text
              className="fill-ink text-xl font-bold"
              dominantBaseline="middle"
              textAnchor="middle"
              x={geometry.cx}
              y={activeSlice ? geometry.cy - 8 : geometry.cy}
            >
              {activeSlice ? formatShare(activeSlice.share) : formatValue(geometry.total)}
            </text>
            {activeSlice ? (
              <text
                className="fill-ink-muted text-xs"
                dominantBaseline="middle"
                textAnchor="middle"
                x={geometry.cx}
                y={geometry.cy + 14}
              >
                {activeSlice.label}
              </text>
            ) : null}
          </g>
        </svg>
      </div>
      <ul className="grid min-w-0 gap-2 text-sm">
        {geometry.slices.map((slice, index) => (
          <li className="flex min-w-0 items-center gap-2" key={slice.id}>
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${chartSwatchClass(index)}`}
            />
            <span className="min-w-0 flex-1 truncate text-ink">{slice.label}</span>
            <span className="shrink-0 tabular-nums text-ink-muted">{formatShare(slice.share)}</span>
          </li>
        ))}
      </ul>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {geometry.slices.map((slice) => (
              <tr key={`row-${slice.id}`}>
                <th scope="row">{slice.label}</th>
                <td>{`${formatValue(slice.value)} (${formatShare(slice.share)})`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
