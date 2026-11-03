import { createDatabaseAuthRepository } from '../identity/mock-database';
import { AuthError } from './contract';
import type { MockAuthRepository } from './mock-adapter';

/** Existing v1 key migrates in place to the shared v2 demo identity database. */
export function createBrowserMockRepository(): MockAuthRepository {
  const database = createDatabaseAuthRepository();
  async function authOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('unavailable');
    }
  }
  return {
    readAccounts: () => authOperation(database.readAccounts),
    saveAccount: (account) => authOperation(() => database.saveAccount(account)),
    readSession: () => authOperation(database.readSession),
    saveSession: (session) => authOperation(() => database.saveSession(session)),
  };
}
