'use client';

import { useEffect } from 'react';

import { useLockStore } from '../state/use-lock-store';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * 空闲 / 后台锁屏（Host 生命周期）。
 *
 * - 只在已登录会话上工作，账号变化时清掉上一账号的锁定；
 * - 空闲计时由真实输入事件重置，锁定后不再安排新计时；
 * - `lockOnHidden` 在页面进入后台时立即锁定；
 * - 设置页"立即锁定"通过 `clouddrive:lock` 事件复用同一入口。
 */
export function useIdleLock(
  userId: string | null,
  options: Readonly<{ idleLockMinutes: number; lockOnHidden: boolean }>,
): void {
  const idleLockMinutes = options.idleLockMinutes;
  const lockOnHidden = options.lockOnHidden;
  useEffect(() => {
    if (!userId) return;
    const current = useLockStore.getState();
    if (current.locked && current.userId !== userId) current.unlock();

    let timer: number | undefined;
    const clear = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      clear();
      if (idleLockMinutes <= 0) return;
      timer = window.setTimeout(
        () => useLockStore.getState().lock(userId, 'idle'),
        idleLockMinutes * 60_000,
      );
    };
    const onActivity = () => {
      if (!useLockStore.getState().locked) schedule();
    };
    const onVisibility = () => {
      if (lockOnHidden && document.visibilityState === 'hidden')
        useLockStore.getState().lock(userId, 'hidden');
    };
    const onExplicitLock = () => useLockStore.getState().lock(userId, 'manual');

    schedule();
    for (const event of ACTIVITY_EVENTS)
      window.addEventListener(event, onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('clouddrive:lock', onExplicitLock);
    return () => {
      clear();
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('clouddrive:lock', onExplicitLock);
    };
  }, [idleLockMinutes, lockOnHidden, userId]);
}

/** 组件树外（设置页按钮）请求立即锁定。 */
export function requestLock(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('clouddrive:lock'));
}
