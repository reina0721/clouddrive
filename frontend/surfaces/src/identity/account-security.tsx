'use client';
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
export type AccountSession = Readonly<{
  id: string;
  device: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}>;
export interface AccountSecurityPort {
  sessions(): Promise<readonly AccountSession[]>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  revokeSession(id: string): Promise<void>;
  revokeOtherSessions(): Promise<void>;
}
const SecurityContext = createContext<AccountSecurityPort | null>(null);
export function AccountSecurityProvider({
  port,
  children,
}: Readonly<{ port: AccountSecurityPort; children: ReactNode }>) {
  return <SecurityContext value={port}>{children}</SecurityContext>;
}
export function useAccountSecurityPort(): AccountSecurityPort {
  const port = useContext(SecurityContext);
  if (!port) throw new Error('AccountSecurityProvider is required.');
  return port;
}
