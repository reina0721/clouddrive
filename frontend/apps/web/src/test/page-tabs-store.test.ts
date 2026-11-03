// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  PAGE_TABS_LIMIT,
  pushPageTab,
  usePageTabsStore,
  type PageTab,
} from '../state/use-page-tabs-store';

const base: PageTab = { pathname: '/a', title: 'A', activatedAt: 1_000 };

describe('页面标签 store（page-tabs，SET-005-002）', () => {
  beforeEach(() => {
    usePageTabsStore.setState({ tabs: [] });
  });

  it('pushPageTab：同 pathname 更新标题并保持访问顺序', () => {
    const next = pushPageTab([base, { pathname: '/b', title: 'B', activatedAt: 2_000 }], {
      pathname: '/a',
      title: 'A 更新',
      activatedAt: 3_000,
    });
    expect(next.map((tab) => tab.pathname)).toEqual(['/a', '/b']);
    expect(next[0]?.title).toBe('A 更新');
    expect(next[0]?.activatedAt).toBe(3_000);
  });

  it('上限截断（保留最近）', () => {
    let tabs: readonly PageTab[] = [];
    for (let i = 0; i < PAGE_TABS_LIMIT + 3; i += 1) {
      tabs = pushPageTab(tabs, { pathname: `/p-${i}`, title: `P${i}` }, PAGE_TABS_LIMIT);
    }
    expect(tabs).toHaveLength(PAGE_TABS_LIMIT);
    expect(tabs.at(-1)?.pathname).toBe(`/p-${PAGE_TABS_LIMIT + 2}`);
    expect(tabs[0]?.pathname).toBe('/p-3');
  });

  it('openTab/closeTab/closeAllTabs 行为', () => {
    const store = usePageTabsStore.getState();
    store.openTab({ pathname: '/a', title: 'A' });
    store.openTab({ pathname: '/b', title: 'B' });
    store.openTab({ pathname: '/a', title: 'A' });
    expect(usePageTabsStore.getState().tabs).toHaveLength(2);
    usePageTabsStore.getState().closeTab('/a');
    expect(usePageTabsStore.getState().tabs.map((t) => t.pathname)).toEqual(['/b']);
    usePageTabsStore.getState().closeAllTabs();
    expect(usePageTabsStore.getState().tabs).toHaveLength(0);
  });

  it('pruneTabs：过滤失效目标（restore 后不在当前入口集合的标签移除）', () => {
    const store = usePageTabsStore.getState();
    store.openTab({ pathname: '/valid-a', title: 'A' });
    store.openTab({ pathname: '/removed-page', title: 'Removed' });
    usePageTabsStore.getState().pruneTabs(new Set(['/valid-a']));
    expect(usePageTabsStore.getState().tabs.map((t) => t.pathname)).toEqual(['/valid-a']);
  });

  it('固定标签：置于最前、不可关闭、批量关闭保留固定项', () => {
    usePageTabsStore.setState({ tabs: [] });
    const store = usePageTabsStore.getState();
    store.openTab({ pathname: '/a', title: 'A' });
    store.openTab({ pathname: '/b', title: 'B' });
    store.openTab({ pathname: '/c', title: 'C' });
    usePageTabsStore.getState().setPinned('/b', true);
    expect(usePageTabsStore.getState().tabs.map((t) => t.pathname)).toEqual(['/b', '/a', '/c']);
    // 固定标签不可关闭。
    expect(usePageTabsStore.getState().closeTab('/b')).toBeNull();
    expect(usePageTabsStore.getState().tabs).toHaveLength(3);
    // "关闭其他"与"关闭全部"都保留固定项。
    usePageTabsStore.getState().closeOtherTabs('/a');
    expect(usePageTabsStore.getState().tabs.map((t) => t.pathname)).toEqual(['/b', '/a']);
    usePageTabsStore.getState().closeAllTabs();
    expect(usePageTabsStore.getState().tabs.map((t) => t.pathname)).toEqual(['/b']);
    // 取消固定后可关闭；重新打开同一 pathname 不丢失固定状态。
    usePageTabsStore.getState().openTab({ pathname: '/b', title: 'B2' });
    expect(usePageTabsStore.getState().tabs[0]?.pinned).toBe(true);
    usePageTabsStore.getState().setPinned('/b', false);
    expect(usePageTabsStore.getState().closeTab('/b')).toBe('/b');
    expect(usePageTabsStore.getState().tabs).toHaveLength(0);
  });

  it('关闭左侧/右侧：以目标标签为界，固定标签不受影响', () => {
    usePageTabsStore.setState({ tabs: [] });
    const store = usePageTabsStore.getState();
    for (const path of ['/a', '/b', '/c', '/d']) store.openTab({ pathname: path, title: path });
    usePageTabsStore.getState().setPinned('/a', true);
    usePageTabsStore.getState().closeTabsBeside('/c', 'left');
    expect(usePageTabsStore.getState().tabs.map((t) => t.pathname)).toEqual(['/a', '/c', '/d']);
    usePageTabsStore.getState().closeTabsBeside('/c', 'right');
    expect(usePageTabsStore.getState().tabs.map((t) => t.pathname)).toEqual(['/a', '/c']);
  });
});
