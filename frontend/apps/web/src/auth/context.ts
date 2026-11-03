'use client';
import { createContext, useContext } from 'react';
import type { AuthController } from './controller';

export const AuthContext = createContext<AuthController | null>(null);
export function useAuth() {
  const useController = useContext(AuthContext);
  if (!useController) throw new Error('Authentication provider is required.');
  return useController();
}
