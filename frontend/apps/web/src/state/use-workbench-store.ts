import { createPersistStore, createLocalStorage } from '@clouddrive/state-foundation';

/**
 * Workbench Store（Host 拥有）—— 收藏与最近访问（SET-005-004）。
 *
 * - 独立 Store（key `clouddrive.workbench`），不混入设置记录（107 §2 持久化规则）；
 * - recents：LRU（最近在前），上限固定；带时间戳；
 * - favorites：稳定页面引用（resolved pathname + 记录时的标题），去重；
 * - 记录/显示开关分别由偏好字段控制（navigation.rememberRecents / showRecents /
 *   menuMemory 等），但 Store 自身只存数据；"关闭记录"停止后续写入（调用方判断），
 *   **不删除已有内容**。
 */
export const RECENTS_LIMIT = 12;

export type RecentEntry = Readonly<{
  /** resolved pathname（页面身份；不含 search/hash，避免筛选变化重复记录）。 */
  pathname: string;
  /** 记录时的展示标题（i18n 已解析）。 */
  title: string;
  /** 记录时间戳。 */
  visitedAt: number;
}>;

export type FavoriteEntry = Readonly<{
  pathname: string;
  title: string;
}>;

type WorkbenchState = {
  recents: readonly RecentEntry[];
  favorites: readonly FavoriteEntry[];
  /** 记录最近访问（供导航 commit 消费；默认开）。 */
  rememberRecents: boolean;
  /** 记录收藏（供首页/侧栏收藏操作消费；默认开）。 */
  rememberFavorites: boolean;
  recordVisit: (entry: { pathname: string; title: string }) => void;
  toggleFavorite: (entry: { pathname: string; title: string }) => void;
  setRememberRecents: (enabled: boolean) => void;
  setRememberFavorites: (enabled: boolean) => void;
};

type WorkbenchPersisted = {
  recents: readonly RecentEntry[];
  favorites: readonly FavoriteEntry[];
  rememberRecents: boolean;
  rememberFavorites: boolean;
};

/** LRU 插入：同 pathname 去重前移（更新时间戳）；超上限截断（保留最近）。 */
export function pushRecent(
  recents: readonly RecentEntry[],
  entry: { pathname: string; title: string; visitedAt?: number },
  limit = RECENTS_LIMIT,
): readonly RecentEntry[] {
  const visitedAt = entry.visitedAt ?? Date.now();
  const withoutCurrent = recents.filter((recent) => recent.pathname !== entry.pathname);
  const next = [{ pathname: entry.pathname, title: entry.title, visitedAt }, ...withoutCurrent];
  return next.slice(0, limit);
}

/** 收藏切换：已收藏 → 移除；未收藏 → 前置。 */
export function toggleFavoriteIn(
  favorites: readonly FavoriteEntry[],
  entry: { pathname: string; title: string },
): readonly FavoriteEntry[] {
  const exists = favorites.some((favorite) => favorite.pathname === entry.pathname);
  if (exists) return favorites.filter((favorite) => favorite.pathname !== entry.pathname);
  return [{ pathname: entry.pathname, title: entry.title }, ...favorites];
}

export const useWorkbenchStore = createPersistStore<WorkbenchState, WorkbenchPersisted>(
  (set) => ({
    recents: [],
    favorites: [],
    rememberRecents: true,
    rememberFavorites: true,
    recordVisit: ({ pathname, title }) =>
      set((state) => {
        if (!state.rememberRecents) return state; // 关闭记录：停止记录，不删已有
        return { recents: pushRecent(state.recents, { pathname, title }) };
      }),
    toggleFavorite: (entry) =>
      set((state) => {
        const exists = state.favorites.some((favorite) => favorite.pathname === entry.pathname);
        // 关闭记录：不新增；但用户显式移除已有收藏仍生效（不违背"不删已有"——
        // 那是关闭开关的被动语义，用户主动操作不受限）。
        if (!state.rememberFavorites && !exists) return state;
        return { favorites: toggleFavoriteIn(state.favorites, entry) };
      }),
    setRememberRecents: (rememberRecents) => set({ rememberRecents }),
    setRememberFavorites: (rememberFavorites) => set({ rememberFavorites }),
  }),
  {
    name: 'clouddrive.workbench',
    version: 1,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ recents, favorites, rememberRecents, rememberFavorites }) => ({
      recents,
      favorites,
      rememberRecents,
      rememberFavorites,
    }),
    migrate: (persisted) => {
      // v1 首版：仅接受形状正确的记录；未知版本/损坏走 hydration 失败语义。
      if (typeof persisted !== 'object' || persisted === null) {
        throw new Error('workbench: 记录损坏');
      }
      const record = persisted as Partial<WorkbenchPersisted>;
      const recents = Array.isArray(record.recents)
        ? (record.recents as readonly RecentEntry[]).filter(
            (entry) =>
              entry &&
              typeof entry.pathname === 'string' &&
              typeof entry.title === 'string' &&
              typeof entry.visitedAt === 'number',
          )
        : [];
      const favorites = Array.isArray(record.favorites)
        ? (record.favorites as readonly FavoriteEntry[]).filter(
            (entry) =>
              entry && typeof entry.pathname === 'string' && typeof entry.title === 'string',
          )
        : [];
      return {
        recents,
        favorites,
        rememberRecents: record.rememberRecents !== false,
        rememberFavorites: record.rememberFavorites !== false,
      };
    },
  },
);
