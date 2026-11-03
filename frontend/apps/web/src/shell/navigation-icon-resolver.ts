'use client';

import type { NavigationIconId } from '@clouddrive/surface/shell';
import { navigationIconVocabulary } from '@clouddrive/surface/shell';
import { navigationIconComponents } from '@clouddrive/surface/icon-components';
import { Circle, type LucideIcon } from 'lucide-react';

/**
 * Shell Navigation Icon Resolver —— 语义 iconId → 实际 Icon Component。
 *
 * iconId 是 Plugin Navigation Contribution 的可选 semantic presentation metadata。
 * 唯一 lucide 组件映射已下沉到 Surface presentation 模块
 * （surfaces/src/navigation-icon-presentation.tsx 的 navigationIconComponents），
 * 本 resolver 只做 presentation policy 选择：
 * - iconId === undefined → 统一 fallback（Circle）；
 * - 命中 vocabulary → 复用 Surface 唯一映射；
 * - 其它字符串 → deterministic throw（正常由 codegen gate / composition assert 前置拦截）。
 */

export const UNKNOWN_NAVIGATION_ICON = 'UNKNOWN_NAVIGATION_ICON';

/** 语义 iconId → 图标组件；未声明（undefined）→ 统一 fallback。 */
export function resolveNavigationIcon(iconId: string | undefined): LucideIcon {
  if (iconId === undefined) return Circle;
  const vocabulary = new Set<string>(navigationIconVocabulary);
  if (!vocabulary.has(iconId)) {
    throw new Error(
      `navigation.iconId 未命中 Product Surface icon vocabulary: ${iconId}（${UNKNOWN_NAVIGATION_ICON}）`,
    );
  }
  return navigationIconComponents[iconId as NavigationIconId] ?? Circle;
}
