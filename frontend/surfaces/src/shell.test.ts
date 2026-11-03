import { describe, expect, it } from 'vitest';

import type { RouteCatalog } from '@clouddrive/plugin-framework';
import { createRegistry } from '@clouddrive/plugin-framework';

import { convertRegistryToShellNavigation } from './shell-model';
import { mergeTranslationResources } from './composition';
import { surfaceShellI18nResources } from './i18n';
import { collectUnknownNavigationIconDiagnostics } from './navigation-icon';

const catalog: RouteCatalog = {
  plugins: [{ pluginId: 'reference-resources', mount: '/reference-resources' }],
  routes: [
    {
      routeId: 'reference-resources',
      pluginId: 'reference-resources',
      path: '',
      segments: [],
      pattern: '/reference-resources',
      paramNames: [],
    },
    {
      routeId: 'reference-resources.create',
      pluginId: 'reference-resources',
      path: 'create',
      segments: ['create'],
      pattern: '/reference-resources/create',
      paramNames: [],
    },
  ],
  aliases: [{ groupId: 'reference', labelKey: 'shellNavigationGroups.reference', order: 0 }],
  contributions: [
    {
      pluginId: 'reference-resources',
      contribution: {
        parents: [
          {
            navigationId: 'reference-resources.root',
            labelKey: 'referenceResources.nav.root',
            groupId: 'reference',
            iconId: 'resource',
            routeId: 'reference-resources',
            children: [
              {
                navigationId: 'reference-resources.root.list',
                labelKey: 'referenceResources.nav.list',
                routeId: 'reference-resources',
              },
            ],
          },
        ],
      },
    },
  ],
};

describe('Registry → Shell navigation 转换（Group → Parent → Child）', () => {
  it('Parent 有 routeId + children → 可导航 Branch（带 defaultHref）；Child → Leaf', () => {
    const registry = createRegistry(catalog);
    const groups = convertRegistryToShellNavigation(registry);
    expect(groups).toHaveLength(1);
    const group = groups[0];
    expect(group?.labelKey).toBe('shellNavigationGroups.reference');
    expect(group?.items[0]?.kind).toBe('branch');
    const branch = group?.items[0];
    if (branch?.kind === 'branch') {
      expect(branch.id).toBe('reference-resources.root');
      expect(branch.iconId).toBe('resource');
      expect(branch.defaultHref).toBe('/reference-resources');
      expect(branch.children).toHaveLength(1);
      const leaf = branch.children[0];
      if (leaf.kind === 'leaf') {
        expect(leaf.href).toBe('/reference-resources');
      }
    }
  });

  it('纯 Disclosure Parent（无 routeId 有 children）→ Branch 无 defaultHref', () => {
    const disclosureCatalog: RouteCatalog = {
      ...catalog,
      contributions: [
        {
          pluginId: 'reference-resources',
          contribution: {
            parents: [
              {
                navigationId: 'reference-resources.group',
                labelKey: 'referenceResources.nav.root',
                groupId: 'reference',
                children: [
                  {
                    navigationId: 'reference-resources.group.list',
                    labelKey: 'referenceResources.nav.list',
                    routeId: 'reference-resources',
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    const registry = createRegistry(disclosureCatalog);
    const groups = convertRegistryToShellNavigation(registry);
    const node = groups[0]?.items[0];
    expect(node?.kind).toBe('branch');
    if (node?.kind === 'branch') {
      expect(node.defaultHref).toBeUndefined(); // 纯 Disclosure：点击只展开/收起
      expect(node.children).toHaveLength(1);
    }
  });

  it('无 children 的 Parent → Leaf（可导航）', () => {
    const singleCatalog: RouteCatalog = {
      ...catalog,
      contributions: [
        {
          pluginId: 'reference-resources',
          contribution: {
            parents: [
              {
                navigationId: 'reference-resources.root',
                labelKey: 'referenceResources.nav.root',
                groupId: 'reference',
                iconId: 'resource',
                routeId: 'reference-resources',
              },
            ],
          },
        },
      ],
    };
    const registry = createRegistry(singleCatalog);
    const groups = convertRegistryToShellNavigation(registry);
    const node = groups[0]?.items[0];
    if (node?.kind === 'leaf') {
      expect(node.href).toBe('/reference-resources');
    }
  });
});

describe('Registry → Shell：无有效 Node 的 Group 不进最终 model', () => {
  it('alias 无 parents → navigation 为空 → Shell groups 为空', () => {
    const emptyCatalog: RouteCatalog = {
      plugins: [{ pluginId: 'reference-resources', mount: '/reference-resources' }],
      routes: [
        {
          routeId: 'reference-resources',
          pluginId: 'reference-resources',
          path: '',
          segments: [],
          pattern: '/reference-resources',
          paramNames: [],
        },
      ],
      aliases: [{ groupId: 'reference', labelKey: 'shellNavigationGroups.reference', order: 0 }],
      contributions: [],
    };
    const registry = createRegistry(emptyCatalog);
    expect(registry.navigation).toHaveLength(0);
    expect(convertRegistryToShellNavigation(registry)).toHaveLength(0);
  });
});

describe('i18n Composition 聚合', () => {
  it('合并 surface 与 plugin 资源，同 locale translation 深度合并', () => {
    const pluginResources = {
      'zh-CN': {
        translation: {
          referenceResources: {
            nav: { root: '参考资源' },
            list: { title: '参考资源列表' },
          },
        },
      },
    } as const;
    const merged = mergeTranslationResources(surfaceShellI18nResources, pluginResources);
    const zhCN = merged['zh-CN'];
    // surface 侧 Group Alias label（shellNavigationGroups）+ plugin 文案均聚合
    expect(zhCN?.translation['shellNavigationGroups']).toBeTruthy();
    expect(zhCN?.translation['referenceResources']).toBeTruthy();
  });
});

describe('icon vocabulary（受控语义，不动态化）', () => {
  it('合法 iconId 无诊断；未知 iconId 聚合 routeIds', () => {
    expect(collectUnknownNavigationIconDiagnostics([{ iconId: 'resource', routeId: 'a' }])).toEqual(
      [],
    );
    const diagnostics = collectUnknownNavigationIconDiagnostics([{ iconId: 'nope', routeId: 'a' }]);
    expect(diagnostics[0]?.code).toBe('UNKNOWN_NAVIGATION_ICON');
  });
});
