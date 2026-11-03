import type { NavigationGroup, NavigationNode } from '@clouddrive/types';
import type { NavigationOverrides } from '../state/use-navigation-admin-store';

/** 把后端父级覆盖应用到同一套代码注册节点，不创建新路由或丢弃原始路由身份。 */
export function regroupNavigation(
  groups: readonly NavigationGroup[],
  overrides: NavigationOverrides,
): NavigationGroup[] {
  const nodes = new Map<string, NavigationNode>();
  const parents = new Map<string, string>();
  function collect(node: NavigationNode, parent: string) {
    nodes.set(node.id, node);
    parents.set(node.id, overrides[node.id]?.parentId ?? parent);
    if (node.kind === 'branch') for (const child of node.children) collect(child, node.id);
  }
  for (const group of groups) for (const node of group.items) collect(node, 'group:' + group.id);
  function children(parent: string): NavigationNode[] {
    const result: NavigationNode[] = [];
    for (const [id, node] of nodes) {
      if (parents.get(id) !== parent) continue;
      if (node.kind === 'leaf') {
        result.push(node);
        continue;
      }
      const [first, ...rest] = children(id);
      if (first) result.push({ ...node, children: [first, ...rest] });
    }
    return result;
  }
  const result: NavigationGroup[] = [];
  for (const group of groups) {
    if (overrides['group:' + group.id]?.hidden) continue;
    const [first, ...rest] = children('group:' + group.id);
    if (first) result.push({ ...group, items: [first, ...rest] });
  }
  return result.sort(
    (a, b) =>
      (overrides['group:' + a.id]?.order ?? groups.findIndex((group) => group.id === a.id)) -
      (overrides['group:' + b.id]?.order ?? groups.findIndex((group) => group.id === b.id)),
  );
}
