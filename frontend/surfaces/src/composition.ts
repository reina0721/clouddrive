/**
 * Product Surface —— Composition 装配。
 *
 * Surface composition 接收 Plugin Registry model 与 Plugin i18n resources，
 * 返回 Host Composition Root 一次性安装所需的 Surface Bundle：
 * - registryModel：Registry resolved model（Shell/Command/Breadcrumb/Permission 消费）
 * - i18nResources：聚合后的 Plugin i18n（Host 合并进 Frontend i18n resources）
 *
 * 本模块不读取 pathname、不创建 Registry、不实现 Router；只做纯装配。
 * Surface composition/model boundary 在此对生成的 Registry 做 runtime invariant
 * assertion（registry diagnostics 必须为空 + iconId 必须命中 vocabulary），
 * 保证 Host 只消费已验证的 valid navigation model。
 */

import type { RegistryModel } from '@clouddrive/plugin-framework';
import type { TranslationResources } from '@clouddrive/i18n';

import { collectUnknownNavigationIconDiagnostics } from './navigation-icon';

export type SurfaceComposition = Readonly<{
  registryModel: RegistryModel;
  i18nResources: TranslationResources;
}>;

/**
 * Surface boundary invariant assertion：
 * 1. registry.diagnostics 为空 —— Group Alias / namespace / routeId / orphan 等
 *    Sidebar topology 校验已由 framework resolution 在 createRegistry 完成，
 *    有诊断即 throw（不静默）。
 * 2. resolved navigation 中每个声明的 iconId 命中 Product Surface icon vocabulary。
 */
export function assertValidSurfaceRegistry(registry: RegistryModel): void {
  if (registry.diagnostics.length > 0) {
    const detail = registry.diagnostics
      .map((diagnostic) => `[${diagnostic.code}] ${diagnostic.message}`)
      .join('; ');
    throw new Error(`Product Surface Registry 校验失败: ${detail}`);
  }

  const iconReferences = registry.navigation.flatMap((group) =>
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
  const iconDiagnostics = collectUnknownNavigationIconDiagnostics(iconReferences);
  if (iconDiagnostics.length > 0) {
    const detail = iconDiagnostics
      .map((diagnostic) => `[${diagnostic.code}] ${diagnostic.message}`)
      .join('; ');
    throw new Error(`Product Surface Registry 校验失败: ${detail}`);
  }
}

/** 合并多个 locale 资源为一个 TranslationResources（plugin + surface）。 */
export function mergeTranslationResources(
  ...resources: readonly TranslationResources[]
): TranslationResources {
  const merged: Record<string, Readonly<{ translation: Readonly<Record<string, unknown>> }>> = {};
  for (const resource of resources) {
    for (const [locale, block] of Object.entries(resource)) {
      const existing = merged[locale];
      merged[locale] = {
        translation: {
          ...(existing?.translation ?? {}),
          ...block.translation,
        },
      };
    }
  }
  return merged;
}
