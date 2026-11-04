import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';
export const navigationContribution = {
  parents: [
    {
      navigationId: 'files.root',
      labelKey: 'files.nav',
      groupId: 'overview',
      order: -10,
      iconId: 'resource',
      routeId: 'files',
    },
  ],
} as const satisfies NavigationContribution;
