// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CollectionQuery } from './collection';
import {
  ColumnSettingsDialog,
  CollectionToolbar,
  type ColumnSettingsText,
} from './collection-tools';

afterEach(cleanup);

const columnText: ColumnSettingsText = {
  title: '列设置',
  description: '选择要显示的列并调整顺序。',
  mandatory: '始终显示',
  reset: '恢复默认列',
  close: '完成',
  moveUp: (label) => `上移 ${label}`,
  moveDown: (label) => `下移 ${label}`,
};

const columns = [
  { id: 'name', label: '姓名', mandatory: true },
  { id: 'email', label: '邮箱' },
  { id: 'status', label: '状态' },
];

describe('CollectionQuery 高级筛选区', () => {
  it('默认折叠，点击标题后展开并保留 advanced 内容', () => {
    const onAdvancedOpenChange = vi.fn();
    render(
      <CollectionQuery
        advanced={<p>高级字段</p>}
        advancedLabel="高级筛选"
        advancedOpenLabel="收起高级筛选"
        onAdvancedOpenChange={onAdvancedOpenChange}
        search={<p>搜索</p>}
      />,
    );
    const toggle = screen.getByRole('button', { name: '高级筛选' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(onAdvancedOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: '收起高级筛选' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.getByText('高级字段')).toBeTruthy();
  });

  it('activeFilters 非空时默认展开，chip 是原生按钮并回调 onRemove', () => {
    const onRemove = vi.fn();
    const onResetFilters = vi.fn();
    render(
      <CollectionQuery
        activeFilters={[{ id: 'status', label: '状态：启用', onRemove }]}
        activeFiltersLabel="已启用筛选"
        advanced={<p>高级字段</p>}
        advancedLabel="高级筛选"
        onResetFilters={onResetFilters}
        resetFiltersLabel="重置筛选"
      />,
    );
    expect(screen.getByRole('list', { name: '已启用筛选' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '高级筛选' }).getAttribute('aria-expanded')).toBe(
      'true',
    );
    const chip = screen.getByRole('button', { name: '状态：启用' });
    expect(chip.tagName).toBe('BUTTON');
    fireEvent.click(chip);
    expect(onRemove).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '重置筛选' }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it('未提供 advancedLabel 时保持旧行为：advanced 直接内联渲染', () => {
    render(<CollectionQuery advanced={<p>旧内联内容</p>} />);
    expect(screen.getByText('旧内联内容')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '高级筛选' })).toBeNull();
  });
});

describe('ColumnSettingsDialog', () => {
  it('勾选/取消可见列、上下移动与重置都只通过回调表达', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <ColumnSettingsDialog
        columns={columns}
        isOpen
        onChange={onChange}
        onOpenChange={() => undefined}
        onReset={onReset}
        text={columnText}
        visibleOrder={['name', 'email', 'status']}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: columnText.title });
    expect(within(dialog).getByText(columnText.description)).toBeTruthy();
    const list = within(dialog).getByRole('list', { name: columnText.title });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    fireEvent.click(within(dialog).getByRole('checkbox', { name: '状态' }));
    expect(onChange).toHaveBeenLastCalledWith(['name', 'email']);

    fireEvent.click(within(dialog).getByRole('button', { name: '下移 邮箱' }));
    expect(onChange).toHaveBeenLastCalledWith(['name', 'status', 'email']);

    fireEvent.click(within(dialog).getByRole('button', { name: columnText.reset }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('必选列不可隐藏且不能重排', () => {
    render(
      <ColumnSettingsDialog
        columns={columns}
        isOpen
        onChange={() => undefined}
        onOpenChange={() => undefined}
        onReset={() => undefined}
        text={columnText}
        visibleOrder={['name', 'email']}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: columnText.title });
    expect(within(dialog).getByRole('checkbox', { name: '姓名' })).toHaveProperty('disabled', true);
    expect(within(dialog).getByText(columnText.mandatory)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '上移 姓名' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});

describe('CollectionToolbar', () => {
  it('把密度、列设置与导出组合进具名 Toolbar，对话框默认关闭', () => {
    render(
      <CollectionToolbar
        columnSettings={{
          columns,
          triggerLabel: '列设置',
          visibleOrder: ['name', 'email'],
          onChange: () => undefined,
          onReset: () => undefined,
          text: columnText,
        }}
        density={{
          label: '表格密度',
          value: 'standard',
          labels: { compact: '紧凑', standard: '标准', comfortable: '舒适' },
          onChange: () => undefined,
        }}
        exportMenu={{
          label: '导出',
          menuLabel: '导出数据',
          items: [{ id: 'csv', label: '导出 CSV', onSelect: () => undefined }],
        }}
        label="表格工具栏"
      >
        <p>工具条主区</p>
      </CollectionToolbar>,
    );
    const toolbar = screen.getByRole('toolbar', { name: '表格工具栏' });
    expect(within(toolbar).getByText('工具条主区')).toBeTruthy();
    expect(within(toolbar).getByRole('button', { name: /表格密度/ })).toBeTruthy();
    expect(within(toolbar).getByRole('button', { name: '列设置' })).toBeTruthy();
    expect(within(toolbar).getByRole('button', { name: '导出数据' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
