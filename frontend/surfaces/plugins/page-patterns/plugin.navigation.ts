import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * page-patterns —— Sidebar Navigation Contribution。
 *
 * Group `development`（plugins 公共 Group Alias）下可展开 Parent + 5 个 Pattern Child。
 * Parent 无 routeId（纯 Disclosure，点击展开/收起）；Child 各指向静态 Route。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'page-patterns.root',
      labelKey: 'pagePatterns.nav.root',
      groupId: 'development',
      order: 10,
      iconId: 'catalog',
      children: [
        {
          navigationId: 'page-patterns.root.layout-navigation',
          labelKey: 'pagePatterns.nav.layoutNavigation',
          routeId: 'page-patterns.layout-navigation',
          order: 0,
        },
        {
          navigationId: 'page-patterns.root.collections-data',
          labelKey: 'pagePatterns.nav.collectionsData',
          routeId: 'page-patterns.collections-data',
          order: 1,
        },
        {
          navigationId: 'page-patterns.root.forms-actions',
          labelKey: 'pagePatterns.nav.formsActions',
          routeId: 'page-patterns.forms-actions',
          order: 2,
        },
        {
          navigationId: 'page-patterns.root.states-feedback',
          labelKey: 'pagePatterns.nav.statesFeedback',
          routeId: 'page-patterns.states-feedback',
          order: 3,
        },
        {
          navigationId: 'page-patterns.root.detail-settings',
          labelKey: 'pagePatterns.nav.detailSettings',
          routeId: 'page-patterns.detail-settings',
          order: 4,
        },
      ],
    },
  ],
} as const satisfies NavigationContribution;
