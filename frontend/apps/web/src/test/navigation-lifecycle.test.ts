import { beforeEach, describe, expect, it } from 'vitest';

import { useGlobalProgressStore } from '../host/global-progress-state';
import {
  cancelRouteNavigation,
  completeRouteNavigation,
  commitResolvedHref,
  failRouteNavigation,
  getCurrentResolvedHref,
  hasActiveNavigation,
  resetNavigationLifecycle,
  shouldProceedWithNavigation,
} from '../host/navigation-lifecycle';

function resetProgress() {
  useGlobalProgressStore.setState({ pendingCount: 0, phase: 'idle', activeLabel: null });
}

beforeEach(() => {
  resetProgress();
  resetNavigationLifecycle();
});

describe('navigation lifecycle no-op short-circuit', () => {
  it('首次建立基线后，同 resolved target 点击是 no-op：不 begin、不增长 pendingCount', () => {
    commitResolvedHref('/ui-elements/feedback');
    expect(shouldProceedWithNavigation('/ui-elements/feedback')).toBe(false);
    expect(useGlobalProgressStore.getState()).toMatchObject({ pendingCount: 0, phase: 'idle' });
    expect(hasActiveNavigation()).toBe(false);
  });

  it('同 target 但 search key 顺序不同仍视为 no-op', () => {
    commitResolvedHref('/a?x=1&y=2');
    expect(shouldProceedWithNavigation('/a?y=2&x=1')).toBe(false);
    expect(useGlobalProgressStore.getState().pendingCount).toBe(0);
  });

  it('同 pathname 但 search 不同不是 no-op：真实导航', () => {
    commitResolvedHref('/a?x=1');
    expect(shouldProceedWithNavigation('/a?x=2')).toBe(true);
    expect(useGlobalProgressStore.getState().pendingCount).toBe(1);
  });

  it('不同 resolved target 启动真实导航事务', () => {
    commitResolvedHref('/');
    expect(shouldProceedWithNavigation('/motion', 'shell')).toBe(true);
    expect(useGlobalProgressStore.getState()).toMatchObject({ pendingCount: 1, phase: 'pending' });
    expect(hasActiveNavigation()).toBe(true);
  });

  it('基线未建立（首帧前）时不短路：视为真实导航', () => {
    expect(getCurrentResolvedHref()).toBeNull();
    expect(shouldProceedWithNavigation('/a')).toBe(true);
    expect(useGlobalProgressStore.getState().pendingCount).toBe(1);
  });
});

describe('navigation lifecycle commit convergence', () => {
  it('真实导航 commit 对应 location 后收敛：pending → completing', () => {
    commitResolvedHref('/');
    shouldProceedWithNavigation('/motion', 'nav');
    completeRouteNavigation('/motion');
    expect(useGlobalProgressStore.getState()).toMatchObject({
      pendingCount: 0,
      phase: 'completing',
    });
    expect(hasActiveNavigation()).toBe(false);
    expect(getCurrentResolvedHref()).toBe('/motion');
  });

  it('无活跃事务的 location 变化（后退/前进）只更新基线，不产生 pending', () => {
    commitResolvedHref('/');
    completeRouteNavigation('/foundations');
    expect(useGlobalProgressStore.getState()).toMatchObject({ pendingCount: 0, phase: 'idle' });
    expect(getCurrentResolvedHref()).toBe('/foundations');
  });

  it('连续导航 A→B：B 的 begin 接管，commit B 收敛且 pending 不叠加', () => {
    commitResolvedHref('/');
    shouldProceedWithNavigation('/motion', 'a');
    expect(useGlobalProgressStore.getState().pendingCount).toBe(1);
    // 未 commit 前点击 B
    shouldProceedWithNavigation('/foundations', 'b');
    expect(useGlobalProgressStore.getState().pendingCount).toBe(1);
    expect(hasActiveNavigation()).toBe(true);
    completeRouteNavigation('/foundations');
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
    expect(useGlobalProgressStore.getState().pendingCount).toBe(0);
  });

  it('commit 到重定向目标（active 与 commit 不同）仍收敛', () => {
    commitResolvedHref('/');
    shouldProceedWithNavigation('/old-path', 'nav');
    completeRouteNavigation('/new-path'); // 服务端重定向/not-found replace
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
    expect(useGlobalProgressStore.getState().pendingCount).toBe(0);
    expect(hasActiveNavigation()).toBe(false);
  });
});

describe('navigation lifecycle cancel/fail convergence', () => {
  it('cancel 收敛：pending → completing → idle（无残留）', () => {
    commitResolvedHref('/');
    shouldProceedWithNavigation('/motion', 'nav');
    expect(useGlobalProgressStore.getState().phase).toBe('pending');
    cancelRouteNavigation();
    expect(useGlobalProgressStore.getState()).toMatchObject({
      pendingCount: 0,
      phase: 'completing',
    });
    expect(hasActiveNavigation()).toBe(false);
    useGlobalProgressStore.getState().exitComplete();
    expect(useGlobalProgressStore.getState().phase).toBe('idle');
  });

  it('fail 收敛：pending → completing', () => {
    commitResolvedHref('/');
    shouldProceedWithNavigation('/motion', 'nav');
    failRouteNavigation();
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
    expect(useGlobalProgressStore.getState().pendingCount).toBe(0);
    expect(hasActiveNavigation()).toBe(false);
  });

  it('无活跃事务时 cancel/fail 是安全 no-op', () => {
    cancelRouteNavigation();
    failRouteNavigation();
    expect(useGlobalProgressStore.getState()).toMatchObject({ pendingCount: 0, phase: 'idle' });
  });

  it('同路由 no-op 点击（相对旧基线）不打断另一路由进行中的活跃事务', () => {
    commitResolvedHref('/');
    shouldProceedWithNavigation('/motion', 'nav');
    expect(hasActiveNavigation()).toBe(true);
    expect(useGlobalProgressStore.getState().pendingCount).toBe(1);
    // /motion 导航进行中（基线仍为 /），此时再点“总览”链接（= 基线 /）是 no-op，
    // 不得取消进行中的 /motion 事务，也不得新增 pending。
    expect(shouldProceedWithNavigation('/')).toBe(false);
    expect(hasActiveNavigation()).toBe(true);
    expect(useGlobalProgressStore.getState().pendingCount).toBe(1);
    // /motion 事务继续，commit 后正常收敛
    completeRouteNavigation('/motion');
    expect(useGlobalProgressStore.getState().phase).toBe('completing');
    expect(useGlobalProgressStore.getState().pendingCount).toBe(0);
  });
});
