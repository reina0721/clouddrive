import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';
export const navigationContribution = {
  parents: [
    {
      navigationId: 'system-settings.root',
      labelKey: 'systemSettings.nav',
      groupId: 'administration',
      iconId: 'settings',
      routeId: 'system-settings',
      order: 40,
    },
  ],
} as const satisfies NavigationContribution;
