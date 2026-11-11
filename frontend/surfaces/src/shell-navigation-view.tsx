'use client';
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { NavigationGroup } from '@clouddrive/types';

export type ShellNavigationView = Readonly<{
  groups: readonly NavigationGroup[];
  status: 'loading' | 'ready' | 'error';
  onReload: () => void;
  labels: Readonly<Record<string, string>>;
}>;
const Context = createContext<ShellNavigationView | null>(null);

/** 已经应用权限和菜单覆盖的呈现快照，不拥有路由或授权。 */
export function ShellNavigationViewProvider({
  groups,
  labels,
  status,
  onReload,
  children,
}: ShellNavigationView & { children: ReactNode }) {
  const value = useMemo(
    () => ({ groups, labels, status, onReload }),
    [groups, labels, status, onReload],
  );
  return <Context value={value}>{children}</Context>;
}
export function useShellNavigationView(): ShellNavigationView {
  const view = useContext(Context);
  if (!view) throw new Error('ShellNavigationViewProvider is required.');
  return view;
}
