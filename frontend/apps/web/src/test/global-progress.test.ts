import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { globalProgressTimeoutMs, useGlobalProgressStore } from '../host/global-progress-state';
import { beginNavigation, completeNavigation, failNavigation } from '../host/navigation-progress';

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

describe('Global Progress State', () => {
  it('begin 立即进入 pending（无显示门限），end 归零后进入 completing', () => {
    const end = useGlobalProgressStore.getState().begin('navigation');
    expect(useGlobalProgressStore.getState()).toMatchObject({
      pendingCount: 1,
      phase: 'pending',
      activeLabel: 'navigation',
    });

    end();
    expect(useGlobalProgressStore.getState()).toMatchObject({
      pendingCount: 0,
      phase: 'completing',
    });

    useGlobalProgressStore.getState().exitComplete();
    expect(useGlobalProgressStore.getState().phase).toBe('idle');
  });

  it('连续 begin 多次只在前端计数，end 未归零前保持 pending', () => {
    const endA = useGlobalProgressStore.getState().begin('a');
    const endB = useGlobalProgressStore.getState().begin('b');
    const endC = useGlobalProgressStore.getState().begin('c');
    expect(useGlobalProgressStore.getState().pendingCount).toBe(3);

    endA();
    endB();
    expect(useGlobalProgressStore.getState()).toMatchObject({
      pendingCount: 1,
      phase: 'pending',
    });

    endC();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
  });

  it('重复结束幂等：同一 handle 只递减一次', () => {
    const endA = useGlobalProgressStore.getState().begin('a');
    const endB = useGlobalProgressStore.getState().begin('b');
    endA();
    endA();
    endA();
    expect(useGlobalProgressStore.getState().pendingCount).toBe(1);
    endB();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
  });

  it('end 后继续 begin 会重新进入 pending（连续导航不错误结束）', () => {
    const endFirst = useGlobalProgressStore.getState().begin('first');
    endFirst();
    const endSecond = useGlobalProgressStore.getState().begin('second');
    expect(useGlobalProgressStore.getState()).toMatchObject({
      pendingCount: 1,
      phase: 'pending',
    });
    endSecond();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
  });

  it('极快导航（begin 后立即 end）仍进入 completing，保证最小视觉周期', () => {
    const end = useGlobalProgressStore.getState().begin('fast');
    end();
    expect(useGlobalProgressStore.getState()).toMatchObject({
      pendingCount: 0,
      phase: 'completing',
    });
  });

  it('超时兜底：begin 后不结束，超时后自动进入 completing', () => {
    useGlobalProgressStore.getState().begin('stuck');
    vi.advanceTimersByTime(globalProgressTimeoutMs + 1);
    expect(useGlobalProgressStore.getState()).toMatchObject({
      pendingCount: 0,
      phase: 'completing',
    });
  });

  it('超时兜底：提前 end 后定时器被清理，不再触发二次归零', () => {
    const end = useGlobalProgressStore.getState().begin('ok');
    end();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
    vi.advanceTimersByTime(globalProgressTimeoutMs * 2);
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
    expect(useGlobalProgressStore.getState().pendingCount).toBe(0);
  });

  it('exitComplete 只在 completing 阶段生效，重复调用安全', () => {
    useGlobalProgressStore.getState().begin('x');
    useGlobalProgressStore.getState().exitComplete(); // pending 时调用无效果
    expect(useGlobalProgressStore.getState().phase).toBe('pending');
  });
});

describe('Host navigation lifecycle', () => {
  it('beginNavigation → completeNavigation 驱动完整生命周期（快速导航仍进 completing）', () => {
    beginNavigation();
    expect(useGlobalProgressStore.getState().phase).toBe('pending');
    completeNavigation();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
  });

  it('连续 beginNavigation 不会错误结束：新导航接管旧导航', () => {
    beginNavigation();
    beginNavigation();
    expect(useGlobalProgressStore.getState().pendingCount).toBe(1);
    completeNavigation();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
  });

  it('failNavigation 立即进入 completing 视觉收尾', () => {
    beginNavigation();
    failNavigation();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
    failNavigation();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
  });

  it('completeNavigation 后再次调用安全（无当前导航）', () => {
    completeNavigation();
    expect(useGlobalProgressStore.getState().phase).toBe('idle');
  });
});
