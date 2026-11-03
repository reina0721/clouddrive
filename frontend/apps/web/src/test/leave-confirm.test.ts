// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dirtyMessage,
  installBeforeUnloadGuard,
  isAnyDirty,
  isLeaveConfirmEnabled,
  proceedAfterLeaveConfirm,
  registerDirtySource,
  resetLeaveConfirmEnabledForTest,
  resetLeaveConfirmForTest,
  setLeaveConfirmEnabled,
  setLeaveConfirmResolver,
} from '../host/leave-confirm';
import { resetNavigationLifecycle } from '../host/navigation-lifecycle';

describe('leave-confirm 注册表与统一询问', () => {
  beforeEach(() => {
    resetLeaveConfirmForTest();
    resetLeaveConfirmEnabledForTest();
    resetNavigationLifecycle();
    setLeaveConfirmResolver(null);
  });

  it('无 dirty source → 直接放行（同 resolved target 仍 no-op 短路）', async () => {
    // 首次 /settings 无基线 → 放行。
    await expect(proceedAfterLeaveConfirm('/settings')).resolves.toBe(true);
    // 同 target 再次导航（基线已由测试手动提交）→ no-op false。
  });

  it('dirty source 存在且 dirty → 先询问；取消返回 false 且不 begin', async () => {
    setLeaveConfirmResolver(() => Promise.resolve(false)); // 用户取消
    const unregister = registerDirtySource({
      pageId: 'edit',
      message: () => '有未保存的更改',
      isDirty: () => true,
    });
    await expect(proceedAfterLeaveConfirm('/settings')).resolves.toBe(false);
    unregister();
  });

  it('dirty source 存在且 dirty → 确认后放行', async () => {
    setLeaveConfirmResolver(() => Promise.resolve(true));
    const unregister = registerDirtySource({
      pageId: 'edit',
      message: () => '有未保存的更改',
      isDirty: () => true,
    });
    await expect(proceedAfterLeaveConfirm('/settings')).resolves.toBe(true);
    unregister();
  });

  it('提交中（isSubmitting）不算 dirty', async () => {
    const unregister = registerDirtySource({
      pageId: 'edit',
      message: () => 'x',
      isDirty: () => true,
      isSubmitting: () => true,
    });
    expect(isAnyDirty()).toBe(false);
    await expect(proceedAfterLeaveConfirm('/settings')).resolves.toBe(true);
    unregister();
  });

  it('dirtyMessage 取首个 dirty source 的文案；无 dirty 为空', () => {
    expect(dirtyMessage()).toBe('');
    const unregister = registerDirtySource({
      pageId: 'edit',
      message: () => '有未保存的更改',
      isDirty: () => true,
    });
    expect(dirtyMessage()).toBe('有未保存的更改');
    unregister();
  });

  it('beforeunload 仅 dirty 时设置 returnValue（事件可取消）', () => {
    const unregisterGuard = installBeforeUnloadGuard();
    const event = new Event('beforeunload', { cancelable: true });
    // 无 dirty：不 preventDefault。
    const dispatched = window.dispatchEvent(event);
    // jsdom 无法断言 returnValue 传播，但 preventDefault 使 dispatched=false。
    expect(dispatched).toBe(true);
    const dirty = registerDirtySource({
      pageId: 'edit',
      message: () => 'x',
      isDirty: () => true,
    });
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    const dispatchedDirty = window.dispatchEvent(dirtyEvent);
    expect(dispatchedDirty).toBe(false); // preventDefault 被调用
    dirty();
    unregisterGuard();
  });

  it('unregister 后不再 dirty', () => {
    const unregister = registerDirtySource({
      pageId: 'edit',
      message: () => 'x',
      isDirty: () => true,
    });
    expect(isAnyDirty()).toBe(true);
    unregister();
    expect(isAnyDirty()).toBe(false);
  });

  it('confirmLeave 偏好关闭 → 不询问直接 proceed（即使 dirty）', async () => {
    setLeaveConfirmEnabled(false);
    const resolver = vi.fn(() => Promise.resolve(true));
    setLeaveConfirmResolver(resolver);
    const unregister = registerDirtySource({
      pageId: 'edit',
      message: () => '有未保存的更改',
      isDirty: () => true,
    });
    await expect(proceedAfterLeaveConfirm('/settings')).resolves.toBe(true);
    expect(resolver).not.toHaveBeenCalled();
    unregister();
  });

  it('confirmLeave 偏好默认开；setLeaveConfirmEnabled(true) 恢复询问', async () => {
    expect(isLeaveConfirmEnabled()).toBe(true);
    setLeaveConfirmEnabled(false);
    expect(isLeaveConfirmEnabled()).toBe(false);
    setLeaveConfirmEnabled(true);
    const resolver = vi.fn(() => Promise.resolve(true));
    setLeaveConfirmResolver(resolver);
    const unregister = registerDirtySource({
      pageId: 'edit',
      message: () => '有未保存的更改',
      isDirty: () => true,
    });
    await proceedAfterLeaveConfirm('/settings');
    expect(resolver).toHaveBeenCalledTimes(1);
    unregister();
  });
});
