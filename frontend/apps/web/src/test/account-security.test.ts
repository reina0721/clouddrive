import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  createMockAccountSecurity,
  createBackendAccountSecurity,
} from '../auth/account-security-service';
import { createMockAuthService, MOCK_DEMO_PASSWORD } from '../auth/mock-adapter';
import { createBrowserMockRepository } from '../auth/mock-repository';
import { withMockDirectory } from '../identity/mock-auth';
import {
  readMockDatabase,
  createDatabaseAuthRepository,
  MOCK_DATABASE_KEY,
} from '../identity/mock-database';
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  window.localStorage.removeItem(MOCK_DATABASE_KEY);
  await createDatabaseAuthRepository().saveSession({
    user: { id: 'mock-demo', name: 'Rin', email: 'demo@community.test' },
    expiresAt: Date.now() + 60000,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.removeItem(MOCK_DATABASE_KEY);
});
it('changes a password atomically, revokes all sessions and rejects the old credential', async () => {
  const security = createMockAccountSecurity(() => 'mock-demo');
  await expect(
    security.changePassword('wrong-password', 'ChangedPassword2026!'),
  ).rejects.toMatchObject({ code: 'validation' });
  expect((await security.sessions()).filter((item) => item.current)).toHaveLength(1);
  await security.changePassword(MOCK_DEMO_PASSWORD, 'ChangedPassword2026!');
  const database = await readMockDatabase();
  expect(database.session).toBeNull();
  expect(database.securitySessions).toEqual([]);
  expect(JSON.stringify(database.auditRecords)).not.toContain('ChangedPassword2026!');
  expect(JSON.stringify(database.auditRecords)).not.toContain(MOCK_DEMO_PASSWORD);
  const auth = withMockDirectory(createMockAuthService(createBrowserMockRepository()));
  await expect(
    auth.login({ email: 'demo@community.test', password: MOCK_DEMO_PASSWORD }),
  ).rejects.toMatchObject({ code: 'credentials' });
  expect(
    (await auth.login({ email: 'demo@community.test', password: 'ChangedPassword2026!' })).user.id,
  ).toBe('mock-demo');
});
it('revokes only owned sessions and preserves the current session when revoking others', async () => {
  const auth = withMockDirectory(createMockAuthService(createBrowserMockRepository()));
  await auth.login({ email: 'demo@community.test', password: MOCK_DEMO_PASSWORD });
  const security = createMockAccountSecurity(() => 'mock-demo');
  const sessions = await security.sessions();
  expect(sessions.length).toBeGreaterThan(1);
  await expect(security.revokeSession('foreign-session')).rejects.toMatchObject({
    code: 'not-found',
  });
  await security.revokeOtherSessions();
  const remaining = await security.sessions();
  expect(remaining).toHaveLength(1);
  expect(remaining[0]?.current).toBe(true);
  if (!remaining[0]) throw new Error('Missing current session');
  await security.revokeSession(remaining[0].id);
  expect(await auth.restore()).toBeNull();
  await expect(security.sessions()).rejects.toMatchObject({ code: 'unauthenticated' });
});
it('preserves v4 accounts and configuration while migrating session metadata in place', async () => {
  const prior = await readMockDatabase();
  const { securitySessions, ...state } = prior;
  expect(securitySessions.length).toBeGreaterThan(0);
  window.localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify({ version: 4, state }));
  const next = await readMockDatabase();
  expect(next.users).toEqual(prior.users);
  expect(next.accounts).toEqual(prior.accounts);
  expect(next.registrationSettings).toEqual(prior.registrationSettings);
  expect(next.securitySessions).toHaveLength(1);
  const stored: unknown = JSON.parse(window.localStorage.getItem(MOCK_DATABASE_KEY) ?? '');
  expect(stored).toMatchObject({ version: 5 });
});
it('enforces cookie, CSRF and strict session responses without falling back to mock', async () => {
  const calls: string[] = [];
  const request: typeof fetch = async (input, options) => {
    await Promise.resolve();
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(path);
    expect(options?.credentials).toBe('include');
    expect(options?.cache).toBe('no-store');
    if (path.endsWith('/auth/csrf')) return Response.json({ token: 'security-csrf' });
    if (options?.method !== 'GET')
      expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('security-csrf');
    if (path.endsWith('/auth/sessions'))
      return Response.json({
        items: [
          {
            id: 'current',
            device: 'Browser',
            createdAt: '2026-10-01T00:00:00Z',
            lastActiveAt: '2026-10-01T00:00:00Z',
            expiresAt: '2030-10-01T00:00:00Z',
            current: true,
            token: 'forbidden',
          },
        ],
      });
    return new Response(null, { status: 204 });
  };
  const security = createBackendAccountSecurity('/api', request);
  await expect(security.sessions()).rejects.toMatchObject({ code: 'protocol' });
  await security.revokeSession('current');
  expect(calls).toContain('/api/auth/sessions/current');
  await security.changePassword(MOCK_DEMO_PASSWORD, 'NewPassword2026!');
  expect(calls).toContain('/api/auth/password');
});
