import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';

/**
 * workspace —— Sidebar Navigation Contribution.
 *
 * Group `management`（身份与访问）：工作台是管理角色的日常入口。
 * `iconId: 'workspace'` 是 Product Surface icon vocabulary 语义 id（vocabulary 与 Shell
 * icon 映射由 Surface 治理；integrator 注册 `workspace` 后 codegen icon gate 通过）。
 */
export const navigationContribution = {
  parents: [
    {
      navigationId: 'workspace.root',
      labelKey: 'workspace.nav',
      groupId: 'overview',
      order: 11,
      iconId: 'workspace',
      routeId: 'workspace',
    },
  ],
} as const satisfies NavigationContribution;
