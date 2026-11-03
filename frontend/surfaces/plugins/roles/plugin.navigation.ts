import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';
export const navigationContribution = {
  parents: [
    {
      navigationId: 'roles.catalog',
      labelKey: 'administration.permissions',
      groupId: 'management',
      order: 45,
      iconId: 'identity',
      routeId: 'roles.catalog',
    },
    {
      navigationId: 'roles.root',
      labelKey: 'roles.nav',
      groupId: 'management',
      order: 10,
      iconId: 'roles',
      routeId: 'roles',
    },
  ],
} as const satisfies NavigationContribution;
