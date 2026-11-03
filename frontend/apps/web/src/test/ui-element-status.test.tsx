import { AsyncRegion, type AsyncRegionPhase } from '@clouddrive/ui-adapter/async-region';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('Status Family', () => {
  it.each<AsyncRegionPhase>(['initial', 'ready', 'refreshing', 'background', 'empty', 'error'])(
    'AsyncRegion 暴露 %s 阶段并保持统一 readiness 语义',
    (phase) => {
      render(
        <AsyncRegion
          empty={<p>empty state</p>}
          error={<p>error state</p>}
          label="异步区域"
          loading={<p>loading state</p>}
          phase={phase}
          refreshing={<p>refresh state</p>}
        >
          <p>ready content</p>
        </AsyncRegion>,
      );

      const region = screen.getByRole('region', { name: '异步区域' });
      expect(region).toHaveAttribute('data-phase', phase);
      if (phase === 'initial' || phase === 'refreshing') {
        expect(region).toHaveAttribute('aria-busy', 'true');
      } else {
        expect(region).not.toHaveAttribute('aria-busy');
      }
      const readyContent = screen.getByText('ready content').parentElement;
      if (['initial', 'empty', 'error'].includes(phase)) {
        expect(readyContent).toHaveAttribute('hidden');
      } else {
        expect(readyContent).not.toHaveAttribute('hidden');
      }
      expect(screen.queryByText('refresh state')).toBe(
        phase === 'refreshing' ? screen.getByText('refresh state') : null,
      );
    },
  );

  it('ProgressMeter 将确定进度限制在 0 到 100', () => {
    const { rerender } = render(<ProgressMeter label="导入进度" value={140} />);

    const progress = screen.getByRole('progressbar', { name: '导入进度' });
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '100');
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeVisible();

    rerender(<ProgressMeter label="导入进度" value={Number.NaN} />);
    expect(progress).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('0%')).toBeVisible();
  });

  it('Skeleton 只提供视觉占位，不进入辅助技术内容', () => {
    const { container } = render(<Skeleton className="h-8" />);

    expect(container.firstElementChild).toHaveAttribute('data-slot', 'skeleton');
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('StateSurface 只在显式声明后进入 Live Region', () => {
    const { rerender } = render(
      <StateSurface
        announcement="polite"
        state="success"
        icon={<span aria-hidden="true">✓</span>}
        title="能力已经恢复"
        description="当前成功结果替代了先前失败状态。"
      />,
    );

    expect(screen.getByRole('status')).toContainElement(
      screen.getByRole('heading', { name: '能力已经恢复' }),
    );

    rerender(
      <StateSurface
        announcement="urgent"
        state="error"
        icon={<span aria-hidden="true">!</span>}
        title="操作失败"
        description="当前操作无法安全继续。"
      />,
    );
    expect(screen.getByRole('alert')).toContainElement(
      screen.getByRole('heading', { name: '操作失败' }),
    );
  });
});
