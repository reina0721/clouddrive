'use client';

import { createHydrationLifecycle, rehydrateStore } from '@clouddrive/state-foundation';
import { useEffect, useSyncExternalStore } from 'react';

import { useDictionariesStore } from '../stores/dictionaries';

const lifecycle = createHydrationLifecycle(useDictionariesStore);
const subscribe = (onChange: () => void) => lifecycle.subscribe(onChange);
const getStatus = () => lifecycle.status;
const getServerStatus = () => 'idle' as const;

/**
 * 字典 store 的 hydration 门控：显式触发、错误可恢复、不静默覆盖损坏记录。
 */
export function useDictionariesHydration() {
  const status = useSyncExternalStore(subscribe, getStatus, getServerStatus);
  useEffect(() => {
    rehydrateStore(useDictionariesStore);
  }, []);
  const recover = () => {
    useDictionariesStore.persist.clearStorage();
    lifecycle.reset();
    rehydrateStore(useDictionariesStore);
  };
  return { status, recover } as const;
}
