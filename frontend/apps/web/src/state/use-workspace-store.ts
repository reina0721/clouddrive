import { createPersistStore, createLocalStorage } from '@clouddrive/state-foundation';
import type { PageState } from '@clouddrive/plugin-framework/workspace';

/**
 * Workspace Store（Host 拥有）—— 页面状态/本地草稿持久层（SET-006-002）。
 * 纯持久层：records + setRecords/clear；保存/恢复/冲突判定等策略在 Host
 * workspace-port.ts（读 getState 后写 setRecords，避免初始化自引用）。
 * 独立 Store（key `clouddrive.workspace`），不混入设置记录。
 */
type WorkspaceState = {
  records: Readonly<Record<string, PageState<string>>>;
  /** hydration 完成标记（RuntimeProviders 门控：children 在 workspace 就绪后才渲染）。 */
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  /** 整体写入（adapter 计算后提交）。 */
  setRecords: (records: Readonly<Record<string, PageState<string>>>) => void;
  clearPageState: (pageId: string) => void;
};

type WorkspacePersisted = {
  records: Readonly<Record<string, PageState<string>>>;
};

export const useWorkspaceStore = createPersistStore<WorkspaceState, WorkspacePersisted>(
  (set) => ({
    records: {},
    hasHydrated: false,
    setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    setRecords: (records) => set({ records }),
    clearPageState: (pageId) =>
      set((state) => {
        const next = { ...state.records };
        delete next[pageId];
        return { records: next };
      }),
  }),
  {
    name: 'clouddrive.workspace',
    version: 1,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ records }) => ({ records }),
    onRehydrateStorage: () => (_state, error) => {
      // 损坏记录 → hydration 完成 + 空 records（呈现层可见原因）；正常 → 完成。
      useWorkspaceStore.setState({ hasHydrated: true });
      void error;
    },
    migrate: (persisted) => {
      if (typeof persisted !== 'object' || persisted === null) {
        throw new Error('workspace: 记录损坏');
      }
      const record = persisted as Partial<WorkspacePersisted>;
      const records: Record<string, PageState<string>> = {};
      if (record.records && typeof record.records === 'object') {
        for (const [pageId, state] of Object.entries(record.records)) {
          if (
            state &&
            typeof state.pageId === 'string' &&
            typeof state.version === 'number' &&
            state.pageId === pageId
          ) {
            records[pageId] = state;
          }
        }
      }
      return { records };
    },
  },
);
