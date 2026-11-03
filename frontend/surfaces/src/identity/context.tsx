'use client';
/* Public composition entry exposes the provider and its typed consumption hook. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { IdentityPort } from './model';
const IdentityContext = createContext<IdentityPort | null>(null);
export function IdentityProvider({
  port,
  children,
}: Readonly<{ port: IdentityPort; children: ReactNode }>) {
  return <IdentityContext value={port}>{children}</IdentityContext>;
}
export function useIdentityPort(): IdentityPort {
  const port = useContext(IdentityContext);
  if (!port) throw new Error('IdentityProvider is required.');
  return port;
}
