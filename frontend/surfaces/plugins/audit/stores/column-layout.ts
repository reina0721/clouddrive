import { parseAuditColumnLayoutPersisted } from '../src/column-layout-schema';
import { createPersistStore, createLocalStorage } from '@clouddrive/state-foundation';

/**
 * 审计日志列布局（audit 插件私有 store）。
 *
 * 与 users 列 store 职责一致但 ownership 独立（禁止跨插件共享私有 store）：
 * 单一 visibleOrder、独立 key、损坏记录在读取边界抛错。
 */

export type AuditColumnLayoutState = {
  visibleOrder: readonly string[] | null;
  saveVisibleOrder: (visibleOrder: readonly string[]) => void;
  resetVisibleOrder: () => void;
};

export type AuditColumnLayoutPersisted = {
  visibleOrder: readonly string[] | null;
};

export const useAuditColumnLayoutStore = createPersistStore<
  AuditColumnLayoutState,
  AuditColumnLayoutPersisted
>(
  (set) => ({
    visibleOrder: null,
    saveVisibleOrder: (visibleOrder) => set({ visibleOrder }),
    resetVisibleOrder: () => set({ visibleOrder: null }),
  }),
  {
    name: 'clouddrive.plugin.audit.column-layout',
    version: 1,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ visibleOrder }) => ({ visibleOrder }),
    migrate: parseAuditColumnLayoutPersisted,
    merge: (persisted, current) =>
      persisted === undefined
        ? current
        : { ...current, ...parseAuditColumnLayoutPersisted(persisted) },
  },
);
