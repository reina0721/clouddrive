'use client';

import { createContext, useContext } from 'react';

import type { GlobalProgressController } from './global-progress-controller';

export const GlobalProgressContext = createContext<GlobalProgressController | null>(null);

/** useGlobalProgress 返回 Host 单例 Global Pending Controller，必须在 Provider 内使用。 */
export function useGlobalProgress(): GlobalProgressController {
  const controller = useContext(GlobalProgressContext);
  if (!controller) {
    throw new Error('useGlobalProgress 必须在 GlobalProgressProvider 内使用');
  }
  return controller;
}
