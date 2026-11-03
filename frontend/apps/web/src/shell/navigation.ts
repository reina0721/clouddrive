import type { NavigationGroup } from '@clouddrive/types';

import { createPluginNavigationGroups } from './plugin-navigation';

export const shellNavigationGroups = [
  {
    id: 'universal',
    labelKey: 'nav.workspace',
    items: [
      { kind: 'leaf', id: 'overview', labelKey: 'nav.overview', href: '/', iconId: 'dashboard' },
    ],
  },
] as const satisfies readonly NavigationGroup[];

/** 合并静态 Shell Navigation 与 Product Surface Registry 派生的 Plugin Navigation（最小 Shell bridge）。 */
export const combinedShellNavigationGroups: readonly NavigationGroup[] = [
  ...shellNavigationGroups,
  ...createPluginNavigationGroups(),
];
