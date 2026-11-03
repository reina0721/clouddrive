import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';
export const navigationContribution = {
  parents: [
    {
      navigationId: 'audit.root',
      labelKey: 'audit.nav',
      groupId: 'administration',
      order: 20,
      iconId: 'audit',
      routeId: 'audit',
    },
  ],
} as const satisfies NavigationContribution;
