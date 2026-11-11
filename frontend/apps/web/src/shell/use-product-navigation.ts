'use client';
import { useMemo } from 'react';
import { useProductAccess, useIdentityPort } from '@clouddrive/surface/identity/runtime';
import type { NavigationNode } from '@clouddrive/types';
import { useNavigationOverrides } from '../host/navigation-admin-port';
import { combinedShellNavigationGroups } from './navigation';

import { visibleProductNavigation } from './navigation-visibility';
import { refreshServerNavigation, useServerNavigationStore } from '../state/use-server-navigation';
import { readAuthConfig } from '../auth/config';

export function useProductNavigation() {
  const access = useProductAccess();
  const backend = useIdentityPort().mode === 'backend';
  const overrides = useNavigationOverrides();
  const ready = useServerNavigationStore((state) => state.ready);
  const failed = useServerNavigationStore((state) => state.failed);
  const groups = useMemo(
    () =>
      visibleProductNavigation(
        combinedShellNavigationGroups,
        overrides,
        backend,
        access.data?.permissions ?? [],
        access.data?.nativePermissions ?? [],
      ),
    [access.data, overrides, backend],
  );
  return {
    groups,
    status:
      access.loading || (backend && !ready && !failed)
        ? ('loading' as const)
        : access.error || (backend && failed)
          ? ('error' as const)
          : ('ready' as const),
    reload: () => {
      access.reload();
      const config = readAuthConfig();
      // 读取失败由同一状态仓库呈现；不将旧覆盖声明为最新结果。
      if (config.mode === 'backend')
        void refreshServerNavigation(config.apiBaseUrl).catch(() => undefined);
    },
  };
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
