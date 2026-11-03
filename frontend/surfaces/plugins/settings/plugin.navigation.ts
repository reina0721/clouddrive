import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * settings —— Sidebar Navigation Contribution。
 *
 * Group `system`（plugins 公共 Group Alias）下带 routeId 的 leaf Parent，
 * "个人偏好"入口的 routeId 指向 /settings（根 Route）。账户菜单（apps/web app-shell）在迁移后
 * 同步指向同一 Route Target。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'settings.root',
      labelKey: 'settingsNav.root',
      groupId: 'system',
      iconId: 'settings',
      routeId: 'settings',
    },
  ],
} as const satisfies NavigationContribution;
