/**
 * Product Surface —— Navigation Icon Component Map（唯一 iconId → Lucide 映射）。
 *
 * 纯模块（非 React 组件文件）：供 Shell resolver 与 Icon 呈现组件消费。
 * key 用 vocabulary union 编译期强制完整。
 */

import {
  Accessibility,
  Bell,
  Boxes,
  Circle,
  CircleUserRound,
  Component,
  Contact,
  Globe,
  Keyboard,
  Layers3,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  Menu,
  MessageSquareWarning,
  MousePointerClick,
  Network,
  Palette,
  PanelsTopLeft,
  Activity,
  BookOpen,
  ScrollText,
  Settings2,
  Shapes,
  ShieldCheck,
  Orbit,
  Table2,
  TableProperties,
  Users,
  Waypoints,
  Webhook,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import type { NavigationIconId } from './navigation-icon';

/** 唯一 iconId → Icon Component 映射（lucide 单一来源）。 */
export const navigationIconComponents: Readonly<Record<NavigationIconId, LucideIcon>> = {
  dashboard: LayoutDashboard,
  foundations: Boxes,
  catalog: Component,
  action: MousePointerClick,
  feedback: MessageSquareWarning,
  async: LoaderCircle,
  identity: Contact,
  navigation: Waypoints,
  data: Table2,
  surfaces: PanelsTopLeft,
  list: ListChecks,
  overlay: Layers3,
  states: Workflow,
  settings: Settings2,
  icons: Shapes,
  motion: Orbit,
  resource: TableProperties,
  // 设置中心分类语义（SET-011）。
  palette: Palette,
  globe: Globe,
  accessibility: Accessibility,
  keyboard: Keyboard,
  // 业务管理插件独立导航语义
  users: Users,
  roles: ShieldCheck,
  audit: ScrollText,
  account: CircleUserRound,
  notifications: Bell,
  api: Webhook,
  analytics: Activity,
  workspace: LayoutGrid,
  menu: Menu,
  department: Network,
  dictionary: BookOpen,
};

/** 语义 iconId → Icon Component；未命中 → 统一 fallback（Circle）。 */
export function resolveIconComponent(iconId: NavigationIconId): LucideIcon {
  return navigationIconComponents[iconId] ?? Circle;
}
