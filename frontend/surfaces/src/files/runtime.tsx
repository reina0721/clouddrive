'use client';
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { FilesPort } from './model';

const Context = createContext<FilesPort | null>(null);
export function FilesProvider({
  port,
  children,
}: Readonly<{ port: FilesPort; children: ReactNode }>) {
  return <Context value={port}>{children}</Context>;
}
export function useFiles(): FilesPort {
  const port = useContext(Context);
  if (!port) throw new Error('Files runtime is required');
  return port;
}
