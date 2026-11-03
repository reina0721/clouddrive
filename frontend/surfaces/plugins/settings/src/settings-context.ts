import { createContext, useContext } from 'react';
import type { Ctx } from './category-sections';
export const SettingsShellContext = createContext<Ctx | null>(null);
/** 分类 page 取壳 ctx（必须在 SettingsShellProvider 内）。 */
export function useSettingsShell(): Ctx {
  const value = useContext(SettingsShellContext);
  if (!value) {
    throw new Error('useSettingsShell 必须在 SettingsShellProvider 内使用（layout 提供）');
  }
  return value;
}
