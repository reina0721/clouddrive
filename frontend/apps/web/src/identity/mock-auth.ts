import { AuthError, type AuthService, type AuthSession } from '../auth/contract';
import { MOCK_DEMO_PASSWORD, MOCK_SESSION_LIFETIME_MS } from '../auth/mock-adapter';
import { readMockDatabase, createDatabaseAuthRepository } from './mock-database';

/** Auth and directory share one identity: profile/status updates affect restore and the next login. */
export function withMockDirectory(base: AuthService): AuthService {
  const repository = createDatabaseAuthRepository();
  async function current(session: AuthSession): Promise<AuthSession | null> {
    const user = (await readMockDatabase()).users.find(
      (candidate) => candidate.id === session.user.id,
    );
    if (!user || user.status !== 'active') return null;
    return { ...session, user: { id: user.id, name: user.name, email: user.email } };
  }
  return {
    restore: async () => {
      const session = await base.restore();
      return session ? current(session) : null;
    },
    login: async (input) => {
      const database = await readMockDatabase();
      const user = database.users.find(
        (candidate) => candidate.email === input.email.trim().toLowerCase(),
      );
      if (!user || user.status !== 'active') throw new AuthError('credentials');
      const fixture = ['mock-demo', 'mock-operator', 'mock-viewer'].includes(user.id);
      if (fixture && !database.accounts.some((account) => account.user.id === user.id)) {
        if (input.password !== MOCK_DEMO_PASSWORD) throw new AuthError('credentials');
        const session = {
          user: { id: user.id, name: user.name, email: user.email },
          expiresAt: Date.now() + MOCK_SESSION_LIFETIME_MS,
          sessionId: `session-${crypto.randomUUID()}`,
        };
        await repository.saveSession(session);
        return session;
      }
      const resolved = await current(await base.login(input));
      if (!resolved) throw new AuthError('credentials');
      return resolved;
    },
    register: (input) => base.register(input),
    logout: () => base.logout(),
  };
}
