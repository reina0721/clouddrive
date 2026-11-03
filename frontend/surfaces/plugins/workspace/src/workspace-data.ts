/**
 * workspace —— 确定性演示数据（纯 TS）。
 *
 * 只保存稳定 id、数值与日期等「结构数据」；所有可读文案（项目名/引用语/动态/待办）
 * 由插件 i18n 资源按 id 提供，因此不出现硬编码产品文案。
 */

export const WORKSPACE_TEAM_COUNT = 4;

export type WorkspaceProjectId = 'aurora' | 'nebula' | 'harbor' | 'atlas' | 'lumen' | 'orbit';
export type WorkspaceProjectGroup = 'product' | 'design' | 'operations' | 'research';

export type WorkspaceProject = Readonly<{
  id: WorkspaceProjectId;
  group: WorkspaceProjectGroup;
  /** 稳定演示日期（ISO date，展示层经 i18n 格式化）。 */
  updatedAt: string;
  members: number;
}>;

export const WORKSPACE_PROJECTS: readonly WorkspaceProject[] = [
  { id: 'aurora', group: 'product', updatedAt: '2026-03-30', members: 8 },
  { id: 'nebula', group: 'design', updatedAt: '2026-03-27', members: 5 },
  { id: 'harbor', group: 'operations', updatedAt: '2026-03-24', members: 6 },
  { id: 'atlas', group: 'product', updatedAt: '2026-03-21', members: 9 },
  { id: 'lumen', group: 'research', updatedAt: '2026-03-18', members: 4 },
  { id: 'orbit', group: 'design', updatedAt: '2026-03-15', members: 7 },
] as const;

export const WORKSPACE_PEOPLE_IDS = ['chen', 'lin', 'ada', 'mo', 'kim'] as const;
export type WorkspacePersonId = (typeof WORKSPACE_PEOPLE_IDS)[number];

export type WorkspaceActivity = Readonly<{
  id: string;
  actorId: WorkspacePersonId;
  /** 相对当前时间的分钟数（展示层经 i18n 转成相对时间文本）。 */
  minutesAgo: number;
}>;

export const WORKSPACE_ACTIVITIES: readonly WorkspaceActivity[] = [
  { id: 'activity-1', actorId: 'chen', minutesAgo: 4 },
  { id: 'activity-2', actorId: 'lin', minutesAgo: 26 },
  { id: 'activity-3', actorId: 'ada', minutesAgo: 74 },
  { id: 'activity-4', actorId: 'mo', minutesAgo: 180 },
  { id: 'activity-5', actorId: 'kim', minutesAgo: 400 },
  { id: 'activity-6', actorId: 'chen', minutesAgo: 1_500 },
  { id: 'activity-7', actorId: 'lin', minutesAgo: 2_900 },
] as const;

export const WORKSPACE_TODO_IDS = [
  'review-access',
  'publish-release',
  'sync-metrics',
  'invite-design',
  'audit-permissions',
] as const;
export type WorkspaceTodoId = (typeof WORKSPACE_TODO_IDS)[number];

export const WORKSPACE_TODO_PRIORITIES: Readonly<Record<WorkspaceTodoId, 'high' | 'normal'>> = {
  'review-access': 'high',
  'publish-release': 'normal',
  'sync-metrics': 'normal',
  'invite-design': 'normal',
  'audit-permissions': 'high',
};

export type WorkspaceQuickLinkId =
  'users' | 'roles' | 'audit' | 'settings' | 'analytics' | 'workspace';

/**
 * 快捷导航目标：`routeId` 必须是 `surfaces/generated/catalog/catalog.ts` 中静态可解析的
 * routeId。`users` / `roles` / `audit` / `settings` 已在当前 catalog 中；`analytics` /
 * `workspace` 由本插件（VP-06）新增，codegen 后进入 catalog。
 */
export const WORKSPACE_QUICK_LINKS: readonly Readonly<{
  id: WorkspaceQuickLinkId;
  routeId: WorkspaceQuickLinkId;
}>[] = [
  { id: 'users', routeId: 'users' },
  { id: 'roles', routeId: 'roles' },
  { id: 'audit', routeId: 'audit' },
  { id: 'settings', routeId: 'settings' },
  { id: 'analytics', routeId: 'analytics' },
  { id: 'workspace', routeId: 'workspace' },
] as const;

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

/**
 * 根据本地小时给出问候语时段（纯函数，便于测试）：
 * 05:00–11:59 早安 / 12:00–17:59 午安 / 其余 晚上好。
 */
export function resolveGreetingPeriod(hour: number): GreetingPeriod {
  if (!Number.isFinite(hour)) return 'morning';
  const normalized = Math.min(23, Math.max(0, Math.trunc(hour)));
  if (normalized >= 5 && normalized < 12) return 'morning';
  if (normalized >= 12 && normalized < 18) return 'afternoon';
  return 'evening';
}

export type RelativeTimeUnit = 'minute' | 'hour' | 'day';

/**
 * 相对时间参数（供 `formatRelativeTime` 消费）：>1 小时用小时、>1 天用天，
 * 数值为负数（过去）。单位与数值都由本函数决定，页面不自行判断。
 */
export function resolveRelativeTime(minutesAgo: number): Readonly<{
  value: number;
  unit: RelativeTimeUnit;
}> {
  const safeMinutes = Number.isFinite(minutesAgo) ? Math.max(0, minutesAgo) : 0;
  if (safeMinutes < 60) return { value: -Math.max(1, Math.round(safeMinutes)), unit: 'minute' };
  if (safeMinutes < 1_440)
    return { value: -Math.max(1, Math.round(safeMinutes / 60)), unit: 'hour' };
  return { value: -Math.max(1, Math.round(safeMinutes / 1_440)), unit: 'day' };
}
