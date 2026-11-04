'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { FilesRuntime } from '../files/runtime';
import { AppShell } from './app-shell';
import { RouteTransition } from '../host/route-transition';

export function ApplicationChrome({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  if (pathname === '/home')
    return (
      <FilesRuntime>
        <RouteTransition>{children}</RouteTransition>
      </FilesRuntime>
    );
  return <AppShell>{children}</AppShell>;
}
