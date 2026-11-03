import { Action } from '@clouddrive/ui-adapter/action';
import { RadioGroupField } from '@clouddrive/ui-adapter/form-field';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { ToggleGroup } from '@clouddrive/ui-adapter/toggle-group';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('Action Family', () => {
  it('比较预览保持名称与整块点击，简短选项保留禁用单选语义', () => {
    const onValueChange = vi.fn();
    render(
      <>
        <RadioGroupField
          label="比较"
          presentation="previews"
          value="a"
          onValueChange={onValueChange}
          options={[
            { value: 'a', label: '紧凑' },
            {
              value: 'b',
              label: '宽松',
              preview: <span data-testid="spacing-preview">比较图</span>,
            },
          ]}
        />
        <RadioGroupField
          label="快速选择"
          presentation="inline"
          value="a"
          onValueChange={onValueChange}
          options={[
            { value: 'a', label: '开始' },
            { value: 'b', label: '不可用', disabled: true },
          ]}
        />
      </>,
    );
    expect(screen.getByRole('radio', { name: '宽松' })).toHaveAccessibleName('宽松');
    expect(screen.getByTestId('spacing-preview').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    fireEvent.click(screen.getByTestId('spacing-preview'));
    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('radio', { name: '不可用' })).toBeDisabled();
  });
  it('Action 暴露项目 Variant、尺寸和真实命令行为', () => {
    const onPress = vi.fn();
    render(
      <Action onPress={onPress} size="lg" trailingIcon={<span>→</span>} variant="danger">
        删除记录
      </Action>,
    );

    const action = screen.getByRole('button', { name: '删除记录' });
    fireEvent.click(action);

    expect(onPress).toHaveBeenCalledOnce();
    expect(action).toHaveClass('h-control-lg', 'bg-danger', 'text-on-danger');
  });

  it('Pending 与 Disabled 都阻止重复动作并保留状态语义', () => {
    render(
      <>
        <Action disabled loading>
          正在保存
        </Action>
        <IconAction disabled label="通知不可用">
          ×
        </IconAction>
      </>,
    );

    expect(screen.getByRole('button', { name: '正在保存' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '正在保存' })).toHaveAttribute(
      'data-pending',
      'true',
    );
    expect(screen.getByRole('button', { name: '通知不可用' })).toBeDisabled();
  });

  it('ToggleGroup 使用受控 Selection，而不是相邻 Button 的视觉伪装', () => {
    const onSelectionChange = vi.fn();
    render(
      <ToggleGroup
        label="界面密度"
        onSelectionChange={onSelectionChange}
        options={[
          { id: 'comfortable', label: '舒适' },
          { id: 'compact', label: '紧凑' },
        ]}
        selectedIds={['comfortable']}
      />,
    );

    expect(screen.getByRole('radiogroup', { name: '界面密度' })).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: '紧凑' }));

    expect(onSelectionChange).toHaveBeenCalledWith(['compact']);
  });

  it('RadioGroupField 提供单选 Field 语义并阻止禁用选项', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroupField
        label="执行模式"
        onValueChange={onValueChange}
        options={[
          { value: 'observe', label: '观察' },
          { value: 'guided', label: '引导' },
          { value: 'automatic', label: '自动', disabled: true },
        ]}
        value="observe"
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: '引导' }));
    expect(onValueChange).toHaveBeenCalledWith('guided');
    expect(screen.getByRole('radio', { name: '自动' })).toBeDisabled();
  });

  it('图标选择卡片保留分组名称、说明、整卡点击与禁用语义', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroupField
        label="显示模式"
        hint="选择一个模式"
        labelIcon={<span>装饰</span>}
        presentation="tiles"
        value="light"
        onValueChange={onValueChange}
        options={[
          { value: 'light', label: '浅色', icon: <span>太阳</span> },
          { value: 'dark', label: '深色', icon: <span data-testid="dark-icon">月亮</span> },
          { value: 'system', label: '系统', disabled: true, icon: <span>屏幕</span> },
        ]}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: '显示模式' });
    expect(group).toHaveAccessibleDescription('选择一个模式');
    const radio = screen.getByRole('radio', { name: /^深色$/ });
    expect(radio.closest('label')).toContainElement(screen.getByTestId('dark-icon'));
    fireEvent.click(screen.getByTestId('dark-icon'));
    expect(onValueChange).toHaveBeenCalledWith('dark');
    expect(screen.getByRole('radio', { name: '系统' })).toBeDisabled();
  });

  it('ConfirmDialog 在异步确认期间阻止重复动作并在成功后关闭', async () => {
    let resolveConfirm: (() => void) | undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    render(
      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认删除"
        description="此操作需要确认"
        failureMessage="删除失败"
        impact="仅影响当前记录"
        title="删除记录？"
        tone="danger"
        triggerLabel="打开危险确认"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '打开危险确认' }));
    const confirmAction = await screen.findByRole('button', { name: '确认删除' });
    fireEvent.click(confirmAction);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirmAction).toBeDisabled();
    resolveConfirm?.();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});
