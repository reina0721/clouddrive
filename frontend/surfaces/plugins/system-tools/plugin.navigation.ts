import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * system-tools —— Sidebar Navigation Contribution。
 *
 * Group `development`（plugins 公共 Group Alias）下的 leaf Parent：原"系统工具"分组下的
 * preferences 已迁出为独立 settings 插件（107 单轨清理），此处收敛为单一入口
 * "Icon 大全"（/system-tools/icons），不保留旧入口/旧路由别名。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'system-tools.filesystem',
      labelKey: 'systemTools.nav.filesystem',
      groupId: 'administration',
      order: 44,
      iconId: 'resource',
      routeId: 'system-tools.filesystem',
    },
    {
      navigationId: 'system-tools.blobs',
      labelKey: 'systemTools.nav.blobs',
      groupId: 'administration',
      order: 47,
      iconId: 'resource',
      routeId: 'system-tools.blobs',
    },
    {
      navigationId: 'system-tools.files',
      labelKey: 'systemTools.nav.files',
      groupId: 'administration',
      order: 46,
      iconId: 'resource',
      routeId: 'system-tools.files',
    },
    {
      navigationId: 'system-tools.shares',
      labelKey: 'systemTools.nav.shares',
      groupId: 'administration',
      order: 48,
      iconId: 'resource',
      routeId: 'system-tools.shares',
    },
    {
      navigationId: 'system-tools.runtime',
      labelKey: 'administration.runtime',
      groupId: 'administration',
      order: 45,
      iconId: 'identity',
      routeId: 'system-tools.runtime',
    },
    {
      navigationId: 'system-tools.root',
      labelKey: 'systemTools.nav.icons',
      groupId: 'development',
      order: 40,
      iconId: 'icons',
      routeId: 'system-tools.icons',
    },
  ],
} as const satisfies NavigationContribution;
