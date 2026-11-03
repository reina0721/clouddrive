'use client';

import { createHydrationLifecycle, rehydrateStore } from '@clouddrive/state-foundation';
import { useEffect, useSyncExternalStore } from 'react';

import { useDepartmentsStore } from '../stores/departments';

const lifecycle = createHydrationLifecycle(useDepartmentsStore);
const subscribe = (onChange: () => void) => lifecycle.subscribe(onChange);
const getStatus = () => lifecycle.status;
const getServerStatus = () => 'idle' as const;

/**
 * 部门 store 的 hydration 门控：显式触发、错误可恢复、不静默覆盖损坏记录。
 */
export function useDepartmentsHydration() {
  const status = useSyncExternalStore(subscribe, getStatus, getServerStatus);
  useEffect(() => {
    rehydrateStore(useDepartmentsStore);
  }, []);
  const recover = () => {
    useDepartmentsStore.persist.clearStorage();
    lifecycle.reset();
    rehydrateStore(useDepartmentsStore);
  };
  return { status, recover } as const;
}
