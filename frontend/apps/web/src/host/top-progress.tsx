'use client';

import { useEffect } from 'react';

import { useGlobalProgressStore } from './global-progress-state';

/** 从 CSS 变量读取时长（ms），供退出兜底使用；读取失败时回退到默认进度时长。 */
const progressDurationFallbackMs = 180;
function readCssMilliseconds(variableName: string, fallbackMs: number): number {
  if (typeof window === 'undefined') return fallbackMs;
  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  const match = raw.match(/([\d.]+)ms/);
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : fallbackMs;
}

/**
 * TopProgress —— 应用级顶部进度条（App Shell 单例，只做视觉表现）。
 *
 * 生命周期完全由 Global Progress State 驱动（Router / Host 提供 begin/end/fail/cancel），
 * 本组件不感知 Router、不监听 pathname、不用固定 setTimeout 猜测导航是否完成。
 *
 * 最小可见周期：每次 begin 都会渲染并最终进入 completing 视觉收尾，
 * 即使导航极快也保证用户看到一次完整的顶部进度过程（Enter → 推进 → 补满 → 淡出）。
 * 真实 Navigation 完成后页面立即渲染，进度条只继续完成自己的视觉动画，不阻塞任何交互。
 *
 * 视觉语义：
 * - pending（enter + active）：fill 从左侧持续向右延伸（indeterminate）。
 * - completing（complete + exit）：fill 快速补满 100%，随后容器淡出；
 *   退出动画结束后调用 exitComplete() 让 store 回到 idle 并卸载本组件。
 *   动画结束以 animationend 为主，CSS Token 时长的定时器仅作兜底（jsdom / 异常场景）。
 *
 * 布局：fixed 顶部、脱离文档流，不推动 Header/Sidebar/内容，不产生 Layout Shift。
 * 可访问性：纯装饰性反馈（无真实百分比），对辅助技术隐藏。
 */
export function TopProgress() {
  const phase = useGlobalProgressStore((state) => state.phase);
  const exitComplete = useGlobalProgressStore((state) => state.exitComplete);

  // 退出动画兜底：animationend 未触发（jsdom 等环境）时按 Token 时长强制收尾，
  // 保证进度条绝不永久停留。
  useEffect(() => {
    if (phase !== 'completing') return;
    const duration = readCssMilliseconds('--motion-duration-progress', progressDurationFallbackMs);
    const timeoutId = setTimeout(exitComplete, duration * 2 + 50);
    return () => clearTimeout(timeoutId);
  }, [phase, exitComplete]);

  if (phase === 'idle') return null;

  return (
    <div
      aria-hidden="true"
      className="top-progress fixed inset-x-0 top-0 z-toast h-progress-bar"
      data-phase={phase}
      onAnimationEnd={(event) => {
        if (event.animationName === 'progress-fade-out') exitComplete();
      }}
    >
      <div className="top-progress-fill bg-brand" />
    </div>
  );
}
