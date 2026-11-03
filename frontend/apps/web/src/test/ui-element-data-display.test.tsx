import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type TestRow = Readonly<{ id: string; name: string }>;

const columns: readonly DataColumn<TestRow>[] = [
  {
    id: 'name',
    label: '名称',
    rowHeader: true,
    sortable: true,
    render: (row) => row.name,
  },
];

describe('Data Display Family', () => {
  it('未声明 selection 时保持为纯展示表格', () => {
    render(
      <DataTable
        label="能力清单"
        columns={columns}
        emptyContent="没有能力"
        rows={[{ id: 'capability-1', name: 'Semantic Tokens' }]}
      />,
    );

    expect(screen.getByRole('grid', { name: '能力清单' })).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Semantic Tokens' })).toBeVisible();
    expect(screen.getAllByRole('row')[1]).not.toHaveAttribute('aria-selected');
  });

  it('空集合保留表格语义并呈现调用方文案', () => {
    render(<DataTable label="能力清单" columns={columns} emptyContent="没有能力" rows={[]} />);

    expect(screen.getByRole('grid', { name: '能力清单' })).toBeVisible();
    expect(screen.getByText('没有能力')).toBeVisible();
  });

  it('排序与多选都通过项目契约回传稳定标识', () => {
    const onSortChange = vi.fn();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        label="能力清单"
        columns={columns}
        emptyContent="没有能力"
        rows={[
          { id: 'tokens', name: 'Semantic Tokens' },
          { id: 'adapter', name: 'UI Adapter' },
        ]}
        selection={{ mode: 'multiple', selectedIds: [], onSelectionChange }}
        sort={{ columnId: 'name', direction: 'ascending', onSortChange }}
      />,
    );

    fireEvent.click(screen.getByRole('columnheader', { name: /名称/ }));
    expect(onSortChange).toHaveBeenCalledWith('name', 'descending');

    fireEvent.click(screen.getByRole('rowheader', { name: 'UI Adapter' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['adapter']);
  });
});
