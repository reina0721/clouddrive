import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { FeedbackPresence } from '@clouddrive/ui-adapter/feedback-presence';
import { FeedbackProvider } from '@clouddrive/ui-adapter/feedback-provider';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function FeedbackHarness({ onAction }: Readonly<{ onAction: () => void }>) {
  const { notify } = useFeedback();
  return (
    <button
      type="button"
      onClick={() =>
        notify({
          title: '同步已完成',
          description: '当前页面已获得最新状态。',
          tone: 'success',
          duration: 'persistent',
          action: { label: '查看详情', onPress: onAction },
        })
      }
    >
      发送反馈
    </button>
  );
}

describe('FeedbackProvider', () => {
  it('只通过项目契约入队、执行动作并关闭 Toast', async () => {
    const onAction = vi.fn();
    render(
      <FeedbackProvider closeLabel="关闭反馈" loadingLabel="正在加载反馈">
        <FeedbackHarness onAction={onAction} />
      </FeedbackProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '发送反馈' }));
    expect(await screen.findByText('同步已完成')).toBeVisible();
    expect(screen.getByText('当前页面已获得最新状态。')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    expect(onAction).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '关闭反馈' }));
    expect(screen.queryByText('同步已完成')).not.toBeInTheDocument();
  });

  it('FeedbackPresence 退出时立即脱离交互树，并支持快速反转', async () => {
    const { container, rerender } = render(
      <FeedbackPresence visible>
        <button type="button">内联动作</button>
      </FeedbackPresence>,
    );

    rerender(
      <FeedbackPresence visible={false}>
        <button type="button">内联动作</button>
      </FeedbackPresence>,
    );
    await waitFor(() =>
      expect(container.firstElementChild).toHaveAttribute('data-presence', 'exit'),
    );
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('button', { name: '内联动作' })).not.toBeInTheDocument();

    rerender(
      <FeedbackPresence visible>
        <button type="button">内联动作</button>
      </FeedbackPresence>,
    );
    await waitFor(() =>
      expect(container.firstElementChild).toHaveAttribute('data-presence', 'enter'),
    );
    expect(screen.getByRole('button', { name: '内联动作' })).toBeVisible();

    rerender(
      <FeedbackPresence visible={false}>
        <button type="button">内联动作</button>
      </FeedbackPresence>,
    );
    await waitFor(() =>
      expect(container.firstElementChild).toHaveAttribute('data-presence', 'exit'),
    );
    fireEvent.animationEnd(container.firstElementChild as Element);
    await waitFor(() => expect(container.firstElementChild).toBeNull());
  });
});
