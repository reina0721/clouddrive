'use client';

import { type ReactNode } from 'react';

import { GlobalProgressContext } from './global-progress-context';
import { globalProgressController } from './navigation-progress';

/**
 * GlobalProgressProvider 在 Host 装配点注入唯一的 Global Pending Controller。
 * 与导航生命周期共享同一 store 单例，保证全局状态一致。
 */
export function GlobalProgressProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <GlobalProgressContext value={globalProgressController}>{children}</GlobalProgressContext>;
}
