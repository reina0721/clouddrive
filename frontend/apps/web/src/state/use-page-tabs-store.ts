import { createPersistStore, createSessionStorage } from '@clouddrive/state-foundation';

/**
 * Host —— Page Tabs Store（SET-005-002）。
 *
 * 顶部页面标签（= 页面入口；不缓存 React 页面树）。会话级持久化
 * （key `clouddrive.page-tabs`，sessionStorage —— 页签属于当前窗口活动状态，
 * 不跨窗口/跨启动恢复；restoreLastTabs 只在本窗口刷新时恢复）。
 *
 * - 页面身份由 pathname（Route Target 语义；筛选/排序变化不创建重复标签）；
 * - 标签保持访问顺序；activatedAt 用于关闭后的最近激活策略；
 * - 关闭当前标签后跳转由调用方按 tabCloseBehavior 决定。
 */
export const PAGE_TABS_LIMIT = 12;

export type PageTab = Readonly<{
  pathname: string;
  href?: string;
  title: string;
  activatedAt: number;
  /** 固定标签：恒在最前、不随"关闭其他/全部"关闭，关闭按钮隐藏（可显式取消固定）。 */
  pinned?: boolean;
}>;

type PageTabsState = {
  tabs: readonly PageTab[];
  /** 打开标签（页面入口提交时；同 pathname 更新目标与时间戳，保持访问顺序）。 */
  openTab: (entry: { pathname: string; href?: string; title: string }) => void;
  /** 关闭标签；固定标签不关闭（返回 null 表示被拒绝）。 */
  closeTab: (pathname: string) => string | null;
  /** 关闭全部可关闭标签（保留固定标签）。 */
  closeAllTabs: () => void;
  /** 关闭某一侧的可关闭标签（以 pathname 为界，保留固定标签）。 */
  closeTabsBeside: (pathname: string, side: 'left' | 'right') => void;
  /** 关闭除 pathname 与固定标签以外的标签。 */
  closeOtherTabs: (pathname: string) => void;
  /** 固定/取消固定（固定后移到列表最前，保持固定组内相对顺序）。 */
  setPinned: (pathname: string, pinned: boolean) => void;
  /** 清空会话标签（restoreLastTabs=false 时挂载清空，包括固定标签）。 */
  resetTabs: () => void;
  /** 过滤失效目标（restore 后不在当前导航入口集合的标签移除）。 */
  pruneTabs: (validPathnames: ReadonlySet<string>) => void;
};

type PageTabsPersisted = {
  tabs: readonly PageTab[];
};

/** 固定标签在前、其余保持访问顺序。 */
function orderTabs(tabs: readonly PageTab[]): readonly PageTab[] {
  return [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)];
}

export function pushPageTab(
  tabs: readonly PageTab[],
  entry: { pathname: string; href?: string; title: string; activatedAt?: number },
  limit = PAGE_TABS_LIMIT,
): readonly PageTab[] {
  const activatedAt = entry.activatedAt ?? Date.now();
  const existing = tabs.find((tab) => tab.pathname === entry.pathname);
  const current = {
    pathname: entry.pathname,
    title: entry.title,
    ...(entry.href ? { href: entry.href } : {}),
    activatedAt,
    ...(existing?.pinned ? { pinned: true } : {}),
  };
  const next = existing
    ? tabs.map((tab) => (tab.pathname === entry.pathname ? current : tab))
    : [...tabs, current];
  const ordered = orderTabs(next);
  // 固定标签不因数量上限被驱逐：先保留固定组，再取最近的非固定标签。
  const pinned = ordered.filter((tab) => tab.pinned);
  const others = ordered.filter((tab) => !tab.pinned);
  const room = Math.max(0, limit - pinned.length);
  return [...pinned, ...others.slice(-room)];
}

export const usePageTabsStore = createPersistStore<PageTabsState, PageTabsPersisted>(
  (set) => ({
    tabs: [],
    openTab: (entry) => set((state) => ({ tabs: pushPageTab(state.tabs, entry) })),
    closeTab: (pathname) => {
      const target = usePageTabsStore.getState().tabs.find((tab) => tab.pathname === pathname);
      if (!target || target.pinned) return null;
      set((state) => ({ tabs: state.tabs.filter((tab) => tab.pathname !== pathname) }));
      return pathname;
    },
    closeAllTabs: () => set((state) => ({ tabs: state.tabs.filter((tab) => tab.pinned) })),
    resetTabs: () => set({ tabs: [] }),
    closeTabsBeside: (pathname, side) =>
      set((state) => {
        const index = state.tabs.findIndex((tab) => tab.pathname === pathname);
        if (index < 0) return state;
        return {
          tabs: state.tabs.filter((tab, tabIndex) => {
            if (tab.pinned) return true;
            return side === 'left' ? tabIndex >= index : tabIndex <= index;
          }),
        };
      }),
    closeOtherTabs: (pathname) =>
      set((state) => ({
        tabs: state.tabs.filter((tab) => tab.pinned || tab.pathname === pathname),
      })),
    setPinned: (pathname, pinned) =>
      set((state) => ({
        tabs: orderTabs(
          state.tabs.map((tab) => (tab.pathname === pathname ? { ...tab, pinned } : tab)),
        ),
      })),
    pruneTabs: (validPathnames) =>
      set((state) => ({
        tabs: state.tabs.filter((tab) => validPathnames.has(tab.pathname)),
      })),
  }),
  {
    name: 'clouddrive.page-tabs',
    version: 2,
    skipHydration: true,
    storage: createSessionStorage(),
    partialize: ({ tabs }) => ({ tabs }),
    migrate: (persisted) => {
      if (typeof persisted !== 'object' || persisted === null) {
        throw new Error('page-tabs: 记录损坏');
      }
      const record = persisted as Partial<PageTabsPersisted>;
      const tabs = Array.isArray(record.tabs)
        ? (record.tabs as readonly PageTab[]).filter(
            (tab) =>
              tab &&
              typeof tab.pathname === 'string' &&
              typeof tab.title === 'string' &&
              typeof tab.activatedAt === 'number',
          )
        : [];
      return {
        tabs: tabs.map((tab) => ({
          pathname: tab.pathname,
          title: tab.title,
          activatedAt: tab.activatedAt,
          ...(typeof tab.href === 'string' && tab.href.startsWith(tab.pathname + '?')
            ? { href: tab.href }
            : {}),
        })),
      };
    },
  },
);
