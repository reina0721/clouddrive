/**
 * Host —— Workbench Port 实现（composition root 装配）。
 *
 * 把 `@clouddrive/plugin-framework/workbench` 契约接到 Host workbench store
 * （use-workbench-store.ts）。Plugin 经 Port 读收藏/最近 + 切换收藏；记录最近访问
 * 由 Host 导航 commit（recent-visit-recorder）负责，不开放给 Plugin 写。
 */
import type { WorkbenchPort } from '@clouddrive/plugin-framework/workbench';
import { useWorkbenchStore } from '../state/use-workbench-store';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** 创建 Workbench Port（Host composition root 单次调用）。 */
export function createHostWorkbenchPort(): WorkbenchPort {
  return {
    listRecents: () => useWorkbenchStore.getState().recents,
    listFavorites: () => useWorkbenchStore.getState().favorites,
    isFavorite: (pathname) =>
      useWorkbenchStore.getState().favorites.some((favorite) => favorite.pathname === pathname),
    toggleFavorite: (entry) => {
      const wasFavorite = useWorkbenchStore
        .getState()
        .favorites.some((favorite) => favorite.pathname === entry.pathname);
      useWorkbenchStore.getState().toggleFavorite(entry);
      emit();
      return !wasFavorite;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** 测试辅助：清空订阅。 */
export function resetHostWorkbenchForTest(): void {
  listeners.clear();
}
