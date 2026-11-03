'use client';
import { useMemo } from 'react';
import { regroupNavigation } from './regroup-navigation';
import {
  useProductAccess,
  useIdentityPort,
  type IdentityPermission,
} from '@clouddrive/surface/identity/runtime';
import type { NavigationGroup, NavigationNode } from '@clouddrive/types';
import { useNavigationOverrides } from '../host/navigation-admin-port';
import type { NavigationOverrides } from '../state/use-navigation-admin-store';
import { combinedShellNavigationGroups } from './navigation';

/**
 * Product entry visibility only. It does not replace route or REST authorization.
 * 默认权限映射可被菜单管理的业务覆盖（`permission`）替换；覆盖不新增权限，
 * 只改变"哪个权限码控制该入口的呈现"。
 */
function requiredPermission(id: string, backend: boolean): string | null {
  const native: Record<string, string> = {
    'departments.root': 'organization:department:read',
    'departments.assignments': 'organization:department:read',
    'departments.positions': 'organization:position:read',
    'menus.root': 'navigation:menu:read',
    'dictionaries.root': 'console:dictionary:read',
    'account.security': 'iam:account:self:read',
    'account.tokens': 'iam:api-token:read',
    'system-tools.runtime': 'management:read',
    'workspace.root': 'todos:read',
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

export function useProductNavigation() {
  const access = useProductAccess();
  const backend = useIdentityPort().mode === 'backend';
  const overrides = useNavigationOverrides();
  return useMemo(() => {
    function visible(node: NavigationNode): NavigationNode | null {
      if (
        !backend &&
        [
          'account.tokens',
          'account.security',
          'departments.assignments',
          'departments.positions',
          'roles.catalog',
          'system-tools.runtime',
          'users.administration',
        ].includes(node.id)
      )
        return null;
      const override = overrides[node.id];
      if (override?.hidden === true) return null;
      const permission =
        override?.permission === null || override?.permission === undefined
          ? requiredPermission(node.id, backend)
          : (override.permission as IdentityPermission);
      if (
        permission &&
        !access.data?.permissions.includes(permission as IdentityPermission) &&
        !access.data?.nativePermissions?.includes(permission)
      )
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
    for (const group of regroupNavigation(combinedShellNavigationGroups, overrides)) {
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
  }, [access.data, overrides, backend]);
}

/**
 * 标题覆盖：以 labelKey 为键返回业务标题，供 Shell 呈现层（导航、页签、命令面板）
 * 使用同一份解析结果。未覆盖的 labelKey 不在映射中，呈现层回落到 i18n。
 */
export function useNavigationLabelOverrides(): Readonly<Record<string, string>> {
  const overrides = useNavigationOverrides();
  return useMemo(() => {
    const map: Record<string, string> = {};
    const visit = (node: NavigationNode) => {
      const label = overrides[node.id]?.label;
      if (label) map[node.labelKey] = label;
      if (node.kind !== 'leaf') node.children.forEach(visit);
    };
    for (const group of combinedShellNavigationGroups) {
      const label = overrides['group:' + group.id]?.label;
      if (label) map[group.labelKey] = label;
      group.items.forEach(visit);
    }
    return map;
  }, [overrides]);
}
