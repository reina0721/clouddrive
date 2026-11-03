import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * reference-resources —— Sidebar Navigation Contribution。
 * Group `development`（plugins 公共 Group Alias）下单 Parent，routeId 指向列表 Route
 * （reference-resources 根 Route）。create/detail/edit 是隐藏 Route（不进 Sidebar），
 * 经 canonical 层级关联到本 Parent 的 activeNavigationId。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'reference-resources.root',
      labelKey: 'referenceResources.nav.root',
      groupId: 'development',
      order: 30,
      iconId: 'resource',
      routeId: 'reference-resources',
    },
  ],
} as const satisfies NavigationContribution;
