import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';
export const navigationContribution = {
  parents: [
    {
      navigationId: 'notifications.root',
      labelKey: 'notifications.nav',
      groupId: 'system',
      order: -5,
      iconId: 'notifications',
      routeId: 'notifications',
    },
  ],
} as const satisfies NavigationContribution;
