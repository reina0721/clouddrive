import { useState } from 'react';

import { moveChartPointFocus } from './focus';
import { buildBarGeometry, chartFillClass, resolveShare, type ChartSegment } from './scale';

export type BarChartProps = Readonly<{
  /** 图表可访问名称（隐藏数据表 caption 前缀）。 */
  label: string;
  items: readonly ChartSegment[];
  /** 数值格式化（调用方经 i18n 注入）。 */
  formatValue?: (value: number) => string;
  /** 占比格式化（默认 `Math.round(share * 100)%`）。 */
  formatShare?: (share: number) => string;
}>;

const defaultFormatValue = (value: number): string =>
  Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '—';

const defaultFormatShare = (share: number): string =>
  Number.isFinite(share) ? `${Math.round(share * 100)}%` : '—';

const VIEW_WIDTH = 640;
const LABEL_COLUMN_WIDTH = 168;
const BAR_START = LABEL_COLUMN_WIDTH + 8;
const BAR_AREA_WIDTH = 340;
const SHARE_COLUMN_X = 580;
const VALUE_COLUMN_X = VIEW_WIDTH - 4;
const TOP_PADDING = 16;
const BOTTOM_PADDING = 8;

/**
 * BarChart —— 响应式 SVG 横向条形图（可访问、无动画）。
 *
 * 每条 bar 可聚焦（左右方向键移动），标签/数值始终可见；`sr-only` 表格给出完整数值。
 * 颜色只通过 Design System 的 chart 语义 token 表达。
 */
export function BarChart({
  label,
  items,
  formatValue = defaultFormatValue,
  formatShare = defaultFormatShare,
}: BarChartProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const geometry = buildBarGeometry(items, {
    barWidth: BAR_AREA_WIDTH,
    rowHeight: 26,
    gap: 16,
  });
  const viewHeight = Math.max(1, geometry.height + TOP_PADDING + BOTTOM_PADDING);
  const accessibleLabel = `${label}. ${geometry.items
    .map((item) => `${item.label} ${formatValue(item.value)}`)
    .join(', ')}`;

  return (
    <figure className="grid min-w-0 gap-3">
      <figcaption className="sr-only">{label}</figcaption>
      <svg
        aria-label={accessibleLabel}
        className="h-auto w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
      >
        {geometry.items.map((item, index) => {
          const y = TOP_PADDING + item.y;
          const centerY = y + item.height / 2;
          const share = resolveShare(item.value, geometry.total);
          const itemLabel = `${item.label}: ${formatValue(item.value)} (${formatShare(share)})`;
          return (
            <g key={item.id}>
              <text
                aria-hidden="true"
                className="fill-ink text-xs"
                dominantBaseline="middle"
                textAnchor="end"
                x={LABEL_COLUMN_WIDTH}
                y={centerY}
              >
                {item.label}
              </text>
              <rect
                aria-hidden="true"
                className="fill-surface-muted"
                height={item.height}
                rx={6}
                width={BAR_AREA_WIDTH}
                x={BAR_START}
                y={y}
              />
              <rect
                aria-label={itemLabel}
                className={`${chartFillClass(0)} stroke-focus-ring outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                  activeId === item.id ? 'opacity-100' : 'opacity-85'
                }`}
                data-chart-point=""
                height={item.height}
                onBlur={() => setActiveId(null)}
                onFocus={() => setActiveId(item.id)}
                onKeyDown={(event) =>
                  moveChartPointFocus(event, event.key === 'ArrowRight' ? 1 : -1)
                }
                onMouseEnter={() => setActiveId(item.id)}
                onMouseLeave={() => setActiveId(null)}
                role="img"
                rx={6}
                strokeWidth={activeId === item.id ? 2 : 0}
                tabIndex={index === 0 ? 0 : -1}
                width={Math.max(2, item.width)}
                x={BAR_START}
                y={y}
              >
                <title>{itemLabel}</title>
              </rect>
              <text
                aria-hidden="true"
                className="fill-ink-muted text-xs"
                dominantBaseline="middle"
                textAnchor="end"
                x={SHARE_COLUMN_X}
                y={centerY}
              >
                {formatShare(share)}
              </text>
              <text
                aria-hidden="true"
                className="fill-ink text-xs font-semibold"
                dominantBaseline="middle"
                textAnchor="end"
                x={VALUE_COLUMN_X}
                y={centerY}
              >
                {formatValue(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {geometry.items.map((item) => (
              <tr key={`row-${item.id}`}>
                <th scope="row">{item.label}</th>
                <td>{formatValue(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
