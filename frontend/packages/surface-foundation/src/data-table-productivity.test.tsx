// @vitest-environment jsdom
/**
 * DataTable 生产力契约（树形行 / 固定列）的 Surface 消费验证。
 *
 * ui-adapter 自身没有 test script，而这两个能力由 Surface Foundation 与业务页直接消费，
 * 因此在这里以集成方式验证：行展开语义（aria-expanded / data-tree-depth）、缩进几何与
 * sticky 偏移（来自显式列宽的几何累加，而非设计 Token）。
 */
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type TreeRow = Readonly<{ id: string; name: string; children?: readonly TreeRow[] }>;

const treeColumns: readonly DataColumn<TreeRow>[] = [
  {
    id: 'name',
    label: '名称',
    rowHeader: true,
    render: (row) => row.name,
  },
];

const treeRows: readonly TreeRow[] = [
  { id: 'a', name: 'Root A', children: [{ id: 'a-1', name: 'Child A1' }] },
  { id: 'b', name: 'Root B' },
];

afterEach(cleanup);

describe('DataTable 树形行', () => {
  it('展开时渲染子行，aria-expanded / data-tree-depth 与缩进几何同步', () => {
    render(
      <DataTable
        emptyContent="空"
        label="树形"
        columns={treeColumns}
        rows={treeRows}
        tree={{
          expandedIds: new Set(['a']),
          onExpandedChange: () => undefined,
          childrenOf: (row) => row.children ?? [],
          expandLabel: (row) => `展开 ${row.name}`,
          collapseLabel: (row) => `收起 ${row.name}`,
        }}
      />,
    );
    const rows = screen.getAllByRole('row');
    expect(rows.map((row) => row.getAttribute('data-tree-depth'))).toEqual([null, '0', '1', '0']);
    const collapse = screen.getByRole('button', { name: '收起 Root A' });
    expect(collapse.getAttribute('aria-expanded')).toBe('true');
    // 叶子行不渲染假 affordance。
    expect(screen.queryByRole('button', { name: '展开 Root B' })).toBeNull();
    const childHeader = screen.getByRole('rowheader', { name: 'Child A1' });
    const wrapper = childHeader.querySelector('div');
    expect(wrapper?.style.paddingInlineStart).toBe('16px');
  });

  it('切换 chevron 只通过 onExpandedChange 回传新的展开集合', () => {
    const onExpandedChange = vi.fn();
    render(
      <DataTable
        emptyContent="空"
        label="树形"
        columns={treeColumns}
        rows={treeRows}
        tree={{
          expandedIds: new Set(['a']),
          onExpandedChange,
          childrenOf: (row) => row.children ?? [],
          expandLabel: (row) => `展开 ${row.name}`,
          collapseLabel: (row) => `收起 ${row.name}`,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '收起 Root A' }));
    expect(onExpandedChange).toHaveBeenCalledTimes(1);
    expect([...(onExpandedChange.mock.calls[0]![0] as ReadonlySet<string>)]).toEqual([]);
  });
});

describe('DataTable 固定列', () => {
  it('sticky 偏移按显式列宽累加（首列 0，第二列 = 首列宽）', () => {
    type Row = Readonly<{ id: string; name: string; email: string }>;
    const columns: readonly DataColumn<Row>[] = [
      { id: 'name', label: '姓名', rowHeader: true, render: (row) => row.name },
      { id: 'email', label: '邮箱', render: (row) => row.email },
    ];
    render(
      <DataTable
        label="固定列"
        columns={columns}
        columnWidths={{ name: 120, email: 180 }}
        emptyContent="空"
        pinnedColumnIds={['name', 'email']}
        rows={[{ id: 'row-1', name: 'Rin', email: 'rin@example.test' }]}
      />,
    );
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]?.style.left).toBe('0px');
    expect(headers[1]?.style.left).toBe('120px');
    expect(headers[0]?.className).toContain('sticky');
    const rowHeader = screen.getByRole('rowheader');
    expect(rowHeader.style.left).toBe('0px');
    const gridCell = screen.getByRole('gridcell');
    expect(gridCell.style.left).toBe('120px');
  });
});
