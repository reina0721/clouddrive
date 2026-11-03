import { convertRegistryToShellNavigation } from '@clouddrive/surface/shell';
import { generatedSurfaceRegistry } from '@clouddrive/surface/generated/composition';
import type { NavigationGroup } from '@clouddrive/types';

/**
 * Plugin Navigation Bridge（本阶段最小实现）。
 *
 * 从 Registry resolved model 生成 Shell 可消费的 NavigationGroup，并在应用 Shell
 * 组装处与静态 Shell Navigation 合并。完整 Shell（Sidebar 重组、Breadcrumb、
 * Command、Permission 呈现）推迟到 Migration Phase。
 */
export function createPluginNavigationGroups(): readonly NavigationGroup[] {
  return convertRegistryToShellNavigation(generatedSurfaceRegistry);
}
