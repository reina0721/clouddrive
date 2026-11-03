/**
 * Product Surface —— Navigation Icon Vocabulary Authority。
 *
 * `navigation.iconId` 是 Plugin Navigation Contribution 中**可选的 semantic
 * presentation metadata**，不是 Plugin capability，不是插件向 Shell 提供的
 * 功能能力，也不是能力协商。合法 icon 集合由 Product Surface 治理（本模块），
 * Registry/Framework 只透传 opaque id，Shell Sidebar 按自己的 presentation
 * policy 决定是否及如何消费。
 *
 * 本模块只承担：
 * - semantic icon vocabulary（navigationIconVocabulary）；
 * - vocabulary types；
 * - icon reference 的纯 validation / diagnostic。
 *
 * 无副作用、纯 TS；`shell-model`/`tooling/plugin-codegen`/Host Shell resolver
 * 均消费本 authority。
 */

/**
 * 受控 semantic icon vocabulary。
 *
 * 来源：现有 `apps/web/src/shell/navigation-tree.tsx` 的 iconByNavigationId
 * 中**实际被引用**的图标语义（未凭空扩大图标体系）。死 key（reference /
 * referenceWorkspace / formReference，无引用方）不进入。Shell 端把每个语义 id
 * 映射到当前实际 Icon Component（Record key 用本 vocabulary union 编译期强制完整）。
 */
export const navigationIconVocabulary = [
  'dashboard',
  'foundations',
  'catalog',
  'action',
  'feedback',
  'async',
  'identity',
  'navigation',
  'data',
  'surfaces',
  'list',
  'overlay',
  'states',
  'settings',
  'icons',
  'motion',
  'resource',
  // 设置中心分类语义（SET-011：settings 内页导航为真实消费方；沿用受控语义 id 体系）。
  'palette',
  'globe',
  'accessibility',
  'keyboard',
  // 业务管理插件独立导航语义
  'users',
  'roles',
  'audit',
  'account',
  'notifications',
  'api',
  // 分析 / 工作台 / 系统管理（菜单、部门、字典）语义
  'analytics',
  'workspace',
  'menu',
  'department',
  'dictionary',
] as const;

/** 合法 semantic icon id。 */
export type NavigationIconId = (typeof navigationIconVocabulary)[number];

/** 未知 icon 诊断 code（Surface governance，不进入 framework diagnostics union）。 */
export const UNKNOWN_NAVIGATION_ICON = 'UNKNOWN_NAVIGATION_ICON';

/** 一条 icon reference：哪个 Route 声明了哪个 iconId。 */
export type NavigationIconReference = Readonly<{
  iconId: string;
  routeId: string;
}>;

/** 未知 icon 诊断：同一未知 iconId 聚合其声明 Route。 */
export type NavigationIconDiagnostic = Readonly<{
  code: typeof UNKNOWN_NAVIGATION_ICON;
  iconId: string;
  routeIds: readonly string[];
  message: string;
}>;

/**
 * 唯一 icon-reference 合法性 validator（单点构造 code 与 message）。
 *
 * 调用方只做适配：
 * - codegen：discovery descriptors（hasNavigation 且声明 iconId）适配；
 * - Surface composition assert：registry.navigationTree 适配。
 *
 * 合法性规则、diagnostic code 与 message 构造不得在调用方复制漂移。
 * 未声明 iconId（undefined）不产生诊断——iconId 是可选项。
 */
export function collectUnknownNavigationIconDiagnostics(
  references: readonly NavigationIconReference[],
  vocabulary: readonly string[] = navigationIconVocabulary,
): readonly NavigationIconDiagnostic[] {
  const vocabularySet = new Set(vocabulary);
  const byIcon = new Map<string, string[]>();
  for (const reference of references) {
    if (vocabularySet.has(reference.iconId)) continue;
    const routeIds = byIcon.get(reference.iconId) ?? [];
    routeIds.push(reference.routeId);
    byIcon.set(reference.iconId, routeIds);
  }
  return [...byIcon.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([iconId, routeIds]) => ({
      code: UNKNOWN_NAVIGATION_ICON,
      iconId,
      routeIds,
      message: `navigation.iconId 未命中 Product Surface icon vocabulary: ${iconId}（声明于 ${routeIds.join(', ')}）`,
    }));
}
