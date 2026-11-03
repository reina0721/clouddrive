import { Table } from '@heroui/react/table';
import { Fragment, useEffect, useRef, useState, type Key, type ReactNode } from 'react';

export type DataColumn<Row> = Readonly<{
  id: string;
  label: string;
  rowHeader?: boolean;
  sortable?: boolean;
  render: (row: Row) => ReactNode;
}>;

export type DataTableSingleSelection = Readonly<{
  mode?: 'single';
  selectedId?: string;
  onSelectionChange: (id: string) => void;
}>;

export type DataTableMultiSelection = Readonly<{
  mode: 'multiple';
  selectedIds: readonly string[];
  onSelectionChange: (ids: readonly string[]) => void;
}>;

export type DataTableSelection = DataTableSingleSelection | DataTableMultiSelection;

export type DataTableSort = Readonly<{
  columnId: string;
  direction: 'ascending' | 'descending';
  onSortChange: (columnId: string, direction: 'ascending' | 'descending') => void;
}>;

/** 三档行密度：与产品偏好 `dataDisplay.tableDensity` 一一对应。 */
export type DataTableDensity = 'compact' | 'standard' | 'comfortable';

/**
 * 树形行契约：`rows` 保持扁平（顶层行），子行由 `childrenOf` 派生，
 * 展开状态由调用方拥有（URL/本地状态自选）。行头单元格内渲染 chevron + 缩进。
 */
export type DataTableTree<Row extends Readonly<{ id: string }>> = Readonly<{
  expandedIds: ReadonlySet<string>;
  onExpandedChange: (ids: ReadonlySet<string>) => void;
  childrenOf: (row: Row) => readonly Row[];
  /** 覆盖层级深度（缺省按展开遍历计算，根为 0）。 */
  depthOf?: (row: Row) => number;
  /** 展开动作的可访问名称（按行给出，避免硬编码文案）。 */
  expandLabel: (row: Row) => string;
  /** 收起动作的可访问名称（按行给出）。 */
  collapseLabel: (row: Row) => string;
}>;

export type DataTableProps<Row extends Readonly<{ id: string }>> = Readonly<{
  label: string;
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  emptyContent: ReactNode;
  density?: DataTableDensity;
  /** 行分隔/边界（默认开；settings 数据展示 → rowSeparators 消费）。 */
  rowSeparators?: boolean;
  /** 固定表头（默认开；settings 数据展示 → stickyHeader 消费）。 */
  stickyHeader?: boolean;
  /**
   * 固定列 id：按当前列顺序从左到右 sticky。列宽优先取 `columnWidths`，
   * 缺省时测量表头实际渲染宽度（sticky 偏移是几何量，不是设计 Token）。
   */
  pinnedColumnIds?: readonly string[];
  /**
   * 树形行：行头单元格内提供 chevron、`aria-expanded` 与层级缩进。
   * 行上额外输出 `data-tree-depth`（0 = 根）供样式与测试消费；不写 `aria-level`
   *（表格 role 为 `grid`，`aria-level` 只对 treegrid 行合法）。
   */
  tree?: DataTableTree<Row>;
  /** 空数据渲染辅助说明（默认开；settings 数据展示 → emptyStateHint 消费）。 */
  emptyStateHint?: boolean;
  selection?: DataTableSelection;
  sort?: DataTableSort;
  columnWidths?: Readonly<Record<string, number>>;
  onColumnWidthsChange?: (widths: Readonly<Record<string, number>>) => void;
}>;

const cellSpacingByDensity: Readonly<Record<DataTableDensity, string>> = {
  compact: 'px-3 py-2',
  standard: 'px-4 py-3',
  comfortable: 'px-4 py-3.5',
};

/** 层级缩进步长（几何量，随深度计算，不是设计 Token）。 */
const TREE_DEPTH_STEP = 16;

type RowEntry<Row> = Readonly<{ row: Row; depth: number; expandable: boolean }>;

/** 按展开状态展开扁平行；`childrenOf` 提供子行，避免调用方预展开整棵树。 */
function collectRowEntries<Row extends Readonly<{ id: string }>>(
  rows: readonly Row[],
  tree: DataTableTree<Row> | undefined,
): readonly RowEntry<Row>[] {
  if (!tree) return rows.map((row) => ({ row, depth: 0, expandable: false }));
  const entries: RowEntry<Row>[] = [];
  const visited = new Set<string>();
  const visit = (row: Row, computedDepth: number) => {
    if (visited.has(row.id)) return;
    visited.add(row.id);
    const children = tree.childrenOf(row);
    entries.push({
      row,
      depth: tree.depthOf ? tree.depthOf(row) : computedDepth,
      expandable: children.length > 0,
    });
    if (children.length === 0 || !tree.expandedIds.has(row.id)) return;
    for (const child of children) visit(child, computedDepth + 1);
  };
  for (const row of rows) visit(row, 0);
  return entries;
}

