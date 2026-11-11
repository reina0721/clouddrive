import type { NavigationGroup, NavigationNode } from '@clouddrive/types';
import type { NavigationOverrides } from '../state/use-navigation-admin-store';
import { regroupNavigation } from './regroup-navigation';

/**
 * Product entry visibility only. It does not replace route or REST authorization.
 * 默认权限映射可被菜单管理的业务覆盖（`permission`）替换；覆盖不新增权限，
 * 只改变"哪个权限码控制该入口的呈现"。
 */
export function requiredNavigationPermission(id: string, backend: boolean): string | null {
  const native: Record<string, string> = {
    'files.root': 'files:read',
    'departments.root': 'organization:department:read',
    'departments.assignments': 'organization:department:read',
    'departments.positions': 'organization:position:read',
    'menus.root': 'navigation:menu:read',
    'dictionaries.root': 'console:dictionary:read',
    'account.security': 'iam:account:self:read',
    'account.tokens': 'iam:api-token:read',
    'system-tools.runtime': 'management:read',
    'system-tools.files': 'files:inventory:read',
    'system-tools.blobs': 'files:blob:read',
    'system-tools.filesystem': 'files:settings:read',
    'system-tools.shares': 'files:share-admin:read',
    'system-tools.tasks': 'files:task-admin:read',
    'system-tools.nodes': 'files:node:read',
    'system-tools.storage': 'files:storage-policy:read',
    'api-workbench.root': 'console:workbench:read',
    'users.administration': 'iam:account:write',
    'roles.catalog': 'iam:permission:read',
  };
  if (backend && native[id]) return native[id];
  if (id === 'users.root') return 'users.read';
  if (id === 'roles.root') return 'roles.read';
  if (id === 'audit.root') return 'audit.read';
  if (id === 'system-settings.root') return 'settings.read';
  return null;
}

function orderOf(overrides: NavigationOverrides, id: string): number | null {
  const order = overrides[id]?.order;
  return typeof order === 'number' ? order : null;
}

export function visibleProductNavigation(
  sourceGroups: readonly NavigationGroup[],
  overrides: NavigationOverrides,
  backend: boolean,
  permissions: readonly string[],
  nativePermissions: readonly string[],
): NavigationGroup[] {
  function visible(node: NavigationNode): NavigationNode | null {
    // 真实产品根路径已进入文件工作区；演示 Host 仍保留自己的概览。
    if (backend && node.id === 'overview') return null;
    if (
      !backend &&
      [
        'files.root',
        'account.tokens',
        'account.security',
        'departments.assignments',
        'departments.positions',
        'roles.catalog',
        'system-tools.runtime',
        'system-tools.files',
        'system-tools.blobs',
        'system-tools.filesystem',
        'system-tools.shares',
        'system-tools.tasks',
        'system-tools.nodes',
        'system-tools.storage',
        'users.administration',
      ].includes(node.id)
    )
      return null;
    const override = overrides[node.id];
    if (override?.hidden === true) return null;
    const permission =
      override?.permission === null || override?.permission === undefined
        ? requiredNavigationPermission(node.id, backend)
        : override.permission;
    if (permission && !permissions.includes(permission) && !nativePermissions.includes(permission))
      return null;
    if (node.kind === 'leaf') return node;
    const children = node.children
      .map(visible)
      .filter((child): child is NavigationNode => child !== null)
      .map((child, index) => ({ child, index }))
      .sort((a, b) => {
        const left = orderOf(overrides, a.child.id);
        const right = orderOf(overrides, b.child.id);
        if (left === null && right === null) return a.index - b.index;
        if (left === null) return 1;
        if (right === null) return -1;
        return left - right || a.index - b.index;
      })
      .map(({ child }) => child);
    const [first, ...rest] = children;
    return first ? { ...node, children: [first, ...rest] } : null;
  }
  const groups: NavigationGroup[] = [];
  for (const group of regroupNavigation(sourceGroups, overrides)) {
    const visibleItems = group.items
      .map(visible)
      .filter((item): item is NavigationNode => item !== null)
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const left = orderOf(overrides, a.item.id);
        const right = orderOf(overrides, b.item.id);
        if (left === null && right === null) return a.index - b.index;
        if (left === null) return 1;
        if (right === null) return -1;
        return left - right || a.index - b.index;
      })
      .map(({ item }) => item);
    if (visibleItems.length > 0) {
      const [firstItem, ...restItems] = visibleItems;
      if (firstItem) groups.push({ ...group, items: [firstItem, ...restItems] });
    }
  }
  return groups;
}
