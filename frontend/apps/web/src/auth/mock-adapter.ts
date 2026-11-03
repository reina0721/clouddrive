import { AuthError, type AuthService, type AuthSession, type AuthUser } from './contract';

export type MockAccount = Readonly<{ user: AuthUser; salt: string; digest: string }>;
export interface MockAuthRepository {
  readAccounts(): Promise<readonly MockAccount[]>;
  saveAccount(account: MockAccount): Promise<void>;
  readSession(): Promise<AuthSession | null>;
  saveSession(session: AuthSession | null): Promise<void>;
}

export const MOCK_SESSION_LIFETIME_MS = 30 * 60 * 1000;
export const MOCK_DEMO_EMAIL = 'demo@community.test';
export const MOCK_DEMO_PASSWORD = 'CommunityDemo2026!';

export async function passwordDigest(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100_000, hash: 'SHA-256' },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Development demo only. Client-controlled records provide no server authorization. */
export function createMockAuthService(repository: MockAuthRepository): AuthService {
  async function establish(user: AuthUser) {
    const session = {
      user,
      expiresAt: Date.now() + MOCK_SESSION_LIFETIME_MS,
      sessionId: `session-${crypto.randomUUID()}`,
    };
    await repository.saveSession(session);
    return session;
  }
  return {
    restore: async () => {
      const session = await repository.readSession();
      if (!session || session.expiresAt <= Date.now()) {
        await repository.saveSession(null);
        return null;
      }
      return session;
    },
    login: async ({ email, password }) => {
      const normalized = email.trim().toLowerCase();
      const account = (await repository.readAccounts()).find(
        (candidate) => candidate.user.email === normalized,
      );
      if (!account && normalized === MOCK_DEMO_EMAIL && password === MOCK_DEMO_PASSWORD) {
        return establish({ id: 'mock-demo', name: 'Rin', email: MOCK_DEMO_EMAIL });
      }
      if (!account || (await passwordDigest(password, account.salt)) !== account.digest)
        throw new AuthError('credentials');
      return establish(account.user);
    },
    register: async ({ name, email, password }) => {
      const normalized = email.trim().toLowerCase();
      if (
        normalized === MOCK_DEMO_EMAIL ||
        (await repository.readAccounts()).some((account) => account.user.email === normalized)
      )
        throw new AuthError('account-exists');
      const user = { id: `mock-${crypto.randomUUID()}`, name: name.trim(), email: normalized };
      const salt = crypto.randomUUID();
      await repository.saveAccount({ user, salt, digest: await passwordDigest(password, salt) });
      return establish(user);
    },
    logout: () => repository.saveSession(null),
  };
}
