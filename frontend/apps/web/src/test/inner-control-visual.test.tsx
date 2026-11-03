import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, RadioGroupField } from '@clouddrive/ui-adapter/form-field';
import { ToggleGroup } from '@clouddrive/ui-adapter/toggle-group';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// 内部控件视觉职责契约（DOM/class 层；computed style 由 Playwright 在真实浏览器验证）。
// 原则：外层交互组件拥有 surface/border/radius/selected/pressed；
// 内部 indicator/icon/content 只拥有 geometry/alignment/foreground，不得二次成形。

describe('RadioGroupField 内部控件视觉职责', () => {
  function renderRadios() {
    return render(
      <RadioGroupField
        label="执行模式"
        onValueChange={() => undefined}
        options={[
          { value: 'a', label: 'A', description: 'desc a' },
          { value: 'b', label: 'B', disabled: true },
        ]}
        value="a"
      />,
    );
  }

  it('option 的原生点击标签同时包含 input、指示器与文字，不产生嵌套 label', () => {
    renderRadios();
    const radios = screen.getAllByRole('radio');
    for (const radio of radios) {
      const row = radio.closest('label');
      expect(row?.querySelector('.radio__control')).not.toBeNull();
      expect(row?.textContent).toContain(radio.getAttribute('aria-label'));
      expect(row?.querySelector('label')).toBeNull();
    }
  });

  it('indicator dot 只属 selected（unselected/disabled 无实心 dot 可见类）', () => {
    const { unmount } = renderRadios();
    // RAC radio 行根带 data-selected；以 input checked 判断选中
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    const selectedInput = [...inputs].find((i) => i.checked);
    const unselectedInput = [...inputs].find((i) => !i.checked);
    if (!selectedInput || !unselectedInput) throw new Error('radio inputs missing');
    const cardOf = (input: HTMLInputElement) => input.closest('[class*="rounded-panel"]');
    const dotOf = (card: Element | null) => card?.querySelector('.radio__indicator span');
    const selectedDot = dotOf(cardOf(selectedInput));
    const unselectedDot = dotOf(cardOf(unselectedInput));
    // dot 几何固定且跟随 selected 显隐（class 契约：opacity-0 默认，group-data-[selected] 显示）
    expect(selectedDot?.getAttribute('class')).toContain('size-2.5');
    expect(selectedDot?.getAttribute('class')).toContain('group-data-[selected]:opacity-100');
    expect(unselectedDot?.getAttribute('class')).toContain('opacity-0');
    unmount();
  });

  it('CheckboxField 的点击标签包含指示器和文字，不产生嵌套 label', () => {
    render(<CheckboxField checked label="复选框" onCheckedChange={() => undefined} />);
    const box = screen.getByRole('checkbox');
    const row = box.closest('label');
    expect(row?.querySelector('.checkbox__control')).not.toBeNull();
    expect(row?.textContent).toContain('复选框');
    expect(row?.querySelector('label')).toBeNull();
  });
});

