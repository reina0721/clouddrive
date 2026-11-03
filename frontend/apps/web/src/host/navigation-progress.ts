import {
  createGlobalProgressController,
  type GlobalProgressController,
} from './global-progress-controller';
import { useGlobalProgressStore } from './global-progress-state';

/**
 * Host 导航生命周期（Router / Host 负责提供"开始、进行中、完成、取消"）。
 *
 * beginNavigation 在导航入口（Sidebar Link 点击、router.push/replace）调用；
 * completeNavigation 在 RouteTransition 检测到 pathname 提交时调用。
 * 本模块不猜测导航是否完成，也不依赖固定 setTimeout。
 *
 * 连续导航安全：新导航开始时先结束旧的（pendingCount 递减），再登记新的，
 * 因此快速连续点击不会让进度条错误结束或永久卡住。
 *
 * 本模块直接使用 store 模块单例（与 useShellStore 同模式，Host 基础设施）；
 * Global Progress Context 供未来业务 Feature 通过稳定 Contract 接入。
 */
const store = useGlobalProgressStore;
/** 当前导航会话对应的结束 handle；完成/失败/取消或新导航接管时清空。 */
let currentNavigationEnd: (() => void) | null = null;

/**
 * 供 Provider 装配使用的共享 Controller 实例：
 * GlobalProgressProvider 注入的 controller 与导航生命周期共用同一 store 单例，
 * 保证未来 Feature 与导航的 Global Pending 状态一致。
 */
export const globalProgressController: GlobalProgressController =
  createGlobalProgressController(store);

/** 导航入口调用：登记一次全局导航转换。 */
export function beginNavigation(label?: string) {
  // 连续导航：新导航接管，先结束上一次（若其完成信号迟到也不会重复计数）。
  currentNavigationEnd?.();
  currentNavigationEnd = globalProgressController.begin(label === undefined ? {} : { label }).done;
}

/** 导航完成信号：pathname 提交时调用。 */
export function completeNavigation() {
  currentNavigationEnd?.();
  currentNavigationEnd = null;
}

/** 导航取消信号：导航被中断/放弃（未提交）时调用，立即结束当前导航。 */
export function cancelNavigation() {
  currentNavigationEnd?.();
  currentNavigationEnd = null;
}

/** 导航失败信号：Error Boundary 捕获路由错误时调用，立即结束当前导航。 */
export function failNavigation() {
  currentNavigationEnd?.();
  currentNavigationEnd = null;
}
