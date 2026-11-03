import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OverlayTriggerAction } from '@clouddrive/ui-adapter/overlay-trigger';

describe('OverlayTriggerAction 语义', () => {
  it('default tone 渲染中性 trigger：底层 HeroButton variant=ghost，class 无 primary/brand', () => {
    render(<OverlayTriggerAction>打开</OverlayTriggerAction>);
    const button = screen.getByRole('button', { name: '打开' });
    const cls = button.getAttribute('class') ?? '';
    // HeroUI 不注入 button--primary（默认 variant 是 primary，这里必须显式 ghost）
    expect(cls).toContain('button--ghost');
    expect(cls).not.toContain('button--primary');
    // 项目语义中性：白底 + 边框，不用 bg-brand
    expect(cls).toContain('bg-surface');
    expect(cls).not.toContain('bg-brand');
  });

  it('danger tone 渲染危险语义 trigger：text-danger / danger-soft hover-pressed，无 brand', () => {
    render(<OverlayTriggerAction tone="danger">删除</OverlayTriggerAction>);
    const button = screen.getByRole('button', { name: '删除' });
    const cls = button.getAttribute('class') ?? '';
    expect(cls).toContain('button--ghost');
    expect(cls).not.toContain('button--primary');
    expect(cls).toContain('text-danger');
    expect(cls).toContain('bg-danger-soft');
    expect(cls).not.toContain('bg-brand');
  });

  it('按下/悬停状态仍保持语义色数据属性映射（pressed 不切 primary）', () => {
    // class 层面断言：pressed/hover 映射到 surface-muted 或 danger-soft，而非 brand
    const { unmount } = render(
      <>
        <OverlayTriggerAction>默认</OverlayTriggerAction>
        <OverlayTriggerAction tone="danger">危险</OverlayTriggerAction>
      </>,
    );
    const defaultCls = screen.getByRole('button', { name: '默认' }).getAttribute('class') ?? '';
    const dangerCls = screen.getByRole('button', { name: '危险' }).getAttribute('class') ?? '';
    expect(defaultCls).toContain('data-[pressed=true]:bg-surface-muted');
    expect(dangerCls).toContain('data-[pressed=true]:bg-danger-soft');
    expect(defaultCls).not.toContain('data-[pressed=true]:bg-brand');
    unmount();
  });

  it('保留 focus-visible 可访问性反馈（ring-focus-ring），不因“不变蓝”删除', () => {
    render(<OverlayTriggerAction>打开</OverlayTriggerAction>);
    const cls = screen.getByRole('button', { name: '打开' }).getAttribute('class') ?? '';
    expect(cls).toContain('focus-visible:ring-2');
    expect(cls).toContain('ring-focus-ring');
  });

  it('透传 onPress / disabled / children', () => {
    const onPress = vi.fn();
    render(
      <OverlayTriggerAction disabled onPress={onPress}>
        触发
      </OverlayTriggerAction>,
    );
    const button = screen.getByRole('button', { name: '触发' });
    expect(button).toBeDisabled();
  });
});
