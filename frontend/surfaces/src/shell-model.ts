/**
 * Product Surface —— Registry resolved Sidebar model → Shell Navigation model 转换。
 *
 * Registry 输出已把 Group Alias + Plugin Parent/Child 解析为
 * `navigation: ResolvedNavigationGroup[]`（Group → Parent → Child）。本模块只做
 * 纯呈现转换（iconId opaque 透传），不持有 Group/icon 定义、不校验。
 *
 * icon vocabulary 收敛到 `./navigation-icon`（受控 semantic presentation metadata）；
 * Group Alias 是 plugins 范围公共 IA（plugins/navigation-groups.ts），此处不重复定义。
 */

import type { RegistryModel } from '@clouddrive/plugin-framework';
import type {
  NavigationBranch,
  NavigationGroup,
  NavigationLeaf,
  NavigationNode,
} from '@clouddrive/types';

export type {
  NavigationIconId,
  NavigationIconReference,
  NavigationIconDiagnostic,
} from './navigation-icon';
export {
  navigationIconVocabulary,
  UNKNOWN_NAVIGATION_ICON,
  collectUnknownNavigationIconDiagnostics,
} from './navigation-icon';

/**
 * 将 Registry resolved Sidebar model（Group → Parent → Child）转换为 Host Shell
 * 可消费的 NavigationGroup[]。
 * - Parent 可导航（有 href）→ Branch 带 defaultHref；纯 Disclosure → Branch 无
 *   defaultHref（Shell 点击只展开/收起）。
 * - Child → Leaf（挂在 Branch.children 下）；无 children 的单 Parent → Leaf。
 */
export function convertRegistryToShellNavigation(
  registry: RegistryModel,
): readonly NavigationGroup[] {
  const groups: NavigationGroup[] = [];

  for (const resolvedGroup of registry.navigation) {
    const nodes: NavigationNode[] = [];
    for (const parent of resolvedGroup.parents) {
      if (parent.children.length === 0) {
        // 单节点 Parent（可导航 leaf；纯 Disclosure 无 children 已被 resolution 判 orphan）
        nodes.push({
          kind: 'leaf',
          id: parent.navigationId,
          labelKey: parent.labelKey,
          href: parent.href ?? '',
          ...(parent.iconId ? { iconId: parent.iconId } : {}),
        } satisfies NavigationLeaf);
        continue;
      }
      const children = parent.children.map((child): NavigationLeaf => ({
        kind: 'leaf',
        id: child.navigationId,
        labelKey: child.labelKey,
        href: child.href,
        ...(child.iconId ? { iconId: child.iconId } : {}),
      }));
      const branch: NavigationBranch = {
        kind: 'branch',
        id: parent.navigationId,
        labelKey: parent.labelKey,
        ...(parent.href !== undefined ? { defaultHref: parent.href } : {}),
        children: children as [NavigationNode, ...NavigationNode[]],
        ...(parent.iconId ? { iconId: parent.iconId } : {}),
      };
      nodes.push(branch);
    }
    if (nodes.length === 0) continue;
    groups.push({
      id: resolvedGroup.groupId,
      labelKey: resolvedGroup.labelKey,
      items: nodes as [NavigationNode, ...NavigationNode[]],
    });
  }

  return groups;
}
