import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGlobalProgressStore } from '../host/global-progress-state';
import { TopProgress } from '../host/top-progress';

function resetProgress() {
  useGlobalProgressStore.setState({ pendingCount: 0, phase: 'idle', activeLabel: null });
}

beforeEach(() => {
  vi.useFakeTimers();
  resetProgress();
});

afterEach(() => {
  vi.useRealTimers();
  resetProgress();
});

describe('TopProgress', () => {
  it('idle 时不渲染', () => {
    render(<TopProgress />);
    expect(document.querySelector('.top-progress')).toBeNull();
  });

  it('begin 后立即渲染（无显示门限），phase 为 pending', () => {
    render(<TopProgress />);
    act(() => {
      useGlobalProgressStore.getState().begin('navigation');
    });
    const bar = document.querySelector('.top-progress');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('data-phase', 'pending');
    expect(bar).toHaveClass('fixed');
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('极快导航（begin 后立即 end）：仍渲染并进入 completing 视觉收尾，退出后回 idle', () => {
    render(<TopProgress />);
    let end: (() => void) | undefined;
    act(() => {
      end = useGlobalProgressStore.getState().begin('fast');
    });
    act(() => {
      end?.();
    });
    const bar = document.querySelector('.top-progress');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('data-phase', 'completing');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(useGlobalProgressStore.getState().phase).toBe('idle');
    expect(document.querySelector('.top-progress')).toBeNull();
  });

  it('慢速导航：completing 保持显示并由退出动画收尾回 idle', () => {
    render(<TopProgress />);
    let end: (() => void) | undefined;
    act(() => {
      end = useGlobalProgressStore.getState().begin('slow');
    });
    expect(document.querySelector('.top-progress')).not.toBeNull();

    act(() => {
      end?.();
    });
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
    const bar = document.querySelector('.top-progress');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('data-phase', 'completing');

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(useGlobalProgressStore.getState().phase).toBe('idle');
    expect(document.querySelector('.top-progress')).toBeNull();
  });

  it('fill 使用语义品牌色且位于顶部', () => {
    render(<TopProgress />);
    act(() => {
      useGlobalProgressStore.getState().begin('slow');
    });
    const fill = document.querySelector('.top-progress-fill');
    expect(fill).not.toBeNull();
    expect(fill).toHaveClass('bg-brand');
    const bar = document.querySelector('.top-progress');
    expect(bar).toHaveClass('top-0');
  });
});
