'use client';
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { AdministrationPort } from './model';
const Context = createContext<AdministrationPort | null>(null);
export function AdministrationProvider({
  port,
  children,
}: Readonly<{ port: AdministrationPort | null; children: ReactNode }>) {
  return <Context value={port}>{children}</Context>;
}
export function useAdministration() {
  return useContext(Context);
}
export function useRequiredAdministration(): AdministrationPort {
  const port = useAdministration();
  if (!port) throw new Error('Backend administration is required');
  return port;
}
