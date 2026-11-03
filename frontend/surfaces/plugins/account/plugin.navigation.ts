import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';
export const navigationContribution = {
  parents: [
    {
      navigationId: 'account.tokens',
      labelKey: 'administration.tokens',
      groupId: 'system',
      order: 45,
      iconId: 'identity',
      routeId: 'account.tokens',
    },
    {
      navigationId: 'account.security',
      labelKey: 'administration.security',
      groupId: 'system',
      order: 45,
      iconId: 'identity',
      routeId: 'account.security',
    },
    {
      navigationId: 'account.root',
      labelKey: 'account.nav',
      groupId: 'system',
      order: -10,
      iconId: 'account',
      routeId: 'account',
    },
  ],
} as const satisfies NavigationContribution;
