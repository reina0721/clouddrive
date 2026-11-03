import { describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { parseAuthConfig } from '../auth/config';
import { AuthError, readSession, safeReturnTo, type AuthSession } from '../auth/contract';
import { createBackendAuthService } from '../auth/backend-adapter';
import {
  createMockAuthService,
  MOCK_DEMO_EMAIL,
  MOCK_DEMO_PASSWORD,
  type MockAccount,
} from '../auth/mock-adapter';

describe('Authentication configuration and redirects', () => {
  it('defaults to backend mode and never falls back after errors', () => {
    expect(parseAuthConfig(undefined, undefined, false)).toEqual({
      mode: 'backend',
      apiBaseUrl: '/api/console/v1',
    });
    expect(parseAuthConfig(undefined, undefined, true)).toEqual({
      mode: 'backend',
      apiBaseUrl: '/api/console/v1',
    });
    expect(parseAuthConfig('mock', undefined, true)).toEqual({ mode: 'mock' });
    expect(parseAuthConfig('backend', '/api', true)).toEqual({
      mode: 'backend',
      apiBaseUrl: '/api',
    });
    for (const url of [
      'https://user:secret@example.com',
      '//evil.test',
      'http://api.example.com',
      'https://api.example.com?key=secret',
    ]) {
      expect(() => parseAuthConfig('backend', url, true)).toThrow(AuthError);
      expect(() => parseAuthConfig(undefined, url, true)).toThrow(AuthError);
    }
  });
  it('keeps internal destinations and rejects external and recursive redirects', () => {
    expect(safeReturnTo('/reference-resources?status=active#row')).toBe(
      '/reference-resources?status=active#row',
    );
    for (const value of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      '/login',
      '/register?returnTo=/',
      '/session-expired',
      '/%2e%2e/login',
    ])
      expect(safeReturnTo(value)).toBe('/');
  });
  it('rejects malformed session payloads without storing unknown fields', () => {
    expect(() => readSession({ user: { id: '1' }, expiresAt: 10 })).toThrow(AuthError);
    expect(
      readSession({
        user: { id: '1', name: 'Rin', email: 'demo@community.test', token: 'not-retained' },
        expiresAt: 10,
      }),
    ).toEqual({ user: { id: '1', name: 'Rin', email: 'demo@community.test' }, expiresAt: 10 });
  });
});

describe('Backend authentication adapter', () => {
  const input = { email: 'person@example.test', password: 'not-persisted' };
  it('uses credentialed CSRF-protected writes then validates the server session', async () => {
    const session = {
      user: { id: 'backend-1', name: 'Person', email: input.email },
      expiresAt: Date.now() + 60_000,
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ token: 'csrf' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json(session));
    await expect(createBackendAuthService('/api', request).login(input)).resolves.toEqual(session);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/csrf',
      '/api/auth/login',
      '/api/auth/session',
    ]);
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'X-CSRF-Token': 'csrf' },
      body: JSON.stringify(input),
    });
  });
  it('distinguishes expired sessions from network failures and never returns a demo user', async () => {
    await expect(
      createBackendAuthService(
        '/api',
        vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 })),
      ).restore(),
    ).resolves.toBeNull();
    await expect(
      createBackendAuthService(
        '/api',
        vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')),
      ).restore(),
    ).rejects.toMatchObject({ code: 'network' });
    await expect(
      createBackendAuthService(
        '/api',
        vi.fn<typeof fetch>().mockResolvedValue(Response.json({ user: {} })),
      ).restore(),
    ).rejects.toMatchObject({ code: 'protocol' });
  });
  it('bounds hung requests and preserves a timeout error', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn<typeof fetch>().mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      );
      const pending = expect(
        createBackendAuthService('/api', request).restore(),
      ).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(15_000);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Mock authentication demo', () => {
  it('registers a new identity and verifies its salted digest without retaining its password', async () => {
    vi.stubGlobal('crypto', webcrypto);
    try {
      let session: AuthSession | null = null;
      const accounts: MockAccount[] = [];
      const repository = {
        readAccounts: () => Promise.resolve(accounts),
        saveAccount: (account: MockAccount) => {
          accounts.push(account);
          return Promise.resolve();
        },
        readSession: () => Promise.resolve(session),
        saveSession: (next: AuthSession | null) => {
          session = next;
          return Promise.resolve();
        },
      };
      const service = createMockAuthService(repository);
      const input = {
        name: 'New member',
        email: 'New@Community.test',
        password: 'DifferentPassword2026!',
      };
      const registered = await service.register(input);
      expect(registered.user).toMatchObject({ name: input.name, email: 'new@community.test' });
      expect(JSON.stringify(accounts)).not.toContain(input.password);
      expect(accounts[0]?.digest).toMatch(/^[a-f0-9]{64}$/);
      await service.logout();
      expect(await createMockAuthService(repository).login(input)).toMatchObject({
        user: registered.user,
      });
      await expect(service.login({ ...input, password: 'wrong' })).rejects.toMatchObject({
        code: 'credentials',
      });
      await expect(service.register(input)).rejects.toMatchObject({ code: 'account-exists' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('supports login, refresh restoration, failed credentials, expiry and logout', async () => {
    let session: AuthSession | null = null;
    const accounts: MockAccount[] = [];
    const service = createMockAuthService({
      readAccounts: () => Promise.resolve(accounts),
      saveAccount: (account) => {
        accounts.push(account);
        return Promise.resolve();
      },
      readSession: () => Promise.resolve(session),
      saveSession: (next) => {
        session = next;
        return Promise.resolve();
      },
    });
    expect(await service.restore()).toBeNull();
    await expect(
      service.login({ email: MOCK_DEMO_EMAIL, password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'credentials' });
    const signedIn = await service.login({ email: MOCK_DEMO_EMAIL, password: MOCK_DEMO_PASSWORD });
    expect(await service.restore()).toEqual(signedIn);
    await service.logout();
    expect(await service.restore()).toBeNull();
    session = { ...signedIn, expiresAt: 1 };
    expect(await service.restore()).toBeNull();
    expect(session).toBeNull();
    await expect(
      service.register({ email: MOCK_DEMO_EMAIL, password: 'any', name: 'Duplicate' }),
    ).rejects.toMatchObject({ code: 'account-exists' });
  });
});
