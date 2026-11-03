import { createPersistStore, createLocalStorage } from '@clouddrive/state-foundation';

/**
 * 搜索历史（page-archetypes 插件私有 store，SET-006-001）。
 *
 * - 独立持久化（key `clouddrive.page-archetypes.search-history`），不混入设置记录；
 * - 最近在前，去重（同词前移），上限固定；
 * - 记录开关（操作偏好 rememberSearchHistory）由调用方判断（本 store 不读偏好）；
 * - 提供独立 clear（"清空搜索历史"为明确动作，不随关闭记忆删除）。
 */
export const SEARCH_HISTORY_LIMIT = 8;

export type SearchHistoryEntry = Readonly<{
  term: string;
  searchedAt: number;
}>;

type SearchHistoryState = {
  entries: readonly SearchHistoryEntry[];
  record: (term: string) => void;
  clear: () => void;
};

type SearchHistoryPersisted = {
  entries: readonly SearchHistoryEntry[];
};

/** 记录：同词去重前移；空词忽略。 */
export function pushSearchEntry(
  entries: readonly SearchHistoryEntry[],
  term: string,
  now = Date.now(),
  limit = SEARCH_HISTORY_LIMIT,
): readonly SearchHistoryEntry[] {
  const trimmed = term.trim();
  if (trimmed === '') return entries;
  const withoutCurrent = entries.filter((entry) => entry.term !== trimmed);
  return [{ term: trimmed, searchedAt: now }, ...withoutCurrent].slice(0, limit);
}

export const useSearchHistoryStore = createPersistStore<SearchHistoryState, SearchHistoryPersisted>(
  (set) => ({
    entries: [],
    record: (term) => set((state) => ({ entries: pushSearchEntry(state.entries, term) })),
    clear: () => set({ entries: [] }),
  }),
  {
    name: 'clouddrive.page-archetypes.search-history',
    version: 1,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ entries }) => ({ entries }),
    migrate: (persisted) => {
      if (typeof persisted !== 'object' || persisted === null) {
        throw new Error('search-history: 记录损坏');
      }
      const record = persisted as Partial<SearchHistoryPersisted>;
      const entries = Array.isArray(record.entries)
        ? (record.entries as readonly SearchHistoryEntry[]).filter(
            (entry) =>
              entry && typeof entry.term === 'string' && typeof entry.searchedAt === 'number',
          )
        : [];
      return { entries };
    },
  },
);
