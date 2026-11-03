import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * foundations —— Sidebar Navigation Contribution。
 *
 * Group `development`（plugins 公共 Group Alias）下带 routeId 的 Parent，
 * routeId 指向根 Route（/foundations）。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'foundations.root',
      labelKey: 'foundationsNav.root',
      groupId: 'development',
      order: 50,
      iconId: 'foundations',
      routeId: 'foundations',
    },
  ],
} as const satisfies NavigationContribution;
