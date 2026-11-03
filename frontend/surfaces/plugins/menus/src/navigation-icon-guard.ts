/**
 * menus —— Navigation icon vocabulary guard。
 *
 * iconId 是部署注册表声明的 opaque semantic id；这里用 Surface 的运行时映射做
 * 唯一合法性判断（不复制 vocabulary 列表）。集成方登记新 iconId 后自动生效；
 * 未登记的 id 不渲染图标，也不做静默 fallback。
 */
import { navigationIconComponents } from '@clouddrive/surface/icon-components';

export type KnownNavigationIconId = keyof typeof navigationIconComponents;

export function isKnownNavigationIconId(value: string): value is KnownNavigationIconId {
  return Object.hasOwn(navigationIconComponents, value);
}
