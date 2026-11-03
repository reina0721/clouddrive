import { beforeEach, describe, expect, it } from 'vitest';

import {
  pushRecent,
  RECENTS_LIMIT,
  toggleFavoriteIn,
  useWorkbenchStore,
  type RecentEntry,
} from '../state/use-workbench-store';

const base: RecentEntry = { pathname: '/a', title: 'A', visitedAt: 1_000 };

describe('useWorkbenchStore（收藏/最近，SET-005-004）', () => {
  beforeEach(() => {
    useWorkbenchStore.setState({
      recents: [],
      favorites: [],
      rememberRecents: true,
      rememberFavorites: true,
    });
  });

  it('pushRecent：同 pathname 去重前移，更新时间戳', () => {
    const next = pushRecent([base, { pathname: '/b', title: 'B', visitedAt: 2_000 }], {
      pathname: '/a',
      title: 'A',
      visitedAt: 3_000,
    });
    expect(next.map((e) => e.pathname)).toEqual(['/a', '/b']);
    expect(next[0]?.visitedAt).toBe(3_000);
  });

  it('pushRecent：LRU 上限截断（保留最近）', () => {
    let recents: readonly RecentEntry[] = [];
    for (let i = 0; i < RECENTS_LIMIT + 5; i += 1) {
      recents = pushRecent(recents, { pathname: `/p${i}`, title: `P${i}`, visitedAt: i });
    }
    expect(recents).toHaveLength(RECENTS_LIMIT);
    expect(recents[0]?.pathname).toBe(`/p${RECENTS_LIMIT + 4}`); // 最近在前
    expect(recents.every((e) => e.pathname !== '/p0')).toBe(true); // 最旧被淘汰
  });

  it('toggleFavoriteIn：未收藏 → 前置；已收藏 → 移除', () => {
    const added = toggleFavoriteIn([], { pathname: '/a', title: 'A' });
    expect(added).toHaveLength(1);
    const removed = toggleFavoriteIn(added, { pathname: '/a', title: 'A' });
    expect(removed).toHaveLength(0);
  });

  it('recordVisit：记录最近访问（rememberRecents 开）', () => {
    useWorkbenchStore.getState().recordVisit({ pathname: '/settings', title: '设置' });
    useWorkbenchStore.getState().recordVisit({ pathname: '/settings', title: '设置' });
    const recents = useWorkbenchStore.getState().recents;
    expect(recents).toHaveLength(1); // 去重
    expect(recents[0]?.pathname).toBe('/settings');
  });

  it('recordVisit：rememberRecents 关 → 停止记录但不删除已有', () => {
    useWorkbenchStore.getState().recordVisit({ pathname: '/a', title: 'A' });
    useWorkbenchStore.getState().setRememberRecents(false);
    useWorkbenchStore.getState().recordVisit({ pathname: '/b', title: 'B' });
    const recents = useWorkbenchStore.getState().recents;
    expect(recents.map((e) => e.pathname)).toEqual(['/a']); // b 未记录，a 保留
  });

  it('toggleFavorite/isFavorite：关闭记录后不新增，已有保留', () => {
    useWorkbenchStore.getState().toggleFavorite({ pathname: '/a', title: 'A' });
    useWorkbenchStore.getState().setRememberFavorites(false);
    useWorkbenchStore.getState().toggleFavorite({ pathname: '/b', title: 'B' });
    const favorites = useWorkbenchStore.getState().favorites;
    expect(favorites.map((f) => f.pathname)).toEqual(['/a']);
    // 已收藏项仍可取消（用户主动移除不视为"新增"）。
    useWorkbenchStore.getState().toggleFavorite({ pathname: '/a', title: 'A' });
    expect(useWorkbenchStore.getState().favorites).toHaveLength(0);
  });
});
