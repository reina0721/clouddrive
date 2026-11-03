import { describe, expect, it } from 'vitest';

import { resolveRouteTarget } from '@clouddrive/plugin-framework';

import { assertValidSurfaceRegistry } from './composition';
import { collectUnknownNavigationIconDiagnostics } from './navigation-icon';
import {
  generatedSurfaceComposition,
  generatedSurfaceI18nResources,
  generatedSurfaceRegistry,
} from '../generated/composition/composition';

/**
 * Production generated registry 的 invariant 测试。
 *
 * 不锁定真实生产插件集合（数量/名称/精确结构）——新增或删除普通插件不应要求
 * 修改本文件。精确数量/结构场景测试见 framework.test.ts 的 fixture catalog。
 */

/** 在 merged TranslationResources 中按 dotted key 查找文本；找不到返回 undefined。 */
function lookupTranslation(
  resources: typeof generatedSurfaceI18nResources,
  locale: string,
  key: string,
): unknown {
  const translation = resources[locale]?.translation;
  if (!translation || typeof translation !== 'object') return undefined;
  let current: unknown = translation;
  for (const segment of key.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

describe('Generated composition (production invariant)', () => {
  it('Registry topology 完整：无 diagnostics（Alias/namespace/routeId/orphan 全部通过）', () => {
    expect(generatedSurfaceRegistry.diagnostics).toEqual([]);
  });

  it('plugin ownership valid：route.pluginId ∈ catalog.plugins，routes 键与 catalog 一一对应', () => {
    const registry = generatedSurfaceRegistry;
    const pluginIds = new Set(registry.catalog.plugins.map((plugin) => plugin.pluginId));
    for (const descriptor of registry.catalog.routes) {
      expect(pluginIds.has(descriptor.pluginId)).toBe(true);
    }
    const routeKeys = Object.keys(registry.routes).sort();
    const catalogRouteIds = registry.catalog.routes.map((route) => route.routeId).sort();
    expect(routeKeys).toEqual(catalogRouteIds);
    expect(new Set(catalogRouteIds).size).toBe(catalogRouteIds.length);
  });

  it('resolved Sidebar model 结构一致：navigation groups 均来自 catalog aliases 且含有效 parents', () => {
    const registry = generatedSurfaceRegistry;
    const aliasGroupIds = new Set(registry.catalog.aliases.map((alias) => alias.groupId));
    for (const group of registry.navigation) {
      expect(aliasGroupIds.has(group.groupId)).toBe(true);
      expect(group.parents.length).toBeGreaterThan(0);
      for (const parent of group.parents) {
        expect(parent.navigationId).toMatch(/^[a-z0-9-]+\./); // `${pluginId}.` namespace
        // Child 有 href；Parent 可导航（有 href）或纯 Disclosure（无 href 且必有 children）
        for (const child of parent.children) {
          expect(child.href.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('navigationId 在 resolved model 中唯一', () => {
    const registry = generatedSurfaceRegistry;
    const ids = registry.navigation.flatMap((group) =>
      group.parents.flatMap((parent) => [
        parent.navigationId,
        ...parent.children.map((c) => c.navigationId),
      ]),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every static route resolvable：resolveRouteTarget 无 diagnostics 且 href === pattern', () => {
    const registry = generatedSurfaceRegistry;
    for (const descriptor of registry.catalog.routes) {
      if (descriptor.paramNames.length > 0) continue;
      const result = resolveRouteTarget(registry, {
        routeId: descriptor.routeId,
        params: {},
      });
      expect(result.diagnostics).toEqual([]);
      expect(result.href).toBe(descriptor.pattern);
    }
  });

  it('assertValidSurfaceRegistry 通过（Surface boundary runtime invariant）', () => {
    expect(() => assertValidSurfaceRegistry(generatedSurfaceRegistry)).not.toThrow();
  });

  it('navigation icon references valid：每个声明的 iconId 命中 icon vocabulary', () => {
    const registry = generatedSurfaceRegistry;
    const references = registry.navigation.flatMap((group) =>
      group.parents.flatMap((parent) => {
        const entries = [];
        if (parent.iconId !== undefined) {
          entries.push({ iconId: parent.iconId, routeId: parent.navigationId });
        }
        for (const child of parent.children) {
          if (child.iconId !== undefined) {
            entries.push({ iconId: child.iconId, routeId: child.navigationId });
          }
        }
        return entries;
      }),
    );
    expect(collectUnknownNavigationIconDiagnostics(references)).toEqual([]);
  });

  it('i18n contribution consistency：按 Contract 声明的键在双 locale 均可解析', () => {
    const registry = generatedSurfaceRegistry;
    // Group Alias labelKey
    for (const alias of registry.catalog.aliases) {
      for (const locale of ['zh-CN', 'en']) {
        expect(
          lookupTranslation(generatedSurfaceI18nResources, locale, alias.labelKey),
        ).toBeTruthy();
      }
    }
    // Sidebar node labelKey
    for (const group of registry.navigation) {
      for (const parent of group.parents) {
        for (const locale of ['zh-CN', 'en']) {
          expect(
            lookupTranslation(generatedSurfaceI18nResources, locale, parent.labelKey),
          ).toBeTruthy();
          for (const child of parent.children) {
            expect(
              lookupTranslation(generatedSurfaceI18nResources, locale, child.labelKey),
            ).toBeTruthy();
          }
        }
      }
    }
  });

  it('route descriptor 是纯结构（不含 route.meta 派生字段）', () => {
    const pureKeys = ['routeId', 'pluginId', 'path', 'segments', 'pattern', 'paramNames'] as const;
    for (const descriptor of generatedSurfaceRegistry.catalog.routes) {
      const keys = Object.keys(descriptor).sort();
      expect(keys).toEqual([...pureKeys].sort());
      expect(descriptor.routeId.length).toBeGreaterThan(0);
      expect(descriptor.pluginId.length).toBeGreaterThan(0);
      expect(descriptor.pattern.length).toBeGreaterThan(0);
    }
  });

  it('composition 一致性：model/resource 结构一致、registry 通过 assert（不锁内部对象身份）', () => {
    expect(generatedSurfaceComposition.registryModel.catalog).toEqual(
      generatedSurfaceRegistry.catalog,
    );
    expect(generatedSurfaceComposition.i18nResources).toEqual(generatedSurfaceI18nResources);
    expect(() =>
      assertValidSurfaceRegistry(generatedSurfaceComposition.registryModel),
    ).not.toThrow();
  });
});
