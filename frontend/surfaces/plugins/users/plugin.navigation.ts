import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';
export const navigationContribution = {
  parents: [
    {
      navigationId: 'users.administration',
      labelKey: 'administration.adminActions',
      groupId: 'management',
      order: 45,
      iconId: 'identity',
      routeId: 'users.administration',
    },
    {
      navigationId: 'users.root',
      labelKey: 'users.nav',
      groupId: 'management',
      order: 0,
      iconId: 'users',
      routeId: 'users',
    },
  ],
} as const satisfies NavigationContribution;