/** 展开/折叠 chevron：与 Tree 相同的项目内联 svg（ui-adapter 无第三方 icon 依赖）。 */
function DataTableChevron({ expanded }: Readonly<{ expanded: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m6 4 4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function DataTable<Row extends Readonly<{ id: string }>>({
  label,
  columns,
  rows,
  emptyContent,
  density = 'comfortable',
  rowSeparators = true,
  stickyHeader = true,
  pinnedColumnIds,
  tree,
  emptyStateHint = true,
  selection,
  sort,
  columnWidths,
  onColumnWidthsChange,
}: DataTableProps<Row>) {
  const [resizingWidths, setResizingWidths] = useState<Readonly<Record<string, number>> | null>(
    null,
  );
  const [measuredWidths, setMeasuredWidths] = useState<Readonly<Record<string, number>>>({});
  const pinnedHeaderRefs = useRef(new Map<string, HTMLTableCellElement>());
  const readWidths = (widths: ReadonlyMap<Key, number | string>) => {
    const next: Record<string, number> = {};
    for (const [id, width] of widths) {
      if (typeof width === 'number' && Number.isFinite(width)) next[String(id)] = width;
    }
    return next;
  };
  const widthProps = (id: string): Readonly<{ width?: number }> => {
    const width = (resizingWidths ?? columnWidths)?.[id];
    return width !== undefined ? { width } : {};
  };
  const ResizableContainer = onColumnWidthsChange ? Table.ResizableContainer : Fragment;
  const cellSpacing = cellSpacingByDensity[density];
  const pinnedIds = pinnedColumnIds ?? [];
  const pinnedSet = new Set(pinnedIds);
  const pinnedKey = pinnedIds.join('|');

  // 固定列偏移必须由真实列宽累加（几何量）。显式列宽优先，否则订阅表头尺寸变化：
  // ResizeObserver 是外部布局系统的订阅，测量结果只在尺寸真正变化时回写 state。
  useEffect(() => {
    if (pinnedKey === '') return;
    if (typeof ResizeObserver === 'undefined') return;
    const ids = pinnedKey.split('|');
    const elements = ids.flatMap((id) => {
      const element = pinnedHeaderRefs.current.get(id);
      return element ? [element] : [];
    });
    if (elements.length === 0) return;
    const measure = () => {
      setMeasuredWidths((previous) => {
        let changed = false;
        const next: Record<string, number> = { ...previous };
        for (const id of ids) {
          const element = pinnedHeaderRefs.current.get(id);
          if (!element) continue;
          const width = element.getBoundingClientRect().width;
          if (previous[id] !== width) {
            next[id] = width;
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    };
    const observer = new ResizeObserver(measure);
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [pinnedKey, density, columnWidths]);
  const pinnedOffsets: Record<string, number> = {};
  if (pinnedIds.length > 0) {
    let offset = 0;
    for (const column of columns) {
      if (!pinnedSet.has(column.id)) continue;
      pinnedOffsets[column.id] = offset;
      offset += columnWidths?.[column.id] ?? measuredWidths[column.id] ?? 0;
    }
  }
  const rowEntries = collectRowEntries(rows, tree);
  const selectedIds = selection
    ? selection.mode === 'multiple'
      ? selection.selectedIds
      : selection.selectedId
        ? [selection.selectedId]
        : []
    : [];
  const toggleExpanded = (row: Row) => {
    if (!tree) return;
    const next = new Set(tree.expandedIds);
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    tree.onExpandedChange(next);
  };
  /**
   * 行层级只暴露为 `data-tree-depth`（展开遍历深度，0 为根）：
   * React Aria 的 Row 不转发 `aria-level`，而表格 role 是 `grid`，
   * `aria-level` 仅在 `treegrid` 行合法（axe aria-conditional-attr 会判定违规）。
   * 层级信息由行头缩进 + chevron `aria-expanded` 表达；需要 treegrid 语义时
   * 应由调用方使用独立的 Tree 组件，而不是给 grid 行塞 treegrid 属性。
   */
  const renderRowHeader = (column: DataColumn<Row>, entry: RowEntry<Row>) => {
    const content = column.render(entry.row);
    if (!tree) return content;
    const expanded = tree.expandedIds.has(entry.row.id);
    return (
      <div
        className="flex min-w-0 items-start gap-2"
        style={{ paddingInlineStart: entry.depth * TREE_DEPTH_STEP }}
      >
        {entry.expandable ? (
          <button
            aria-expanded={expanded}
            aria-label={expanded ? tree.collapseLabel(entry.row) : tree.expandLabel(entry.row)}
            className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-control text-ink-muted outline-none transition-colors hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded(entry.row);
            }}
            type="button"
          >
            <DataTableChevron expanded={expanded} />
          </button>
        ) : (
          <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">{content}</div>
      </div>
    );
  };
  return (
    <Table>
      <Table.ScrollContainer className="min-w-0 overflow-auto" data-table-scroll-container>
        <ResizableContainer
          {...(onColumnWidthsChange
            ? {
                onResize: (widths: ReadonlyMap<Key, number | string>) =>
                  setResizingWidths(readWidths(widths)),
                onResizeEnd: (widths: ReadonlyMap<Key, number | string>) => {
                  onColumnWidthsChange(readWidths(widths));
                  setResizingWidths(null);
                },
              }
            : {})}
        >
          <Table.Content
            aria-label={label}
            className="min-w-full border-separate border-spacing-0 text-left text-sm"
            {...(selection
              ? {
                  selectionMode:
                    selection.mode === 'multiple' ? ('multiple' as const) : ('single' as const),
                  selectionBehavior:
                    selection.mode === 'multiple' ? ('toggle' as const) : ('replace' as const),
                  disallowEmptySelection:
                    selection.mode !== 'multiple' && Boolean(selection.selectedId),
                  selectedKeys: new Set(selectedIds),
                  onSelectionChange: (keys: 'all' | Set<Key>) => {
                    if (selection.mode === 'multiple') {
                      selection.onSelectionChange(
                        keys === 'all' ? rows.map((row) => row.id) : [...keys].map(String),
                      );
                      return;
                    }
                    if (keys === 'all') return;
                    const selectedKey = keys.values().next().value;
                    if (selectedKey !== undefined) selection.onSelectionChange(String(selectedKey));
                  },
                }
              : {})}
            {...(sort
              ? {
                  sortDescriptor: { column: sort.columnId, direction: sort.direction },
                  onSortChange: (descriptor: {
                    column: Key;
                    direction: 'ascending' | 'descending';
                  }) => sort.onSortChange(String(descriptor.column), descriptor.direction),
                }
              : {})}
          >
            <Table.Header>
              {columns.map((column) => {
                const pinned = pinnedSet.has(column.id);
                return (
                  <Table.Column
                    className={`${cellSpacing} ${stickyHeader || pinned ? 'sticky' : ''} ${stickyHeader ? 'top-0' : ''} ${pinned ? 'z-20 border-r border-border' : ''} border-b border-border bg-surface-muted text-xs font-bold uppercase tracking-wider text-ink`}
                    {...widthProps(column.id)}
                    {...(pinned
                      ? {
                          ref: (element: HTMLTableCellElement | null) => {
                            if (element) pinnedHeaderRefs.current.set(column.id, element);
                            else pinnedHeaderRefs.current.delete(column.id);
                          },
                        }
                      : {})}
                    id={column.id}
                    key={column.id}
                    {...(pinned ? { style: { left: pinnedOffsets[column.id] ?? 0 } } : {})}
                    {...(column.sortable ? { allowsSorting: true } : {})}
                    {...(column.rowHeader ? { isRowHeader: true } : {})}
                  >
                    {({ sortDirection }) => (
                      <>
                        <Table.SortableColumnHeader {...(sortDirection ? { sortDirection } : {})}>
                          {column.label}
                        </Table.SortableColumnHeader>
                        {onColumnWidthsChange ? (
                          <Table.ColumnResizer className="translate-x-0" />
                        ) : null}
                      </>
                    )}
                  </Table.Column>
                );
              })}
            </Table.Header>
            <Table.Body
              renderEmptyState={
                emptyStateHint
                  ? () => (
                      <div className="px-4 py-10 text-center text-sm text-ink-muted">
                        {emptyContent}
                      </div>
                    )
                  : () => null
              }
            >
              {rowEntries.map((entry) => (
                <Table.Row
                  className={selection ? 'cursor-pointer' : 'cursor-default'}
                  id={entry.row.id}
                  key={entry.row.id}
                  {...(tree ? ({ 'data-tree-depth': entry.depth } as Record<string, number>) : {})}
                >
                  {columns.map((column) => {
                    const pinned = pinnedSet.has(column.id);
                    return (
                      <Table.Cell
                        className={`${cellSpacing} ${rowSeparators ? 'border-b border-border' : ''} ${pinned ? 'sticky z-10 border-r border-border bg-surface' : ''} align-middle text-ink`}
                        key={column.id}
                        {...(pinned ? { style: { left: pinnedOffsets[column.id] ?? 0 } } : {})}
                      >
                        {column.rowHeader
                          ? renderRowHeader(column, entry)
                          : column.render(entry.row)}
                      </Table.Cell>
                    );
                  })}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </ResizableContainer>
      </Table.ScrollContainer>
    </Table>
  );
}
