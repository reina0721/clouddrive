import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

export const navigationContribution = {
  parents: [
    {
      navigationId: 'dictionaries.root',
      labelKey: 'dictionaries.nav',
      groupId: 'administration',
      iconId: 'dictionary',
      routeId: 'dictionaries',
      order: 42,
    },
  ],
} as const satisfies NavigationContribution;
