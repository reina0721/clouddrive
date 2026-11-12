'use client';
import { AdministrationRuntime } from '../administration/runtime';
import { useEffect, useMemo, type ReactNode } from 'react';
import { createAppStore } from '@clouddrive/state-foundation';
import {
  AccountSecurityProvider,
  type AccountSecurityPort,
  IdentityProvider,
  IdentityError,
  type IdentityPort,
} from '@clouddrive/surface/identity/runtime';
import { useAuth, AuthContext } from '../auth/context';
import { useContext } from 'react';
import { readAuthConfig } from '../auth/config';
import { AuthError } from '../auth/contract';
import type { createMockIdentityService } from './mock-service';
import type { IdentityOperations } from './mock-service';
import { createAccountRequest } from '../api/account-request';
import type { createBackendIdentityService } from './backend-service';

/** Concrete product composition; no service registry or cross-plugin private store access. */
export function IdentityRuntime({ children }: Readonly<{ children: ReactNode }>) {
  const auth = useAuth();
  const controller = useContext(AuthContext);
  if (!controller) throw new Error('AuthContext is required.');
  const authController = controller;
  const runtime = useMemo(() => {
    const revision = createAppStore<{ value: number }>(() => ({ value: 0 }));
    const invalidate = () => revision.setState((prior) => ({ value: prior.value + 1 }));
    const config = (() => {
      try {
        return readAuthConfig();
      } catch {
        return null;
      }
    })();
    let initialized: Promise<{
      createBackendIdentityService: typeof createBackendIdentityService;
    }> | null = null;
    let mockModule: Promise<
      Readonly<{ createMockIdentityService: typeof createMockIdentityService }>
    > | null = null;
    const currentUserId = () => authController.getState().session?.user.id ?? null;
    const service = async (owner: string) => {
      if (!config) throw new IdentityError('configuration');
      if (config.mode === 'mock') {
        const module = await (mockModule ??= import('./mock-service'));
        // Pending operations keep their original actor; switching accounts cannot rebind a write.
        return module.createMockIdentityService(() => owner);
      }
      const module = await (initialized ??= import('./backend-service'));
      return module.createBackendIdentityService(
        config.apiBaseUrl,
        createAccountRequest(currentUserId, owner),
      );
    };
    async function call<T>(
      operation: (service: IdentityOperations) => Promise<T>,
      mutate = false,
      restoreIdentity = true,
    ) {
      const owner = currentUserId();
      if (!owner) throw new IdentityError('unauthenticated');
      try {
        const operations = await service(owner);
        if (owner !== currentUserId()) throw new IdentityError('unauthenticated');
        const value = await operation(operations);
        if (owner !== currentUserId()) throw new IdentityError('unauthenticated');
        if (mutate) {
          invalidate();
          if (restoreIdentity) await authController.getState().restore();
          if (owner !== currentUserId()) throw new IdentityError('unauthenticated');
        }
        return value;
      } catch (error) {
        if (owner !== currentUserId()) throw new IdentityError('unauthenticated');
        if (
          error instanceof IdentityError &&
          error.code === 'unauthenticated' &&
          owner === currentUserId()
        )
          authController.getState().expire();
        if (error instanceof AuthError)
          throw new IdentityError(error.code === 'protocol' ? 'protocol' : 'persistence');
        throw error;
      }
    }
    const port: IdentityPort = {
      mode: config?.mode ?? 'backend',
      currentUserId,
      getRevision: () => revision.getState().value,
      subscribe: (listener) => revision.subscribe(listener),
      access: () =>
        call(async (service) => {
          const access = await service.access();
          if (access.user.id !== currentUserId()) throw new IdentityError('protocol');
          return access;
        }),
      batchStatus: (input) => call((service) => service.batchStatus(input), true),
      roleSummaries: () => call((service) => service.roleSummaries()),
      roleMembers: (id, query) => call((service) => service.roleMembers(id, query)),
      changeRoleMember: (roleId, userId, version, add) =>
        call((service) => service.changeRoleMember(roleId, userId, version, add), true),
      inboxPage: (query) =>
        call(async (service) => {
          const result = await service.inboxPage(query);
          if (result.items.some((item) => item.ownerId !== currentUserId()))
            throw new IdentityError('protocol');
          return result;
        }),
      readNotification: (id) =>
        call(async (service) => {
          const item = await service.readNotification(id);
          if (item.ownerId !== currentUserId()) throw new IdentityError('protocol');
          return item;
        }),
      readAllNotifications: () => call((service) => service.readAllNotifications(), true, false),
      roles: (selfOnly) => call((service) => service.roles(selfOnly)),
      registrationSettings: () => call((service) => service.registrationSettings()),
      updateRegistrationSettings: (input) =>
        call((service) => service.updateRegistrationSettings(input), true, false),
      readRole: (id) => call((service) => service.readRole(id)),
      createRole: (input) => call((service) => service.createRole(input), true),
      updateRole: (id, input) => call((service) => service.updateRole(id, input), true),
      inbox: () =>
        call(async (service) => {
          const items = await service.inbox();
          if (items.some((item) => item.ownerId !== currentUserId()))
            throw new IdentityError('protocol');
          return items;
        }),
      readNotifications: (ids) => call((service) => service.readNotifications(ids), true, false),
      audit: (query) => call((service) => service.audit(query)),
      readAudit: (id) => call((service) => service.readAudit(id)),
      list: (query) => call((service) => service.list(query)),
      read: (id) => call((service) => service.read(id)),
      me: () =>
        call(async (service) => {
          const user = await service.me();
          if (user.id !== currentUserId()) throw new IdentityError('protocol');
          return user;
        }),
      create: (input) => call((service) => service.create(input), true),
      update: (id, input) => call((service) => service.update(id, input), true),
      updateMe: (input) => call((service) => service.updateMe(input), true),
      setStatus: (id, version, status) =>
        call((service) => service.setStatus(id, version, status), true),
      setRoles: (id, version, roleIds) =>
        call((service) => service.setRoles(id, version, roleIds), true),
    };
    const security: AccountSecurityPort = {
      sessions: () => securityCall((service) => service.sessions()),
      changePassword: (current, next) =>
        securityCall((service) => service.changePassword(current, next), true),
      revokeSession: (id) => securityCall((service) => service.revokeSession(id), false, true),
      revokeOtherSessions: () =>
        securityCall((service) => service.revokeOtherSessions(), false, true),
    };
    async function securityCall<T>(
      operation: (service: AccountSecurityPort) => Promise<T>,
      expire = false,
      restore = false,
    ) {
      const owner = currentUserId();
      if (!owner || !config) throw new IdentityError('unauthenticated');
      const module = await import('../auth/account-security-service');
      if (owner !== currentUserId()) throw new IdentityError('unauthenticated');
      const service =
        config.mode === 'mock'
          ? module.createMockAccountSecurity(() => owner)
          : module.createBackendAccountSecurity(
              config.apiBaseUrl,
              createAccountRequest(currentUserId, owner),
            );
      try {
        const value = await operation(service);
        if (owner !== currentUserId()) throw new IdentityError('unauthenticated');
        if (expire || restore) invalidate();
        if (expire) authController.getState().expire();
        else if (restore) await authController.getState().restore();
        return value;
      } catch (error) {
        if (owner !== currentUserId()) throw new IdentityError('unauthenticated');
        if (
          error instanceof IdentityError &&
          error.code === 'unauthenticated' &&
          owner === currentUserId()
        )
          authController.getState().expire();
        throw error;
      }
    }
    return { port, security, invalidate };
  }, [authController]);
  useEffect(() => {
    runtime.invalidate();
  }, [runtime, auth.session?.user.id]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === 'clouddrive.auth-mock') runtime.invalidate();
    };
    window.addEventListener('storage', changed);
    window.addEventListener('focus', runtime.invalidate);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener('focus', runtime.invalidate);
    };
  }, [runtime]);
  return (
    <IdentityProvider port={runtime.port}>
      <AccountSecurityProvider port={runtime.security}>
        <AdministrationRuntime>{children}</AdministrationRuntime>
      </AccountSecurityProvider>
    </IdentityProvider>
  );
}
