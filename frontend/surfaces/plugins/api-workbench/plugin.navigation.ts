import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * api-workbench —— Sidebar Navigation Contribution.
 *
 * Group `development` under Developer Center.
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'api-workbench.root',
      labelKey: 'apiWorkbench.nav.title',
      groupId: 'development',
      order: 45,
      iconId: 'api',
      routeId: 'api-workbench',
    },
  ],
} as const satisfies NavigationContribution;
