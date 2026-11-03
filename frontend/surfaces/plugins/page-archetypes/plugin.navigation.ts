import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * page-archetypes —— Sidebar Navigation Contribution。
 *
 * Group `development`（plugins 公共 Group Alias）下可展开 Parent + 7 个页面 Child。
 * Parent 无 routeId（纯 Disclosure）；页面文案 reference 与 formReference namespace
 * 是跨 Plugin shared 词汇（ui-elements 亦消费），保留在 Host i18n resources，
 * 非本 Plugin 私有。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'page-archetypes.root',
      labelKey: 'pageArchetypes.nav.root',
      groupId: 'development',
      order: 20,
      iconId: 'resource',
      children: [
        {
          navigationId: 'page-archetypes.root.overview',
          labelKey: 'pageArchetypes.nav.overview',
          routeId: 'page-archetypes.overview',
          order: 0,
        },
        {
          navigationId: 'page-archetypes.root.resource-list',
          labelKey: 'pageArchetypes.nav.resourceList',
          routeId: 'page-archetypes.resource-list',
          order: 1,
        },
        {
          navigationId: 'page-archetypes.root.detail',
          labelKey: 'pageArchetypes.nav.detail',
          routeId: 'page-archetypes.detail',
          order: 2,
        },
        {
          navigationId: 'page-archetypes.root.create-edit',
          labelKey: 'pageArchetypes.nav.createEdit',
          routeId: 'page-archetypes.create-edit',
          order: 3,
        },
        {
          navigationId: 'page-archetypes.root.settings',
          labelKey: 'pageArchetypes.nav.settings',
          routeId: 'page-archetypes.settings',
          order: 4,
        },
        {
          navigationId: 'page-archetypes.root.master-detail',
          labelKey: 'pageArchetypes.nav.masterDetail',
          routeId: 'page-archetypes.master-detail',
          order: 5,
        },
        {
          navigationId: 'page-archetypes.root.operation',
          labelKey: 'pageArchetypes.nav.operation',
          routeId: 'page-archetypes.operation',
          order: 6,
        },
      ],
    },
  ],
} as const satisfies NavigationContribution;