describe('Action 内部 icon content 契约', () => {
  it('leading/trailing icon wrapper 无独立 surface（无 bg/border/radius/shadow 成形类）', () => {
    render(
      <Action
        leadingIcon={<span data-testid="li" />}
        onPress={() => undefined}
        trailingIcon={<span data-testid="ti" />}
      >
        操作
      </Action>,
    );
    const button = screen.getByRole('button', { name: '操作' });
    const wrappers = [...button.querySelectorAll('span.grid')] as HTMLElement[];
    expect(wrappers.length).toBeGreaterThanOrEqual(2);
    for (const wrapper of wrappers) {
      const cls = (wrapper.getAttribute('class') ?? '').split(' ');
      // 只有 geometry/alignment/shrink/currentColor，绝无 surface 成形类
      for (const formed of ['bg-', 'border-', 'rounded-', 'shadow-', 'ring-']) {
        expect(cls.some((c) => c.startsWith(formed))).toBe(false);
      }
      expect(cls).toContain('size-icon-sm');
      expect(cls).toContain('shrink-0');
      expect(cls).toContain('text-current');
      expect(cls).toContain('[&>svg]:m-0');
      expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('icon wrapper 不改变 Action 行高表达（无独立 h-*）', () => {
    render(
      <Action leadingIcon={<span data-testid="li2" />} onPress={() => undefined}>
        保存
      </Action>,
    );
    const button = screen.getByRole('button', { name: '保存' });
    const wrapper = button.querySelector('span.grid');
    expect((wrapper?.getAttribute('class') ?? '').split(' ').some((c) => c.startsWith('h-'))).toBe(
      false,
    );
  });
});

describe('ToggleGroup 内部 icon 契约', () => {
  it('ToggleItem 是唯一 selected surface owner；内部 icon wrapper 无 surface', () => {
    render(
      <ToggleGroup
        label="视图"
        onSelectionChange={() => undefined}
        options={[
          { id: 'grid', label: '网格', icon: <span data-testid="icon-grid" /> },
          { id: 'list', label: '列表' },
        ]}
        selectedIds={['grid']}
      />,
    );
    const item = screen.getByRole('radio', { name: '网格' });
    const itemCls = (item.getAttribute('class') ?? '').split(' ');
    // item 承载 selected surface
    expect(itemCls.some((c) => c.includes('data-[selected]:bg-brand-soft'))).toBe(true);
    const wrapper = screen.getByTestId('icon-grid').parentElement as HTMLElement;
    const wCls = (wrapper.getAttribute('class') ?? '').split(' ');
    for (const formed of ['bg-', 'border-', 'rounded-', 'shadow-', 'ring-']) {
      expect(wCls.some((c) => c.startsWith(formed))).toBe(false);
    }
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
  });

  it('icon wrapper 携带 svg margin 清零覆盖（抵消 vendor 纵向 margin）', () => {
    render(
      <ToggleGroup
        label="视图"
        onSelectionChange={() => undefined}
        options={[{ id: 'grid', label: '网格', icon: <span data-testid="icon-m0" /> }]}
        selectedIds={['grid']}
      />,
    );
    const wrapper = screen.getByTestId('icon-m0').parentElement as HTMLElement;
    expect((wrapper.getAttribute('class') ?? '').split(' ')).toContain('[&>svg]:m-0');
  });

  it('single 模式保持 segmented（容器无 gap）；multiple 模式容器有语义 gap 且 item 独立 border/radius', () => {
    const { unmount: unmountSingle } = render(
      <ToggleGroup
        label="单选项"
        onSelectionChange={() => undefined}
        options={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ]}
        selectedIds={['a']}
      />,
    );
    const singleGroup = screen.getByRole('radiogroup', { name: '单选项' });
    const singleCls = (singleGroup.getAttribute('class') ?? '').split(' ');
    expect(singleCls.some((c) => c.startsWith('gap-'))).toBe(false);
    unmountSingle();

    const { unmount: unmountMulti } = render(
      <ToggleGroup
        label="多选项"
        onSelectionChange={() => undefined}
        options={[
          { id: 'x', label: 'X' },
          { id: 'y', label: 'Y' },
        ]}
        selectedIds={['x']}
        selectionMode="multiple"
      />,
    );
    const multiGroup = screen.getByRole('toolbar', { name: '多选项' });
    const multiCls = (multiGroup.getAttribute('class') ?? '').split(' ');
    expect(multiCls.some((c) => c === 'gap-1' || c.startsWith('gap-'))).toBe(true);
    const items = multiGroup.querySelectorAll('[data-slot="toggle-button"]');
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const item of items) {
      const cls = (item.getAttribute('class') ?? '').split(' ');
      // 独立几何：完整 border（不透明）+ radius（无 attached rounded-none 依赖）
      expect(cls.some((c) => c.includes('border-border') || c.startsWith('border-'))).toBe(true);
      expect(cls.some((c) => c.startsWith('rounded-'))).toBe(true);
    }
    unmountMulti();
  });
});
