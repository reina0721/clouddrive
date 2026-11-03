'use client';

/* Provider 与订阅 Hook 同文件导出（Library/Adapter 边界，不是应用 Fast Refresh 边界）。 */
/* eslint-disable react-refresh/only-export-components */

import { readAuthConfig } from '../auth/config';
import { refreshServerNavigation, useServerNavigationStore } from '../state/use-server-navigation';
import type {
  NavigationAdminPort,
  NavigationAdminSnapshot,
} from '@clouddrive/plugin-framework/navigation-admin';
import { NavigationAdminProvider } from '@clouddrive/plugin-framework/navigation-admin';
import { rehydrateStore } from '@clouddrive/state-foundation';
import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import { useNavigationAdminStore } from '../state/use-navigation-admin-store';

/**
 * 快照缓存（模块级）：useSyncExternalStore 要求 getSnapshot 返回稳定引用，
 * 而每次新建对象会触发无限重渲染。缓存只随 store 的三个可见字段变化失效。
 */
let cachedSnapshot: NavigationAdminSnapshot | null = null;

function readNavigationAdminSnapshot(): NavigationAdminSnapshot {
  const state = useNavigationAdminStore.getState();
  const hydrated = !state.corrupt;
  if (
    cachedSnapshot &&
    cachedSnapshot.overrides === state.overrides &&
    cachedSnapshot.updatedAt === state.updatedAt &&
    cachedSnapshot.hydrated === hydrated
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = { overrides: state.overrides, updatedAt: state.updatedAt, hydrated };
  return cachedSnapshot;
}

/**
 * Host 装配 Navigation Administration Port（菜单管理的业务覆盖）。
 *
 * - 快照引用来自 zustand store（稳定），Port 的 selector 订阅不会产生新对象；
 * - `recover` 是显式用户动作：清除损坏记录后重新水合，不静默覆盖；
 * - Port 是 Plugin 访问 Host 状态的唯一入口（Plugin 不得 import Host store）。
 */
export function NavigationAdminPortProvider({ children }: Readonly<{ children: ReactNode }>) {
  useEffect(() => {
    const config = readAuthConfig();
    if (config.mode === 'backend') {
      void refreshServerNavigation(config.apiBaseUrl).catch(() => undefined);
      return;
    }
    rehydrateStore(useNavigationAdminStore);
  }, []);

  const port = useMemo<NavigationAdminPort>(() => {
    const read = () => useNavigationAdminStore.getState();
    return {
      getSnapshot: readNavigationAdminSnapshot,
      subscribe: (listener) => useNavigationAdminStore.subscribe(listener),
      update: (navigationId, patch, expectedVersion) =>
        read().update(navigationId, patch, expectedVersion),
      resetPresentation: (navigationId, expectedVersion) =>
        read().resetPresentation(navigationId, expectedVersion),
      clear: (navigationId, expectedVersion) => read().clear(navigationId, expectedVersion),
      clearAll: () => read().clearAll(),
      recover: () => {
        useNavigationAdminStore.persist.clearStorage();
        useNavigationAdminStore.setState({ overrides: {}, updatedAt: null, corrupt: false });
        rehydrateStore(useNavigationAdminStore);
      },
    };
  }, []);

  return <NavigationAdminProvider port={port}>{children}</NavigationAdminProvider>;
}

/** Shell 侧消费：同一份覆盖（引用随 store 更新）。 */
export function useNavigationOverrides() {
  const config = readAuthConfig();
  const backend = useServerNavigationStore((state) => state.overrides);
  const local = useSyncExternalStore(
    (listener) => useNavigationAdminStore.subscribe(listener),
    () => useNavigationAdminStore.getState().overrides,
    () => useNavigationAdminStore.getState().overrides,
  );
  return config.mode === 'backend' ? backend : local;
}
