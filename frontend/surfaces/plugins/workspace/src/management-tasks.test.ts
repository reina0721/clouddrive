import { expect, it } from 'vitest';
import type { NavigationGroup } from '@clouddrive/types';
import { managementTaskGroups } from './management-tasks';

it('管理任务只投影可见导航，不补造地址或重新排列已应用的菜单顺序', () => {
  const groups: NavigationGroup[] = [
    {
      id: 'custom',
      labelKey: 'custom',
      items: [
        {
          kind: 'leaf',
          id: 'system-tools.storage',
          labelKey: 'customStorage',
          href: '/custom/storage',
        },
        {
          kind: 'leaf',
          id: 'system-tools.filesystem',
          labelKey: 'settings',
          href: '/system-tools/filesystem',
        },
        {
          kind: 'branch',
          id: 'roles.root',
          labelKey: 'roles',
          defaultHref: '/roles',
          children: [
            { kind: 'leaf', id: 'roles.catalog', labelKey: 'catalog', href: '/roles/catalog' },
          ],
        },
      ],
    },
  ];
  expect(
    managementTaskGroups(groups).map((group) => ({
      id: group.id,
      links: group.items.map(({ id, href, labelKey }) => ({ id, href, labelKey })),
    })),
  ).toEqual([
    {
      id: 'files',
      links: [
        { id: 'system-tools.storage', labelKey: 'customStorage', href: '/custom/storage' },
        { id: 'system-tools.filesystem', labelKey: 'settings', href: '/system-tools/filesystem' },
      ],
    },
    {
      id: 'access',
      links: [
        { id: 'roles.root', labelKey: 'roles', href: '/roles' },
        { id: 'roles.catalog', labelKey: 'catalog', href: '/roles/catalog' },
      ],
    },
  ]);
  expect(managementTaskGroups([])).toEqual([]);
});
