import { parseColumnLayoutPersisted } from '../src/column-layout-schema';
import { createPersistStore, createLocalStorage } from '@clouddrive/state-foundation';

/**
 * 列布局（page-archetypes 插件私有 store，SET-002-005 分片）。
 *
 * - 按稳定页面身份（pageId）保存列显隐/顺序覆盖值——"列表通过稳定页面/列 ID 管理
 *   覆盖值"；全局默认 = 未保存时全列可见、canonical 顺序；
 * - 恢复时过滤已退役列（不在当前列集合的 id 丢弃）+ 保留必要标识列；
 * - 显示开关由调用方判断（dataDisplay.rememberColumnLayout，本 store 不读偏好）；
 * - 独立持久化（key `clouddrive.page-archetypes.column-layout`），不混入设置记录。
 */

type PageColumnLayout = {
  /** 当前可见列的显示顺序（其余 = 隐藏；不含已退役 id）。 */
  visibleOrder: readonly string[];
  widths?: Readonly<Record<string, number>>;
  customVisibility?: boolean;
  /** 排序记忆（数据展示 → rememberSort；缺省 = 页面默认排序）。 */
  sort?: Readonly<{ columnId: string; direction: 'ascending' | 'descending' }>;
};

export type ColumnLayoutState = {
  /** pageId → 布局。 */
  layouts: Readonly<Record<string, PageColumnLayout>>;
  /** 保存某页布局。 */
  saveLayout: (pageId: string, layout: PageColumnLayout) => void;
  /** 恢复某页布局（合并进当前）。 */
  restoreLayout: (pageId: string, layout: PageColumnLayout) => void;
};

export type ColumnLayoutPersisted = {
  layouts: Readonly<Record<string, PageColumnLayout>>;
};

/**
 * 规整恢复布局：过滤已退役列；强制标识列保持在首位；返回的 visibleOrder 即"可见列
 * 集合"（保存序中缺失的 canonical 列 = 用户显式隐藏，不补回；无保存值 → 全列 canonical）。
 */
export function normalizeColumnLayout(
  canonical: readonly string[],
  savedOrder: readonly string[] | undefined,
  mandatory: ReadonlySet<string>,
): readonly string[] {
  if (!savedOrder || savedOrder.length === 0) return canonical;
  const known = new Set(canonical);
  const kept = [...new Set(savedOrder)].filter((id) => known.has(id) && !mandatory.has(id));
  const head = canonical.filter((id) => mandatory.has(id));
  return [...head, ...kept];
}

export const useColumnLayoutStore = createPersistStore<ColumnLayoutState, ColumnLayoutPersisted>(
  (set) => ({
    layouts: {},
    saveLayout: (pageId, layout) =>
      set((state) => ({ layouts: { ...state.layouts, [pageId]: layout } })),
    restoreLayout: (pageId, layout) =>
      set((state) => ({ layouts: { ...state.layouts, [pageId]: layout } })),
  }),
  {
    name: 'clouddrive.page-archetypes.column-layout',
    version: 2,
    skipHydration: true,
    storage: createLocalStorage(),
    partialize: ({ layouts }) => ({ layouts }),
    migrate: parseColumnLayoutPersisted,
    merge: (persisted, current) =>
      persisted === undefined ? current : { ...current, ...parseColumnLayoutPersisted(persisted) },
  },
);
