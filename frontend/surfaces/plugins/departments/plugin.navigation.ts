import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

export const navigationContribution = {
  parents: [
    {
      navigationId: 'departments.assignments',
      labelKey: 'administration.assignment',
      groupId: 'management',
      order: 45,
      iconId: 'identity',
      routeId: 'departments.assignments',
    },
    {
      navigationId: 'departments.positions',
      labelKey: 'administration.positions',
      groupId: 'management',
      order: 45,
      iconId: 'identity',
      routeId: 'departments.positions',
    },
    {
      navigationId: 'departments.root',
      labelKey: 'departments.nav',
      groupId: 'administration',
      iconId: 'department',
      routeId: 'departments',
      order: 41,
    },
  ],
} as const satisfies NavigationContribution;
