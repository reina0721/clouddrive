import {
  errorEnvelopeSchema,
  accountSessionsSchema,
  changePasswordSchema,
  identifierSchema,
  IdentityError,
  parseIdentity,
} from '@clouddrive/surface/identity';
import type { AccountSecurityPort } from '@clouddrive/surface/identity/runtime';
import { createJsonClient, ApiError } from '../api/json-client';
import { readMockDatabase, mutateMockDatabase } from '../identity/mock-database';
import { passwordDigest, MOCK_DEMO_PASSWORD } from './mock-adapter';

export function createBackendAccountSecurity(
  apiBaseUrl: string,
  request: typeof fetch = fetch,
): AccountSecurityPort {
  const json = createJsonClient(apiBaseUrl, request);
  async function call(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown) {
    try {
      return await json(path, { method, ...(body === undefined ? {} : { body }) });
    } catch (error) {
      if (!(error instanceof ApiError)) throw new IdentityError('unavailable');
      if (error.code === 'limit') throw error;
      if (error.code !== 'http') throw new IdentityError(error.code);
      const expected =
        error.status === 401
          ? 'unauthenticated'
          : error.status === 403
            ? 'forbidden'
            : error.status === 404
              ? 'not-found'
              : error.status === 409
                ? 'conflict'
                : error.status === 422
                  ? 'validation'
                  : 'unavailable';
      const parsed = errorEnvelopeSchema.safeParse(error.payload);
      if (parsed.success) {
        if (parsed.data.error.code !== expected) throw new IdentityError('protocol');
        throw new IdentityError(
          expected,
          parsed.data.error.reason,
          parsed.data.error.fields,
          parsed.data.error.requestId,
        );
      }
      throw new IdentityError(expected);
    }
  }
  async function write(path: string, method: 'POST' | 'DELETE', body: unknown) {
    if ((await call(path, method, body)) !== null) throw new IdentityError('protocol');
  }
  return {
    sessions: async () => parseIdentity(accountSessionsSchema, await call('/auth/sessions')).items,
    changePassword: async (currentPassword, newPassword) => {
      const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
      if (!parsed.success) throw new IdentityError('validation');
      await write('/auth/password', 'POST', parsed.data);
    },
    revokeSession: async (id) => {
      if (!identifierSchema.safeParse(id).success) throw new IdentityError('validation');
      await write(`/auth/sessions/${encodeURIComponent(id)}`, 'DELETE', {});
    },
    revokeOtherSessions: () => write('/auth/sessions/revoke-others', 'POST', {}),
  };
}

export function createMockAccountSecurity(currentUserId: () => string | null): AccountSecurityPort {
  function owner(database: Awaited<ReturnType<typeof readMockDatabase>>) {
    const id = currentUserId();
    const user = database.users.find((user) => user.id === id && user.status === 'active');
    const session = database.session;
    if (!user || !session || session.user.id !== id || session.expiresAt <= Date.now())
      throw new IdentityError('unauthenticated');
    const sessionId = session.sessionId ?? `legacy-${id}`;
    if (!database.securitySessions.some((item) => item.id === sessionId && item.userId === id))
      throw new IdentityError('unauthenticated');
    return { id: user.id, sessionId };
  }
  async function revoke(id: string | null) {
    if (id !== null && !identifierSchema.safeParse(id).success)
      throw new IdentityError('validation');
    await mutateMockDatabase((database) => {
      const access = owner(database);
      if (
        id !== null &&
        !database.securitySessions.some((item) => item.id === id && item.userId === access.id)
      )
        throw new IdentityError('not-found');
      return {
        database: {
          ...database,
          securitySessions: database.securitySessions.filter(
            (item) =>
              item.userId !== access.id ||
              (id === null ? item.id === access.sessionId : item.id !== id),
          ),
          session: id === access.sessionId ? null : database.session,
          auditRecords: [
            {
              id: `audit-${crypto.randomUUID()}`,
              actorId: access.id,
              actorName: database.session?.user.name ?? access.id,
              objectId: access.id,
              objectName: database.session?.user.name ?? access.id,
              operation: 'account.sessions',
              createdAt: new Date().toISOString(),
              result: 'success',
            },
            ...database.auditRecords,
          ],
        },
        result: undefined,
      };
    });
  }
  return {
    sessions: async () => {
      const database = await readMockDatabase();
      const access = owner(database);
      return database.securitySessions
        .filter(
          (item) => item.userId === access.id && new Date(item.expiresAt).getTime() > Date.now(),
        )
        .map((item) => ({
          id: item.id,
          device: item.device,
          createdAt: item.createdAt,
          lastActiveAt: item.lastActiveAt,
          expiresAt: item.expiresAt,
          current: item.id === access.sessionId,
        }));
    },
    changePassword: async (currentPassword, newPassword) => {
      if (!changePasswordSchema.safeParse({ currentPassword, newPassword }).success)
        throw new IdentityError('validation');
      const database = await readMockDatabase();
      const access = owner(database);
      const account = database.accounts.find((item) => item.user.id === access.id);
      const valid = account
        ? (await passwordDigest(currentPassword, account.salt)) === account.digest
        : ['mock-demo', 'mock-operator', 'mock-viewer'].includes(access.id) &&
          currentPassword === MOCK_DEMO_PASSWORD;
      if (!valid) {
        await mutateMockDatabase((latest) => {
          const current = owner(latest);
          const name = latest.session?.user.name ?? current.id;
          return {
            database: {
              ...latest,
              auditRecords: [
                {
                  id: `audit-${crypto.randomUUID()}`,
                  actorId: current.id,
                  actorName: name,
                  objectId: current.id,
                  objectName: name,
                  operation: 'account.password',
                  createdAt: new Date().toISOString(),
                  result: 'failure',
                  errorCode: 'validation',
                },
                ...latest.auditRecords,
              ],
            },
            result: undefined,
          };
        });
        throw new IdentityError('validation', undefined, [{ field: 'password', reason: 'format' }]);
      }
      const salt = crypto.randomUUID();
      const digest = await passwordDigest(newPassword, salt);
      await mutateMockDatabase((latest) => {
        const current = owner(latest);
        const currentAccount = latest.accounts.find((item) => item.user.id === access.id);
        if (
          current.id !== access.id ||
          current.sessionId !== access.sessionId ||
          currentAccount?.digest !== account?.digest
        )
          throw new IdentityError('conflict', 'stale-version');
        const user = latest.users.find((item) => item.id === access.id);
        if (!user) throw new IdentityError('unauthenticated');
        return {
          database: {
            ...latest,
            accounts: [
              ...latest.accounts.filter((item) => item.user.id !== access.id),
              { user: { id: user.id, name: user.name, email: user.email }, salt, digest },
            ],
            session: null,
            securitySessions: latest.securitySessions.filter((item) => item.userId !== access.id),
            auditRecords: [
              {
                id: `audit-${crypto.randomUUID()}`,
                actorId: user.id,
                actorName: user.name,
                objectId: user.id,
                objectName: user.name,
                operation: 'account.password',
                createdAt: new Date().toISOString(),
                result: 'success',
              },
              ...latest.auditRecords,
            ],
          },
          result: undefined,
        };
      });
    },
    revokeSession: revoke,
    revokeOtherSessions: () => revoke(null),
  };
}
