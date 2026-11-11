import type { NavigationGroup, NavigationNode } from '@clouddrive/types';

// 这里只定义首页任务的阅读分组；地址、标题、可见性和顺序消费 Shell 的最终呈现结果。
const tasks = [
  {
    id: 'files',
    items: [
      ['system-tools.filesystem', 'filesystem'],
      ['system-tools.storage', 'storage'],
      ['system-tools.files', 'inventory'],
      ['system-tools.shares', 'shares'],
    ],
  },
  {
    id: 'access',
    items: [
      ['users.root', 'users'],
      ['users.administration', 'accounts'],
      ['roles.root', 'roles'],
      ['roles.catalog', 'permissions'],
      ['departments.root', 'departments'],
      ['departments.assignments', 'assignments'],
      ['departments.positions', 'positions'],
      ['audit.root', 'audit'],
    ],
  },
  {
    id: 'operations',
    items: [
      ['system-tools.tasks', 'tasks'],
      ['system-tools.nodes', 'nodes'],
      ['system-tools.runtime', 'runtime'],
      ['system-tools.blobs', 'blobs'],
    ],
  },
  {
    id: 'site',
    items: [
      ['system-settings.root', 'settings'],
      ['menus.root', 'menus'],
      ['dictionaries.root', 'dictionaries'],
    ],
  },
] as const;

export function visibleNavigationEntries(groups: readonly NavigationGroup[]) {
  const entries: { id: string; href: string; labelKey: string; iconId?: string }[] = [];
  function collect(node: NavigationNode) {
    const href = node.kind === 'leaf' ? node.href : node.defaultHref;
    if (href)
      entries.push({
        id: node.id,
        href,
        labelKey: node.labelKey,
        ...(node.iconId ? { iconId: node.iconId } : {}),
      });
    if (node.kind === 'branch') node.children.forEach(collect);
  }
  groups.forEach((group) => group.items.forEach(collect));
  return entries;
}

export function managementTaskGroups(groups: readonly NavigationGroup[]) {
  const entries = visibleNavigationEntries(groups);
  return tasks.flatMap((group) => {
    const hints = new Map<string, string>(group.items);
    const items = entries
      .filter((entry) => hints.has(entry.id))
      .map((entry) => ({ ...entry, hint: hints.get(entry.id)! }));
    return items.length ? [{ id: group.id, items }] : [];
  });
}
