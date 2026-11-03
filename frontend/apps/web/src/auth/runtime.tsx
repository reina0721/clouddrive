'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { createAuthController } from './controller';
import { applyAccountBoundary } from './account-boundary';
import { AuthContext } from './context';
import type { AuthService } from './contract';
import { IdentityRuntime } from '../identity/runtime';

export function AuthRuntime({ children }: Readonly<{ children: ReactNode }>) {
  const [controller] = useState(() => {
    let initialized: Promise<AuthService> | null = null;
    let identity: string | null | undefined;
    const service = () =>
      (initialized ??= import('./service').then((module) => module.createConfiguredAuthService()));
    return createAuthController(
      {
        restore: async () => (await service()).restore(),
        login: async (input) => (await service()).login(input),
        register: async (input) => (await service()).register(input),
        logout: async () => (await service()).logout(),
      },
      (userId) => {
        applyAccountBoundary(userId);
        const switched =
          identity !== undefined && identity !== null && userId !== null && identity !== userId;
        identity = userId;
        if (switched) window.location.reload();
        return switched;
      },
    );
  });
  const session = controller((state) => state.session);
  useEffect(() => {
    void controller.getState().restore();
    const synchronize = (event: StorageEvent) => {
      // Restore checks identity/status; only an actual owner switch reloads private modules.
      if (event.key === 'clouddrive.auth-mock') void controller.getState().restore();
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, [controller]);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('clouddrive.auth-session');
    // A signal invalidates this document; it never supplies or authorizes an identity.
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === 'session-changed') window.location.reload();
    };
    const unsubscribe = controller.subscribe((next, previous) => {
      if (!previous.busy || next.busy) return;
      if (
        (next.status === 'authenticated' &&
          (next.authenticatedFrom === 'login' || next.authenticatedFrom === 'register')) ||
        (next.status === 'anonymous' && next.endReason === 'logout')
      )
        channel.postMessage('session-changed');
    });
    return () => {
      unsubscribe();
      channel.close();
    };
  }, [controller]);
  useEffect(() => {
    if (!session) return;
    const expire = () => controller.getState().expire();
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      expire();
      return;
    }
    const timer = setTimeout(
      () => {
        if (Date.now() >= session.expiresAt) expire();
        else void controller.getState().restore();
      },
      Math.min(remaining, 2_147_483_647),
    );
    const verify = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() >= session.expiresAt) expire();
      else void controller.getState().restore();
    };
    window.addEventListener('focus', verify);
    document.addEventListener('visibilitychange', verify);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', verify);
      document.removeEventListener('visibilitychange', verify);
    };
  }, [controller, session]);
  return (
    <AuthContext value={controller}>
      <IdentityRuntime>{children}</IdentityRuntime>
    </AuthContext>
  );
}
