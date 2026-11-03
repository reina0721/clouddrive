import { useId, useState, type ReactNode } from 'react';
import { Action } from '@clouddrive/ui-adapter/action';

import { Section } from './layout';

export function Collection({
  title,
  description,
  count,
  tools,
  query,
  bulk,
  toolbar,
  filters,
  content,
  narrowContent,
  pagination,
}: Readonly<{
  title: string;
  description?: string;
  count?: string | number;
  tools?: ReactNode;
  query?: ReactNode;
  bulk?: ReactNode;
  toolbar?: ReactNode;
  filters?: ReactNode;
  content: ReactNode;
  narrowContent?: ReactNode;
  pagination?: ReactNode;
}>) {
  const headerAction = tools ? <div className="flex items-center gap-2">{tools}</div> : undefined;

  const titleNode =
    count !== undefined ? (
      <div className="flex items-center gap-2">
        <span>{title}</span>
        <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-ink-muted">
          {count}
        </span>
      </div>
    ) : (
      title
    );

  return (
    <Section title={titleNode} action={headerAction} {...(description ? { description } : {})}>
      {query ? <div className="border-b border-border bg-surface-muted/50 p-3">{query}</div> : null}
      {bulk ? <div className="border-b border-border p-3">{bulk}</div> : null}
      {toolbar ? <div className="border-b border-border p-4">{toolbar}</div> : null}
      {filters ? <div className="border-b border-border p-4">{filters}</div> : null}
      <div className={narrowContent ? 'hidden min-w-0 md:block' : 'min-w-0'}>{content}</div>
      {narrowContent ? <div className="min-w-0 md:hidden">{narrowContent}</div> : null}
      {pagination ? <div className="border-t border-border p-4">{pagination}</div> : null}
    </Section>
  );
}

/** 已启用筛选项（chips）：label 即 chip 文本，onRemove 直接撤销该项。 */
export type CollectionActiveFilter = Readonly<{
  id: string;
  label: string;
  onRemove: () => void;
}>;

/** CollectionQuery 折叠展开 chevron（项目内联 svg，Surface Foundation 无 icon 依赖）。 */
function AdvancedChevron({ expanded }: Readonly<{ expanded: boolean }>) {
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

/** 移除筛选 chip 的关闭标记（视觉装饰，accessible name 由 chip 文本提供）。 */
function RemoveFilterGlyph() {
  return (
    <svg aria-hidden="true" className="size-3" fill="none" viewBox="0 0 12 12">
      <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * CollectionQuery —— 集合搜索 / 筛选 / 视图切换 / 高级筛选宿主。
 *
 * 高级区默认折叠；`activeFilters` 非空时默认展开。文本全部由调用方提供
 * （Foundation 不硬编码产品文案）。`advanced` 未提供 `advancedLabel` 时保持
 * 旧行为：直接内联渲染（向后兼容既有调用方）。
 */
export function CollectionQuery({
  search,
  filters,
  view,
  reset,
  label = '集合筛选与搜索',
  advanced,
  advancedLabel,
  advancedOpenLabel,
  advancedOpen,
  onAdvancedOpenChange,
  activeFilters,
  activeFiltersLabel,
  onResetFilters,
  resetFiltersLabel,
}: Readonly<{
  search?: ReactNode;
  filters?: ReactNode;
  view?: ReactNode;
  reset?: ReactNode;
  label?: string;
  /** 高级筛选内容（表单/字段组合）。 */
  advanced?: ReactNode;
  /** 高级筛选折叠标题（提供后才启用折叠区域）。 */
  advancedLabel?: string;
  /** 展开态标题（缺省沿用 advancedLabel）。 */
  advancedOpenLabel?: string;
  /** 受控展开态；缺省由组件内部维护。 */
  advancedOpen?: boolean;
  /** 展开态变化通知（受控与非受控都会调用）。 */
  onAdvancedOpenChange?: (open: boolean) => void;
  /** 已启用筛选项；非空时默认展开高级区。 */
  activeFilters?: readonly CollectionActiveFilter[];
  /** chips 列表的可访问名称。 */
  activeFiltersLabel?: string;
  /** 重置全部筛选。 */
  onResetFilters?: () => void;
  /** 重置按钮文本（与 onResetFilters 成对提供）。 */
  resetFiltersLabel?: string;
}>) {
  const regionId = useId();
  const [internalOpen, setInternalOpen] = useState((activeFilters?.length ?? 0) > 0);
  const collapsible = advanced !== undefined && advancedLabel !== undefined;
  const open = collapsible ? (advancedOpen ?? internalOpen) : false;
  const toggle = () => {
    const next = !open;
    if (advancedOpen === undefined) setInternalOpen(next);
    onAdvancedOpenChange?.(next);
  };
  const hasActiveFilters = (activeFilters?.length ?? 0) > 0;
  return (
    <div role="search" aria-label={label} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {search ? <div className="min-w-64 flex-1">{search}</div> : null}
        {filters ? (
          <div className="flex flex-wrap items-center gap-2 border-border sm:border-l sm:pl-3">
            {filters}
          </div>
        ) : null}
        {view ? (
          <div className="flex flex-wrap items-center gap-2 border-border sm:border-l sm:pl-3">
            {view}
          </div>
        ) : null}
        {reset ? <div className="flex items-center">{reset}</div> : null}
      </div>
      {hasActiveFilters ? (
        <ul aria-label={activeFiltersLabel} className="flex flex-wrap items-center gap-1.5">
          {activeFilters?.map((filter) => (
            <li key={filter.id}>
              {/* 原生 button：Enter/Space 直接移除该筛选，chip 文本即可访问名称。 */}
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
                onClick={filter.onRemove}
                type="button"
              >
                <span>{filter.label}</span>
                <RemoveFilterGlyph />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {advanced ? (
        collapsible ? (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                aria-controls={regionId}
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 rounded-control px-1.5 py-1 text-sm font-semibold text-ink outline-none transition-colors hover:text-brand focus-visible:ring-2 focus-visible:ring-focus"
                onClick={toggle}
                type="button"
              >
                <AdvancedChevron expanded={open} />
                <span>{open ? (advancedOpenLabel ?? advancedLabel) : advancedLabel}</span>
              </button>
              {onResetFilters && resetFiltersLabel ? (
                <Action size="sm" variant="quiet" onPress={onResetFilters}>
                  {resetFiltersLabel}
                </Action>
              ) : null}
            </div>
            <div hidden={!open} id={regionId}>
              {advanced}
            </div>
          </div>
        ) : (
          <div className="pt-2">{advanced}</div>
        )
      ) : null}
    </div>
  );
}

export function CollectionPagination({
  summary,
  pageSize,
  pager,
}: Readonly<{
  summary: ReactNode;
  pageSize?: ReactNode;
  pager: ReactNode;
}>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="text-ink-muted">{summary}</div>
      <div className="flex flex-wrap items-center gap-3">
        {pageSize}
        {pager}
      </div>
    </div>
  );
}

export function BulkActionBar({
  selectionLabel,
  actions,
  onClear,
  clearLabel,
}: Readonly<{
  selectionLabel: string;
  actions: ReactNode;
  onClear: () => void;
  clearLabel: string;
}>) {
  return (
    <div
      aria-label={selectionLabel}
      className="surface-bulk-bar flex flex-wrap items-center justify-between gap-3 rounded-panel border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-ink"
      role="toolbar"
    >
      <span aria-live="polite" className="font-semibold">
        {selectionLabel}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <Action size="sm" variant="quiet" onPress={onClear}>
          {clearLabel}
        </Action>
      </div>
    </div>
  );
}
