import { parseUsersColumnLayoutPersisted } from '../src/column-layout-schema';
import { createPersistStore, createLocalStorage } from '@clouddrive/state-foundation';

/**
 * 用户目录列布局（users 插件私有 store）。
 *
 * - 按登录用户 id 保存可见列顺序（同一浏览器多账号互不覆盖；不写服务端）；
 * - 恢复时由 `normalizeColumnLayout` 过滤退役列、必选列置首、丢弃未知 id；
 * - 未知/损坏记录在读取边界抛错（hydration lifecycle 记录失败），不静默接受；
 * - 独立持久化（key `clouddrive.plugin.users.column-layout`），不混入偏好记录。
 */

export type UsersColumnLayout = Readonly<{ visibleOrder: readonly string[] }>;

export type UsersColumnLayoutState = {
  /** userId → 列布局。 */
  layouts: Readonly<Record<string, UsersColumnLayout>>;
  saveLayout: (userId: string, layout: UsersColumnLayout) => void;
  /** 恢复默认（canonical 全列）：删除该用户的覆盖值。 */
  resetLayout: (userId: string) => void;
};

export type UsersColumnLayoutPersisted = {
  layouts: Readonly<Record<string, UsersColumnLayout>>;
};

export const useUsersColumnLayoutStore = createPersistStore<
  UsersColumnLayoutState,
  UsersColumnLayoutPersisted
>(
  (set) => ({
    layouts: {},
    saveLayout: (userId, layout) =>
      set((state) => ({ layouts: { ...state.layouts, [userId]: layout } })),
    resetLayout: (userId) =>
      set((state) => {
        const next = { ...state.layouts };
        delete next[userId];
        return { layouts: next };
      }),
  }),
  {
    name: 'clouddrive.plugin.users.column-layout',
    version: 1,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ layouts }) => ({ layouts }),
    migrate: parseUsersColumnLayoutPersisted,
    merge: (persisted, current) =>
      persisted === undefined
        ? current
        : { ...current, ...parseUsersColumnLayoutPersisted(persisted) },
  },
);
