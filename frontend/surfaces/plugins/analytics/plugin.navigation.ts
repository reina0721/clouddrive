import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * analytics —— Sidebar Navigation Contribution.
 *
 * Group `management`（身份与访问）：分析是管理视角的业务概览入口。
 * `iconId: 'analytics'` 是 Product Surface icon vocabulary 语义 id（vocabulary 与 Shell
 * icon 映射由 Surface 治理；integrator 注册 `analytics` 后 codegen icon gate 通过）。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'analytics.root',
      labelKey: 'analytics.nav',
      groupId: 'overview',
      order: 10,
      iconId: 'analytics',
      routeId: 'analytics',
    },
  ],
} as const satisfies NavigationContribution;
