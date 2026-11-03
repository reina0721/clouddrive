/**
 * Product Surface —— Navigation Group Alias 公共契约（plugins 范围公共 IA）。
 *
 * Sidebar 模型：Group → Parent → Child。
 * - Group 是侧边栏分组/分隔区域，不是 Route、不是父菜单。
 * - 普通 Plugin 不定义 Group，只在自身 plugin.navigation.ts 中按 groupId 选择
 *   本文件的既有 Alias；Shell 不写死 Group。
 * - 新增 Group Alias = plugins 范围公共 IA Contract 变更（改本文件 + labelKey i18n），
 *   不属于单个 Plugin 私有声明。
 *
 * 每个 Alias 含稳定：groupId / labelKey / order。
 */

/** Group Alias 声明类型（与 framework contract 的 NavigationGroupAlias 对齐）。 */
export type NavigationGroupAlias = Readonly<{
  groupId: string;
  labelKey: string;
  order?: number;
}>;

/** plugins 范围公共 Group Alias 表（单一 authority，Shell 与 codegen 均消费）。 */
export const navigationGroupAliases: readonly NavigationGroupAlias[] = [
  { groupId: 'overview', labelKey: 'shellNavigationGroups.overview', order: -1 },
  { groupId: 'management', labelKey: 'shellNavigationGroups.management', order: 0 },
  { groupId: 'administration', labelKey: 'shellNavigationGroups.administration', order: 1 },
  { groupId: 'system', labelKey: 'shellNavigationGroups.system', order: 2 },
  { groupId: 'development', labelKey: 'shellNavigationGroups.development', order: 3 },
] as const;
