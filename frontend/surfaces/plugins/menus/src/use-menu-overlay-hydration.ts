'use client';

import { useNavigationAdminPort } from '@clouddrive/plugin-framework/navigation-admin';
import { useSyncExternalStore } from 'react';

/**
 * 菜单覆盖的 hydration 门控（Port 形态）。
 *
 * 持久化记录由 Host 水合；`hydrated=false`（Port 快照）表示本地记录无法解析：
 * 页面呈现可恢复警告，由用户显式 `recover()` 清除损坏记录，不静默覆盖。
 */
export function useMenuOverlayHydration() {
  const port = useNavigationAdminPort();
  const hydrated = useSyncExternalStore(
    port.subscribe,
    () => port.getSnapshot().hydrated,
    () => true,
  );
  return {
    status: hydrated ? ('hydrated' as const) : ('error' as const),
    recover: port.recover,
  } as const;
}
