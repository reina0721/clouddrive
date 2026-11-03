'use client';
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, type ReactNode } from 'react';
import type { ApiWorkbenchPort } from './model';

const ApiWorkbenchContext = createContext<ApiWorkbenchPort | null>(null);

export function ApiWorkbenchProvider({
  port,
  children,
}: Readonly<{ port: ApiWorkbenchPort; children: ReactNode }>) {
  return <ApiWorkbenchContext value={port}>{children}</ApiWorkbenchContext>;
}

export function useApiWorkbenchPort(): ApiWorkbenchPort {
  const port = useContext(ApiWorkbenchContext);
  if (!port) throw new Error('ApiWorkbenchProvider is required.');
  return port;
}
