import { describe, expect, it } from 'vitest';
import type { NavigationGroup, NavigationNode } from '@clouddrive/types';
import { visibleProductNavigation } from '../shell/navigation-visibility';

const ids = [
  'overview',
  'workspace.root',
  'system-tools.shares',
  'system-tools.tasks',
  'system-tools.nodes',
  'system-tools.storage',
  'files.root',
] as const;
const entry = (id: string): NavigationNode => ({ kind: 'leaf', id, labelKey: id, href: '/' + id });
const groups: NavigationGroup[] = [
  {
    id: 'administration',
    labelKey: 'group',
    items: [entry(ids[0]), ...ids.slice(1).map(entry)],
  },
];
const result = (native: string[] = [], overrides = {}) =>
  visibleProductNavigation(groups, overrides, true, [], native).flatMap((group) =>
    group.items.map((item) => item.id),
  );

describe('管理导航只呈现当前允许的入口', () => {
  it('文件读取不隐含分享、任务、节点或存储管理权限，管理概览不要求待办权限', () => {
    expect(result(['files:read'])).toEqual(['workspace.root', 'files.root']);
    for (const [permission, id] of [
      ['files:share-admin:read', 'system-tools.shares'],
      ['files:task-admin:read', 'system-tools.tasks'],
      ['files:node:read', 'system-tools.nodes'],
      ['files:storage-policy:read', 'system-tools.storage'],
    ] as const) {
      expect(result([permission])).toEqual(['workspace.root', id]);
    }
  });
  it('菜单覆盖的隐藏、权限与顺序保留，失败或未有权限不放行管理项', () => {
    expect(
      result(['files:node:read'], { 'system-tools.nodes': { hidden: true, version: 1 } }),
    ).toEqual(['workspace.root']);
    expect(
      result(['files:read'], {
        'system-tools.nodes': { permission: 'files:read', version: 1, order: -1 },
      }),
    ).toEqual(['system-tools.nodes', 'workspace.root', 'files.root']);
    expect(result()).toEqual(['workspace.root']);
  });
  it('模拟 Host 保留原概览，隐藏需要真实后台的文件管理项', () => {
    const visible = visibleProductNavigation(groups, {}, false, [], []).flatMap((group) =>
      group.items.map((item) => item.id),
    );
    expect(visible).toEqual(['overview', 'workspace.root']);
  });
});
