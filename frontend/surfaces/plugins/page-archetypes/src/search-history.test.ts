// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  pushSearchEntry,
  SEARCH_HISTORY_LIMIT,
  useSearchHistoryStore,
  type SearchHistoryEntry,
} from '../stores/search-history';

const base: SearchHistoryEntry = { term: 'alpha', searchedAt: 1_000 };

describe('搜索历史 store（page-archetypes，SET-006-001）', () => {
  beforeEach(() => {
    useSearchHistoryStore.setState({ entries: [] });
  });

  it('pushSearchEntry：空词忽略；同词去重前移', () => {
    expect(pushSearchEntry([base], '   ')).toEqual([base]);
    const next = pushSearchEntry([base, { term: 'beta', searchedAt: 2_000 }], 'alpha', 3_000);
    expect(next.map((e) => e.term)).toEqual(['alpha', 'beta']);
    expect(next[0]?.searchedAt).toBe(3_000);
  });

  it('上限截断（保留最近）', () => {
    let entries: readonly SearchHistoryEntry[] = [];
    for (let i = 0; i < SEARCH_HISTORY_LIMIT + 4; i += 1) {
      entries = pushSearchEntry(entries, `term-${i}`, i);
    }
    expect(entries).toHaveLength(SEARCH_HISTORY_LIMIT);
    expect(entries[0]?.term).toBe(`term-${SEARCH_HISTORY_LIMIT + 3}`);
  });

  it('record/clear 行为', () => {
    const store = useSearchHistoryStore.getState();
    store.record('motion');
    store.record('motion');
    store.record('density');
    const entries = useSearchHistoryStore.getState().entries;
    expect(entries.map((e) => e.term)).toEqual(['density', 'motion']);
    useSearchHistoryStore.getState().clear();
    expect(useSearchHistoryStore.getState().entries).toHaveLength(0);
  });
});
