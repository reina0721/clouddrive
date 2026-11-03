import { createLocalStorage, createPersistStore } from '@clouddrive/state-foundation';

import { parseTodoPersisted } from '../src/todo-store-schema';
import { WORKSPACE_TODO_IDS } from '../src/workspace-data';

/**
 * workspace 插件私有待办 store（VP-06）。
 *
 * 决策链：
 * - 状态需要跨页面/刷新保持（"完成的待办"是 durable 用户动作）→ state-foundation persist；
 * - 只持久化 `completedIds` 白名单；warning / UI 状态是 transient，不进入 storage；
 * - `skipHydration: true`：Next 预渲染与首次客户端渲染一致，页面在 effect 里显式 rehydrate；
 * - 读入时做结构校验：损坏记录回退默认值并给出非阻塞 warning，**不覆盖原记录**
 *   （`merge` 走 zustand 内部 set，不触发持久化写入；只有用户下一次 toggle/reset 才写回）。
 *   storage 读取失败（非法 JSON / localStorage 不可用）由 hydration lifecycle 暴露，
 *   页面用 `createHydrationLifecycle().status === 'error'` 呈现，同样不写回。
 */

export type WorkspaceTodoWarning = 'invalid-record' | 'unknown-items';

export type WorkspaceTodoState = {
  completedIds: readonly string[];
  warning: WorkspaceTodoWarning | null;
  toggleTodo: (id: string) => void;
  resetTodos: () => void;
};

export type WorkspaceTodoPersisted = {
  completedIds: readonly string[];
};

export const WORKSPACE_TODO_STORAGE_KEY = 'clouddrive.plugin.workspace';
export const WORKSPACE_TODO_STORAGE_VERSION = 1;

const KNOWN_TODO_IDS: readonly string[] = WORKSPACE_TODO_IDS;

export const useWorkspaceTodoStore = createPersistStore<WorkspaceTodoState, WorkspaceTodoPersisted>(
  (set) => ({
    completedIds: [],
    warning: null,
    toggleTodo: (id) =>
      set((state) => {
        if (!KNOWN_TODO_IDS.includes(id)) return {};
        const completed = state.completedIds.includes(id);
        return {
          completedIds: completed
            ? state.completedIds.filter((entry) => entry !== id)
            : [...state.completedIds, id],
        };
      }),
    resetTodos: () => set({ completedIds: [], warning: null }),
  }),
  {
    name: WORKSPACE_TODO_STORAGE_KEY,
    version: WORKSPACE_TODO_STORAGE_VERSION,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ completedIds }) => ({ completedIds }),
    migrate: (persistedState) => {
      // 版本漂移时同样先校验：结构损坏 → 抛错交给 hydration lifecycle（默认值生效，不写回）。
      const parsed = parseTodoPersisted(persistedState, KNOWN_TODO_IDS);
      if (!parsed.ok) throw new Error('workspace todo store: persisted record is invalid');
      return { completedIds: parsed.completedIds };
    },
    merge: (persistedState, currentState) => {
      if (persistedState === undefined) return currentState;
      const parsed = parseTodoPersisted(persistedState, KNOWN_TODO_IDS);
      if (!parsed.ok) {
        return { ...currentState, completedIds: [], warning: 'invalid-record' as const };
      }
      return {
        ...currentState,
        completedIds: parsed.completedIds,
        warning: parsed.unknownIds.length > 0 ? ('unknown-items' as const) : null,
      };
    },
  },
);
