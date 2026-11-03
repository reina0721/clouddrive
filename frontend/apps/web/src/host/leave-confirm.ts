/**
 * Host —— 离开确认（Leave-confirm）统一接线（SET-005-001）。
 *
 * 页面经 `registerDirtySource` 上报 dirty/提交中 + 离开文案；Host 在任何应用内导航
 * （侧栏/命令菜单/标签/账户/文本链接/Port navigate）提交前统一询问，确认后才 proceed；
 * **取消不改变路由/标签/进度**；导航结果仍由既有导航事务层（navigation-lifecycle）
 * complete/cancel/fail 收敛——本模块只加前置询问。
 *
 * 刷新/关闭：仅当存在未提交输入（dirty）时注册 beforeunload（原生提示；接受平台限制，
 * 配合草稿恢复兜底，不承诺覆盖全部关闭场景）。
 */
import { shouldProceedWithNavigation, getCurrentResolvedHref } from './navigation-lifecycle';
import { parseResolvedHref, isResolvedNavigationEqual } from '@clouddrive/core';

/** 页面注册的 dirty source。 */
export type DirtySource = Readonly<{
  pageId: string;
  /** 离开文案（如"有未保存的更改"）。 */
  message: () => string;
  /** 当前是否 dirty（未提交输入）。 */
  isDirty: () => boolean;
  /** 是否提交中（提交中不额外询问；由调用方保证不重复提交）。 */
  isSubmitting?: () => boolean;
}>;

type Listener = () => void;

/** 模块级单例注册表（Host 基础设施；跨页面生命周期）。 */
const sources = new Map<string, DirtySource>();
const listeners = new Set<Listener>();

/** 注册 dirty source；返回取消注册函数。页面卸载必须调用（AGENTS §3.4 资源清理）。 */
export function registerDirtySource(source: DirtySource): () => void {
  sources.set(source.pageId, source);
  for (const listener of listeners) listener();
  return () => {
    sources.delete(source.pageId);
    for (const listener of listeners) listener();
  };
}

/** 是否存在任一 dirty source（未提交输入）。 */
export function isAnyDirty(): boolean {
  for (const source of sources.values()) {
    if (source.isSubmitting?.()) continue; // 提交中不视为待确认
    if (source.isDirty()) return true;
  }
  return false;
}

/** 当前最优先的离开文案（首个 dirty source 的 message；无则空串）。 */
export function dirtyMessage(): string {
  for (const source of sources.values()) {
    if (source.isSubmitting?.()) continue;
    if (source.isDirty()) return source.message();
  }
  return '';
}

/** 订阅 dirty 状态变化（Host LeaveConfirmationDialog 用）；返回取消函数。 */
export function subscribeDirty(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 测试辅助：清空注册表。 */
export function resetLeaveConfirmForTest(): void {
  sources.clear();
  listeners.clear();
}

/* ------------------------------------------------------------------ */
/* 前置询问（导航入口用）                                                */
/* ------------------------------------------------------------------ */

/** 由 Host 装配的确认 UI（对话框实现）注入的询问函数；默认 false（无 UI 时拒绝离开）。 */
let confirmResolver: ((message: string) => Promise<boolean>) | null = null;

/** Host 装配：注入真实确认实现（apps/web LeaveConfirmationDialog）。 */
export function setLeaveConfirmResolver(
  resolver: ((message: string) => Promise<boolean>) | null,
): void {
  confirmResolver = resolver;
}

/**
 * 导航前置统一询问（导航入口在 shouldProceedWithNavigation 前调用）：
 * - leave-confirm 全局偏好关闭（confirmLeave=false）→ 不询问直接 proceed；
 * - 无 dirty → 直接走 shouldProceedWithNavigation（no-op 短路 + begin）；
 * - 有 dirty → 先询问；确认通过才 proceed；取消 → false 且不 begin（路由/标签/进度不变）。
 */
export async function proceedAfterLeaveConfirm(
  targetHref: string,
  label?: string,
): Promise<boolean> {
  const current = getCurrentResolvedHref();
  if (
    current &&
    isResolvedNavigationEqual(parseResolvedHref(current), parseResolvedHref(targetHref))
  )
    return false;
  if (isLeaveConfirmEnabled()) {
    if (isAnyDirty()) {
      const message = dirtyMessage();
      const confirmed = confirmResolver ? await confirmResolver(message) : false;
      if (!confirmed) return false;
    }
  }
  return shouldProceedWithNavigation(targetHref, label);
}

/* ------------------------------------------------------------------ */
/* 全局偏好开关（confirmLeave：离开未保存内容时提醒）                     */
/* ------------------------------------------------------------------ */

/** 是否启用 leave-confirm 询问；由 Host 绑定 settings 操作偏好 confirmLeave（默认开）。 */
let leaveConfirmEnabled = true;

/** 读取当前开关。 */
export function isLeaveConfirmEnabled(): boolean {
  return leaveConfirmEnabled;
}

/** 设置开关（Host composition root 绑定 preferences.actionPreferences.confirmLeave）。 */
export function setLeaveConfirmEnabled(enabled: boolean): void {
  leaveConfirmEnabled = enabled;
}

/** 测试辅助：恢复默认（开）。 */
export function resetLeaveConfirmEnabledForTest(): void {
  leaveConfirmEnabled = true;
}

/* ------------------------------------------------------------------ */
/* beforeunload（仅 dirty 时注册原生提醒）                               */
/* ------------------------------------------------------------------ */

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!isAnyDirty()) return;
  event.preventDefault();
  // 现代浏览器需 returnValue 以显示原生离开确认。
  event.returnValue = '';
}

/** 安装 beforeunload 守卫；返回卸载函数。仅 dirty 时提示，接受平台限制。 */
export function installBeforeUnloadGuard(): () => void {
  window.addEventListener('beforeunload', onBeforeUnload);
  return () => window.removeEventListener('beforeunload', onBeforeUnload);
}
