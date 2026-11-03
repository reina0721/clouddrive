import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * ui-elements —— Sidebar Navigation Contribution。
 *
 * Group `development`（plugins 公共 Group Alias）下可展开 Parent + 9 个 Family Child。
 * Parent 无 routeId（纯 Disclosure，点击展开/收起）；Child 各指向静态 Route。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'ui-elements.root',
      labelKey: 'uiElements.nav.root',
      groupId: 'development',
      order: 0,
      iconId: 'catalog',
      children: [
        {
          navigationId: 'ui-elements.root.actions-selection',
          labelKey: 'uiElements.nav.actionsSelection',
          routeId: 'ui-elements.actions-selection',
          iconId: 'action',
          order: 0,
        },
        {
          navigationId: 'ui-elements.root.feedback',
          labelKey: 'uiElements.nav.feedback',
          routeId: 'ui-elements.feedback',
          iconId: 'feedback',
          order: 1,
        },
        {
          navigationId: 'ui-elements.root.status-async',
          labelKey: 'uiElements.nav.statusAsync',
          routeId: 'ui-elements.status-async',
          iconId: 'async',
          order: 2,
        },
        {
          navigationId: 'ui-elements.root.identity-display',
          labelKey: 'uiElements.nav.identityDisplay',
          routeId: 'ui-elements.identity-display',
          iconId: 'identity',
          order: 3,
        },
        {
          navigationId: 'ui-elements.root.navigation',
          labelKey: 'uiElements.nav.navigation',
          routeId: 'ui-elements.navigation',
          iconId: 'navigation',
          order: 4,
        },
        {
          navigationId: 'ui-elements.root.data',
          labelKey: 'uiElements.nav.data',
          routeId: 'ui-elements.data',
          iconId: 'data',
          order: 5,
        },
        {
          navigationId: 'ui-elements.root.surfaces',
          labelKey: 'uiElements.nav.surfaces',
          routeId: 'ui-elements.surfaces',
          iconId: 'surfaces',
          order: 6,
        },
        {
          navigationId: 'ui-elements.root.forms',
          labelKey: 'uiElements.nav.forms',
          routeId: 'ui-elements.forms',
          iconId: 'list',
          order: 7,
        },
        {
          navigationId: 'ui-elements.root.overlays',
          labelKey: 'uiElements.nav.overlays',
          routeId: 'ui-elements.overlays',
          iconId: 'overlay',
          order: 8,
        },
      ],
    },
  ],
} as const satisfies NavigationContribution;
