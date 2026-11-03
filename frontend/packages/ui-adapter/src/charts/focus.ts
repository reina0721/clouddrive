import type { KeyboardEvent } from 'react';

/**
 * Chart 数据点的键盘焦点移动（左右方向键在 [data-chart-point] 之间循环）。
 *
 * 纯 DOM focus 管理，不引入 roving tabindex 状态：每个数据点自身可聚焦，
 * 方向键只是把焦点移到相邻点。图表因此不需要额外键盘模型，也不伪造 button 语义。
 */
export function moveChartPointFocus(event: KeyboardEvent<SVGElement>, offset: number): void {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  const svg = event.currentTarget.ownerSVGElement;
  if (!svg) return;
  const points = [...svg.querySelectorAll<SVGElement>('[data-chart-point]')];
  const current = points.indexOf(event.currentTarget);
  if (current === -1 || points.length === 0) return;
  const next = points[(current + offset + points.length) % points.length];
  if (!next) return;
  event.preventDefault();
  next.focus();
}
