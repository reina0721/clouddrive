import { useShellStore } from '../state/use-shell-store';

/**
 * 跳转后自动滚顶偏好（导航 → scrollToTopOnNavigate，默认开）的 Router 选项解析。
 *
 * - 开（默认）：交给 Next Router 默认行为（前进导航滚顶）——不传 scroll 选项；
 * - 关：传 `scroll: false` 保持当前滚动位置（普通前进导航按滚动偏好处理；
 *   锚点定位仍由浏览器原生处理）。
 *
 * 所有 Host 导航入口（navigation-port/app-shell/navigation-tree/router-text-link）
 * 统一经此解析，保证偏好一处收口。
 */
export function resolveScrollOption(): Readonly<{ scroll: false }> | undefined {
  const scrollToTop = useShellStore.getState().preferences.navigation.scrollToTopOnNavigate;
  return scrollToTop ? undefined : { scroll: false };
}
