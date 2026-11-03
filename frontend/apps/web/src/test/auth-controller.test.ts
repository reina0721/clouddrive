import { expect, it, vi } from 'vitest';
import { createAuthController } from '../auth/controller';
import { AuthError, type AuthService, type AuthSession } from '../auth/contract';

const session: AuthSession = {
  user: { id: '1', name: 'Person', email: 'person@example.test' },
  expiresAt: Date.now() + 60_000,
};
function service(): AuthService {
  return {
    restore: () => Promise.resolve(session),
    login: () => Promise.resolve(session),
    register: () => Promise.resolve(session),
    logout: () => Promise.resolve(),
  };
}

it('restores one current identity and clears content before logout completes', async () => {
  const changed = vi.fn();
  const adapter = service();
  let finish: (() => void) | undefined;
  adapter.logout = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  const controller = createAuthController(adapter, changed);
  await controller.getState().restore();
  expect(controller.getState()).toMatchObject({ status: 'authenticated', session, busy: false });
  const pending = controller.getState().logout();
  expect(controller.getState()).toMatchObject({ session: null, status: 'restoring' });
  expect(changed).toHaveBeenCalledTimes(2);
  finish?.();
  expect(await pending).toBe(true);
  expect(controller.getState().status).toBe('anonymous');
});

it('submits credentials once while authentication is pending', async () => {
  const adapter = service();
  let finish: ((value: AuthSession) => void) | undefined;
  const login = vi.fn(
    () =>
      new Promise<AuthSession>((resolve) => {
        finish = resolve;
      }),
  );
  adapter.login = login;
  const controller = createAuthController(adapter, vi.fn());
  const input = { email: session.user.email, password: 'transient' };
  const pending = controller.getState().login(input);
  expect(await controller.getState().login(input)).toBe(false);
  expect(login).toHaveBeenCalledTimes(1);
  finish?.(session);
  expect(await pending).toBe(true);
});

it('never resurrects a user from an old restore after expiry', async () => {
  const adapter = service();
  let finish: ((value: AuthSession) => void) | undefined;
  adapter.restore = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const controller = createAuthController(adapter, vi.fn());
  const pending = controller.getState().restore();
  controller.getState().expire();
  finish?.(session);
  await pending;
  expect(controller.getState()).toMatchObject({ status: 'anonymous', session: null, busy: false });
});

it('does not expose private content when server logout fails and retains retry semantics', async () => {
  const adapter = service();
  adapter.logout = () => Promise.reject(new AuthError('network'));
  const controller = createAuthController(adapter, vi.fn());
  await controller.getState().restore();
  expect(await controller.getState().logout()).toBe(false);
  expect(controller.getState()).toMatchObject({
    session: null,
    status: 'error',
    error: 'network',
    failedOperation: 'logout',
  });
});

it('keeps protected content hidden while an account boundary requires a new document', async () => {
  const adapter = service();
  const changed = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
  const controller = createAuthController(adapter, changed);
  await controller.getState().restore();
  const other = { ...session, user: { ...session.user, id: 'other' } };
  adapter.restore = () => Promise.resolve(other);
  await controller.getState().restore();
  expect(controller.getState()).toMatchObject({ session: null, status: 'restoring', busy: true });
  expect(changed).toHaveBeenLastCalledWith('other');
});

it('clears identity even when private-state cleanup throws during expiry', async () => {
  const changed = vi
    .fn()
    .mockImplementationOnce(() => undefined)
    .mockImplementationOnce(() => {
      throw new Error('Storage unavailable');
    });
  const controller = createAuthController(service(), changed);
  await controller.getState().restore();
  controller.getState().expire();
  expect(controller.getState()).toMatchObject({
    session: null,
    status: 'error',
    error: 'unavailable',
    busy: false,
  });
});
