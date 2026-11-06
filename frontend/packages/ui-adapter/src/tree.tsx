import {
  Tree as AriaTree,
  TreeItem as AriaTreeItem,
  TreeItemContent,
  type Key,
  type Selection,
} from 'react-aria-components/Tree';
import { Button } from 'react-aria-components/Button';
import type { ReactNode } from 'react';

/**
 * Tree —— 多级层级数据集合（hierarchical data collection）。
 *
 * 语义边界：
 * - Tree = 层级数据集合的浏览 / 展开 / 行选择 / 行动作；
 * - ListBox/`ui-option` = 扁平可选集合；Disclosure = 单一内容区展开；
 *   StepNavigation = 有限有序过程；Shell Navigation = 页面导航拓扑。
 *   本组件不承担页面导航，也不是扁平选项集合。
 *
 * 底层 DOM 使用 React Aria Tree（treegrid/row/gridcell 是 RAC 为 row focus、
 * selection 与 interactive child 提供的预期实现，accessibility/keyboard 由其主持）；
 * 本组件只做产品化呈现，不自建 ARIA/keyboard。
 *
 * Row anatomy（稳定）：
 *   TreeRow
 *   ├─ DisclosureSlot（叶子保留布局占位，不渲染假 affordance）
 *   ├─ optional LeadingIcon
 *   └─ Content（Label required；Description optional）
 */

export type TreeNode = Readonly<{
  id: string;
  /** required：完整 accessible name（视觉 truncate 不削减）。 */
  label: string;
  /** optional：次级说明（rich row）；缺省时行高自适应 label-only。 */
  description?: string;
  /** optional：行级 leading icon（受控 ReactNode，只做内容，不承担展开）。 */
  leadingIcon?: ReactNode;
  disabled?: boolean;
  /** 尚未加载子集合时仍可展开；读取为空后应明确传false。 */
  hasChildItems?: boolean;
  children?: readonly TreeNode[];
}>;

export type TreeProps = Readonly<{
  label: string;
  nodes: readonly TreeNode[];
  selectionMode?: 'none' | 'single' | 'multiple';
  selectionBehavior?: 'toggle' | 'replace';
  /** 导航树以完整press激活；普通集合保留RAC动作语义。 */
  activationBehavior?: 'action' | 'press';
  selectedIds?: ReadonlySet<string>;
  defaultExpandedIds?: ReadonlySet<string>;
  expandedIds?: ReadonlySet<string>;
  onExpandedChange?: (ids: ReadonlySet<string>) => void;
  density?: 'standard' | 'compact';
  /** 仅提供动作名称；RAC会关联行名称，调用方不能再重复插入节点名。 */
  expandLabel: string;
  collapseLabel: string;
  onSelectionChange?: (ids: ReadonlySet<string>) => void;
  onAction?: (id: string) => void;
}>;

/** 展开/折叠 chevron：使用项目内联 svg（随 ui-adapter 无第三方 icon 依赖）。 */
function DisclosureChevronIcon({ expanded }: Readonly<{ expanded: boolean }>) {
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

function renderTreeItem(
  node: TreeNode,
  expandLabel: string,
  collapseLabel: string,
  density: 'standard' | 'compact',
  onPress?: (id: string) => void,
) {
  return (
    <AriaTreeItem
      id={node.id}
      key={node.id}
      textValue={node.label}
      {...(node.hasChildItems === undefined ? {} : { hasChildItems: node.hasChildItems })}
      {...(node.disabled === undefined ? {} : { isDisabled: node.disabled })}
      {...(onPress
        ? {
            onPress: () => {
              if (!node.disabled) onPress(node.id);
            },
          }
        : {})}
    >
      <TreeItemContent>
        {({ hasChildItems, isExpanded, isFocusVisible, isSelected, level }) => (
          <div
            className={`ui-tree-row group flex w-full items-center rounded-control pe-2 text-start outline-none transition-colors ${density === 'compact' ? 'min-h-0 gap-1 py-1' : 'min-h-option gap-2 py-1'} ${
              isSelected ? 'bg-brand-soft text-brand-strong' : 'text-ink hover:bg-surface-muted'
            } ${isFocusVisible ? 'ring-2 ring-focus' : ''}`}
            style={{
              ['--tree-row-level' as string]: String(level),
              ...(density === 'compact'
                ? { ['--tree-depth-step' as string]: 'calc(var(--spacing, 0.25rem) * 4)' }
                : {}),
            }}
          >
            {hasChildItems ? (
              <Button
                aria-label={isExpanded ? collapseLabel : expandLabel}
                className="grid size-5 shrink-0 place-items-center rounded-control text-ink-muted outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
                slot="chevron"
              >
                <DisclosureChevronIcon expanded={isExpanded} />
              </Button>
            ) : (
              // 叶子：disclosure slot 保留同宽透明占位以对齐子列，不渲染假 affordance。
              <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center" />
            )}
            {node.leadingIcon ? (
              <span
                aria-hidden="true"
                className="grid size-icon-sm shrink-0 place-items-center text-current"
              >
                {node.leadingIcon}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{node.label}</span>
              {node.description ? (
                <span className="block truncate text-xs text-ink-muted">{node.description}</span>
              ) : null}
            </span>
          </div>
        )}
      </TreeItemContent>
      {node.children?.map((child) =>
        renderTreeItem(child, expandLabel, collapseLabel, density, onPress),
      )}
    </AriaTreeItem>
  );
}

function normalizeSelection(selection: Selection): ReadonlySet<string> {
  if (selection === 'all') {
    return new Set<string>();
  }
  return new Set(Array.from(selection, (key) => String(key)));
}

/** Tree 统一层级数据的键盘导航、展开和选择语义（Tree 自身轻量透明，Surface 由宿主提供）。 */
export function Tree({
  label,
  nodes,
  expandLabel,
  collapseLabel,
  selectionMode = 'none',
  selectionBehavior,
  activationBehavior = 'action',
  selectedIds,
  defaultExpandedIds,
  expandedIds,
  onExpandedChange,
  density = 'standard',
  onSelectionChange,
  onAction,
}: TreeProps) {
  const selectedKeys = selectedIds ? new Set<Key>(selectedIds) : undefined;
  const defaultExpandedKeys = defaultExpandedIds ? new Set<Key>(defaultExpandedIds) : undefined;

  return (
    <AriaTree
      aria-label={label}
      className="ui-tree outline-none focus-visible:ring-2 focus-visible:ring-focus"
      selectionMode={selectionMode}
      {...(selectionBehavior ? { selectionBehavior } : {})}
      {...(onAction && activationBehavior === 'action'
        ? { onAction: (key: Key) => onAction(String(key)) }
        : {})}
      {...(defaultExpandedKeys ? { defaultExpandedKeys } : {})}
      {...(expandedIds ? { expandedKeys: new Set<Key>(expandedIds) } : {})}
      {...(onExpandedChange
        ? {
            onExpandedChange: (keys: Set<Key>) =>
              onExpandedChange(new Set(Array.from(keys, String))),
          }
        : {})}
      {...(onSelectionChange
        ? {
            onSelectionChange: (selection: Selection) =>
              onSelectionChange(normalizeSelection(selection)),
          }
        : {})}
      {...(selectedKeys ? { selectedKeys } : {})}
    >
      {nodes.map((node) =>
        renderTreeItem(
          node,
          expandLabel,
          collapseLabel,
          density,
          activationBehavior === 'press' ? onAction : undefined,
        ),
      )}
    </AriaTree>
  );
}
