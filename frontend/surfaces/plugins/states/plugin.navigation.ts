import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * states —— Sidebar Navigation Contribution。
 *
 * Group `development`（plugins 公共 Group Alias）下带 routeId 的 Parent，
 * routeId 指向根 Route（/states）。Sidebar label 用 statesNav.*（本 Plugin 私有）；
 * 页面文案 `productStates.*` 是产品状态语义 shared 词汇，由 Surface 层 i18n（src/i18n.ts）
 * 提供。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'states.root',
      labelKey: 'statesNav.root',
      groupId: 'development',
      order: 70,
      iconId: 'states',
      routeId: 'states',
    },
  ],
} as const satisfies NavigationContribution;
