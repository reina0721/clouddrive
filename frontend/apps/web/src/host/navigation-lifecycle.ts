import {
  parseResolvedHref,
  isResolvedNavigationEqual,
  type ResolvedLocation,
} from '@clouddrive/core';

import {
  beginNavigation,
  cancelNavigation,
  completeNavigation,
  failNavigation,
} from './navigation-progress';

/**
 * Host 导航生命周期事务层。
 *
 * 职责：把「点击意图」收敛为「真实导航事务」，统一做 no-op 短路与
 * begin → complete / cancel / fail 生命周期，保证任何路径都不遗留 pendingCount。
 *
 * 与 navigation-progress.ts 的分工：
 * - navigation-progress.ts 管理 Global Progress store 的 begin/complete/cancel/fail 原语
 *   （模块级单 handle，已测；begin 内部对新导航先结束旧 handle）。
 * - 本模块在其上做簿记：当前 resolved location 基线（lastCommittedHref）、
 *   活跃导航目标（activeTargetHref）、no-op 等价判断与 commit 收敛。
 *
 * 设计约束：
 * - 只比较「最终 resolved location」（pathname + search + hash），不比较 menuId/routeId。
 * - 同 resolved target 的点击视为 no-op：不 begin、不 push/replace、不启动 Progress。
 * - Router 不返回完成 promise；commit 由 RouteTransition 观测 location 变化后调用
 *   completeRouteNavigation 完成。
 * - 所有结束路径（complete/cancel/fail）幂等；连续导航由 navigation-progress 的
 *   begin-takeover 保证不叠加计数，本层只在确有活跃事务时做簿记清理。
 */

/** 模块级单例状态（与 navigation-progress.ts 同模式，Host 基础设施）。 */
let lastCommittedHref: string | null = null;
/** 当前活跃导航事务的目标 resolved href；null = 无进行中的客户端导航。 */
let activeTargetHref: string | null = null;

/** 读取当前已提交（commit 观测）的 resolved location href；未建立基线返回 null。 */
export function getCurrentResolvedHref(): string | null {
  return lastCommittedHref;
}

/** 供 RouteTransition 在首次挂载/每次 commit 时更新基线（入口不自行拼 location，避免多源漂移）。 */
export function commitResolvedHref(resolvedHref: string): void {
  lastCommittedHref = resolvedHref;
}

/** 测试/装配辅助：重置事务层状态（不在生产路径调用）。 */
export function resetNavigationLifecycle(): void {
  if (activeTargetHref !== null) cancelNavigation();
  activeTargetHref = null;
  lastCommittedHref = null;
}

/** 当前是否有进行中的客户端导航事务（诊断/测试）。 */
export function hasActiveNavigation(): boolean {
  return activeTargetHref !== null;
}

function isCurrentLocationEqualTo(targetHref: string): boolean {
  if (lastCommittedHref === null) return false;
  return isResolvedNavigationEqual(
    parseResolvedHref(targetHref),
    parseResolvedHref(lastCommittedHref),
  );
}

/**
 * 真实导航提交前的统一判定：
 * - 目标与当前 resolved location 等价 → 返回 false（no-op：调用方不得 push/replace/begin）。
 * - 不等价 → begin 新事务并记录目标，返回 true。
 *
 * navigation-progress.beginNavigation 内部会先结束旧 handle（新导航接管旧导航），
 * 因此这里不重复结束；activeTargetHref 只用于本层簿记与 commit 收敛判断。
 */
export function shouldProceedWithNavigation(targetHref: string, label?: string): boolean {
  if (isCurrentLocationEqualTo(targetHref)) return false;
  beginNavigation(label);
  activeTargetHref = targetHref;
  return true;
}

/** 取消当前活跃事务（被中断/放弃的导航），不遗留 pending。 */
export function cancelRouteNavigation(): void {
  if (activeTargetHref === null) return;
  cancelNavigation();
  activeTargetHref = null;
}

/** 渲染失败：立即结束活跃事务并触发失败收敛。 */
export function failRouteNavigation(): void {
  if (activeTargetHref === null) return;
  failNavigation();
  activeTargetHref = null;
}

/**
 * commit 观测：RouteTransition 在 resolved location（pathname/search/hash）变化时调用。
 * - 更新当前基线。
 * - 存在活跃事务则结束它（客户端导航已提交到某个 location，无论是否重定向/not-found）。
 * - 无活跃事务（浏览器后退/前进、地址栏、外部导航）只更新基线，不产生 pending。
 */
export function completeRouteNavigation(resolvedHref: string): void {
  lastCommittedHref = resolvedHref;
  if (activeTargetHref !== null) {
    completeNavigation();
    activeTargetHref = null;
  }
}

/** 供诊断/测试读取当前 resolved location 解析结果。 */
export function resolveCurrentLocation(): ResolvedLocation | null {
  return lastCommittedHref === null ? null : parseResolvedHref(lastCommittedHref);
}
