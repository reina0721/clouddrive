import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useIdleLock, requestLock } from '../shell/use-idle-lock';
import { useLockStore } from '../state/use-lock-store';

beforeEach(() => {
  vi.useFakeTimers();
  useLockStore.getState().unlock();
});
afterEach(() => {
  useLockStore.getState().unlock();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('手动锁定清理旧空闲计时；解锁后重新开始空闲计时', () => {
  const { unmount } = renderHook(() =>
    useIdleLock('owner', { idleLockMinutes: 1, lockOnHidden: false }),
  );
  act(() => {
    vi.advanceTimersByTime(30000);
    requestLock();
  });
  expect(useLockStore.getState().reason).toBe('manual');
  const snapshot = useLockStore.getState().lockedAt;
  act(() => {
    vi.advanceTimersByTime(60000);
  });
  expect(useLockStore.getState().lockedAt).toBe(snapshot);
  act(() => useLockStore.getState().unlock());
  act(() => {
    vi.advanceTimersByTime(60000);
  });
  expect(useLockStore.getState().reason).toBe('idle');
  unmount();
  act(() => {
    useLockStore.getState().unlock();
    vi.advanceTimersByTime(120000);
  });
  expect(useLockStore.getState().locked).toBe(false);
});

it('后台锁和账号切换共用当前账号状态，卸载后不保留监听', () => {
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  const { rerender, unmount } = renderHook(
    ({ id }) => useIdleLock(id, { idleLockMinutes: 0, lockOnHidden: true }),
    { initialProps: { id: 'first' } },
  );
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(useLockStore.getState().reason).toBe('hidden');
  expect(useLockStore.getState().userId).toBe('first');
  rerender({ id: 'second' });
  expect(useLockStore.getState().locked).toBe(false);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(useLockStore.getState().userId).toBe('second');
  unmount();
  act(() => useLockStore.getState().unlock());
  act(() => requestLock());
  expect(useLockStore.getState().locked).toBe(false);
  visibility.mockRestore();
});
