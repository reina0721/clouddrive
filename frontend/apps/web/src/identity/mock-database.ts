import { z } from 'zod';
import {
  createPersistStore,
  createLocalStorage,
  createHydrationLifecycle,
} from '@clouddrive/state-foundation';
import {
  userSchema,
  roleSchema,
  auditRecordSchema,
  productNotificationSchema,
  registrationSettingsSchema,
  registrationRestrictedPermissions,
  type DirectoryUser,
  type DirectoryRole,
  IdentityError,
  permissionCodes,
} from '@clouddrive/surface/identity';
import { AuthError, readSession, type AuthSession, type AuthUser } from '../auth/contract';
import type { MockAccount } from '../auth/mock-adapter';

export const MOCK_DATABASE_KEY = 'clouddrive.auth-mock';
const seedDate = '2026-10-01T00:00:00.000Z';
const defaultRegistrationSettings = {
  enabled: true,
  defaultRoleId: 'viewer',
  version: 1,
  updatedAt: seedDate,
};
export const mockRoles: readonly DirectoryRole[] = [
  {
    id: 'administrator',
    name: 'Administrator',
    permissions: [...permissionCodes],
    protected: true,
    version: 1,
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: 'operator',
    name: 'Operator',
    permissions: ['users.read', 'users.create', 'users.update', 'account.update'],
    protected: true,
    version: 1,
    createdAt: seedDate,
    updatedAt: seedDate,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    permissions: ['account.update'],
    protected: true,
    version: 1,
    createdAt: seedDate,
    updatedAt: seedDate,
  },
];
export function initialMockUsers(): DirectoryUser[] {
  const identity = (id: string, name: string, email: string, roleId: string): DirectoryUser => ({
    id,
    name,
    email,
    roleIds: [roleId],
    status: 'active',
    version: 1,
    createdAt: seedDate,
    updatedAt: seedDate,
  });
  return [
    identity('mock-demo', 'Rin', 'demo@community.test', 'administrator'),
    identity('mock-operator', 'Alex Chen', 'operator@community.test', 'operator'),
    identity('mock-viewer', 'Morgan Lee', 'viewer@community.test', 'viewer'),
    ...Array.from({ length: 21 }, (_, index) => ({
      ...identity(
        `member-${String(index + 1).padStart(3, '0')}`,
        `Member ${String(index + 1).padStart(2, '0')}`,
        `member${index + 1}@community.test`,
        index % 2 ? 'operator' : 'viewer',
      ),
      status: index % 5 === 4 ? ('disabled' as const) : ('active' as const),
    })),
  ];
}
const authUserSchema = z
  .object({ id: z.string().min(1), name: z.string().min(1), email: z.string().min(1) })
  .strict();
const accountSchema = z
  .object({
    user: authUserSchema,
    salt: z.string().min(1),
    digest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
const sessionSchema = z
  .object({
    user: authUserSchema,
    expiresAt: z.number().finite(),
    sessionId: z.string().min(1).optional(),
  })
  .strict()
  .nullable();
const legacySchema = z
  .object({ accounts: z.array(accountSchema), session: sessionSchema })
  .strict();
const storedSecuritySessionSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    device: z.string().min(1),
    createdAt: z.string().datetime(),
    lastActiveAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();
function legacySessions(session: z.infer<typeof sessionSchema>) {
  return session
    ? [
        {
          id: session.sessionId ?? `legacy-${session.user.id}`,
          userId: session.user.id,
          device: 'Browser',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          expiresAt: new Date(session.expiresAt).toISOString(),
        },
      ]
    : [];
}
const databaseSchema = z
  .object({
    accounts: z.array(accountSchema),
    session: sessionSchema,
    users: z.array(userSchema),
    sequence: z.number().int().nonnegative(),
    roles: z.array(roleSchema),
    auditRecords: z.array(auditRecordSchema),
    notifications: z.array(productNotificationSchema),
    registrationSettings: registrationSettingsSchema,
    securitySessions: z.array(storedSecuritySessionSchema),
  })
  .strict();
export type MockDatabase = z.infer<typeof databaseSchema>;
function fromIdentity(user: AuthUser): DirectoryUser {
  return {
    ...user,
    status: 'active',
    roleIds: [user.id === 'mock-demo' ? 'administrator' : 'viewer'],
    version: 1,
    createdAt: seedDate,
    updatedAt: seedDate,
  };
}
function parseDatabase(value: unknown): MockDatabase {
  const parsed = databaseSchema.safeParse(value);
  if (!parsed.success) throw new AuthError('protocol');
  const { users, accounts, roles, securitySessions } = parsed.data;
  if (
    new Set(securitySessions.map((item) => item.id)).size !== securitySessions.length ||
    securitySessions.some((item) => !users.some((user) => user.id === item.userId)) ||
    new Set(roles.map((role) => role.id)).size !== roles.length ||
    new Set(users.map((user) => user.id)).size !== users.length ||
    new Set(users.map((user) => user.email)).size !== users.length ||
    new Set(accounts.map((account) => account.user.email)).size !== accounts.length ||
    users.some((user) => user.roleIds.some((id) => !roles.some((role) => role.id === id))) ||
    !roles.some((role) => role.id === parsed.data.registrationSettings.defaultRoleId)
  )
    throw new AuthError('protocol');
  return parsed.data;
}
function migrateLegacy(value: unknown, version: number): MockDatabase {
  if (version === 4) {
    const prior = databaseSchema.omit({ securitySessions: true }).safeParse(value);
    if (!prior.success) throw new AuthError('protocol');
    return parseDatabase({ ...prior.data, securitySessions: legacySessions(prior.data.session) });
  }
  if (version === 3) {
    const prior = databaseSchema
      .omit({ registrationSettings: true, securitySessions: true })
      .safeParse(value);
    if (!prior.success) throw new AuthError('protocol');
    return parseDatabase({
      ...prior.data,
      securitySessions: legacySessions(prior.data.session),
      registrationSettings: defaultRegistrationSettings,
      roles: prior.data.roles.map((role) =>
        role.id === 'administrator' && role.protected
          ? {
              ...role,
              permissions: [...new Set([...role.permissions, 'settings.read', 'settings.update'])],
            }
          : role,
      ),
    });
  }
  if (version === 2) {
    const prior = z
      .object({
        accounts: z.array(accountSchema),
        session: sessionSchema,
        users: z.array(userSchema),
        sequence: z.number().int().nonnegative(),
      })
      .strict()
      .safeParse(value);
    if (!prior.success) throw new AuthError('protocol');
    return parseDatabase({
      ...prior.data,
      securitySessions: legacySessions(prior.data.session),
      roles: [...mockRoles],
      auditRecords: [],
      notifications: [],
      registrationSettings: defaultRegistrationSettings,
    });
  }
  if (version !== 1) throw new AuthError('protocol');
  const legacy = legacySchema.safeParse(value);
  if (!legacy.success) throw new AuthError('protocol');
  const identities = [
    ...legacy.data.accounts.map((account) => account.user),
    ...(legacy.data.session ? [legacy.data.session.user] : []),
  ];
  let users = initialMockUsers();
  for (const identity of identities) {
    if (users.some((user) => user.id === identity.id))
      users = users.map((user) => (user.id === identity.id ? { ...user, ...identity } : user));
    else users.push(fromIdentity(identity));
  }
  return parseDatabase({
    ...legacy.data,
    securitySessions: legacySessions(legacy.data.session),
    users,
    sequence: 0,
    roles: [...mockRoles],
    auditRecords: [],
    notifications: [],
    registrationSettings: defaultRegistrationSettings,
  });
}
async function ready() {
  let failure: unknown;
  const records = createPersistStore<MockDatabase, MockDatabase>(
    () => ({
      accounts: [],
      session: null,
      users: initialMockUsers(),
      sequence: 0,
      roles: [...mockRoles],
      auditRecords: [],
      notifications: [],
      registrationSettings: defaultRegistrationSettings,
      securitySessions: [],
    }),
    {
      name: MOCK_DATABASE_KEY,
      version: 5,
      skipHydration: true,
      storage: createLocalStorage(),
      partialize: ({
        accounts,
        session,
        users,
        sequence,
        roles,
        auditRecords,
        notifications,
        registrationSettings,
        securitySessions,
      }) => ({
        registrationSettings,
        securitySessions,
        roles,
        auditRecords,
        notifications,
        accounts,
        session,
        users,
        sequence,
      }),
      migrate: migrateLegacy,
      merge: (value, current) => (value === undefined ? current : parseDatabase(value)),
      onRehydrateStorage: () => (_state, error) => {
        if (error) failure = error;
      },
    },
  );
  const hydrationError = () =>
    failure instanceof AuthError
      ? failure
      : new AuthError(failure instanceof SyntaxError ? 'protocol' : 'unavailable');
  const lifecycle = createHydrationLifecycle(records);
  lifecycle.trigger();
  if (lifecycle.status === 'hydrated') return records;
  if (lifecycle.status === 'error') throw hydrationError();
  await new Promise<void>((resolve, reject) => {
    const unsubscribe = lifecycle.subscribe((status) => {
      if (status === 'hydrated') {
        unsubscribe();
        resolve();
      }
      if (status === 'error') {
        unsubscribe();
        reject(hydrationError());
      }
    });
  });
  return records;
}
export async function readMockDatabase(): Promise<MockDatabase> {
  return parseDatabase((await ready()).getState());
}

// Serialize writes in this document as well as across documents when Web Locks are available.
let pendingMutation: Promise<void> = Promise.resolve();

/** One durable write for user/profile/credential changes; no partial success on persistence failure. */
export async function mutateMockDatabase<T>(
  mutation: (database: MockDatabase) => Readonly<{ database: MockDatabase; result: T }>,
): Promise<T> {
  const perform = async () => {
    const records = await ready();
    const next = mutation(parseDatabase(records.getState()));
    const database = parseDatabase(next.database);
    try {
      records.setState(database, true);
    } catch {
      throw new IdentityError('persistence');
    }
    return next.result;
  };
  const operation = pendingMutation.then(async () => {
    if (typeof navigator !== 'undefined' && navigator.locks)
      return await navigator.locks.request(MOCK_DATABASE_KEY, perform);
    return await perform();
  });
  pendingMutation = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
}
export function createDatabaseAuthRepository() {
  return {
    readAccounts: async (): Promise<readonly MockAccount[]> => (await readMockDatabase()).accounts,
    saveAccount: async (account: MockAccount) => {
      await mutateMockDatabase((database) => {
        if (!database.registrationSettings.enabled) throw new AuthError('forbidden');
        const defaultRole = database.roles.find(
          (role) => role.id === database.registrationSettings.defaultRoleId,
        );
        if (
          !defaultRole ||
          defaultRole.permissions.some((permission) =>
            registrationRestrictedPermissions.some((restricted) => restricted === permission),
          )
        )
          throw new AuthError('forbidden');
        if (database.users.some((user) => user.email === account.user.email))
          throw new AuthError('account-exists');
        return {
          database: {
            ...database,
            accounts: [...database.accounts, account],
            users: [
              ...database.users,
              { ...fromIdentity(account.user), roleIds: [defaultRole.id] },
            ],
          },
          result: undefined,
        };
      });
    },
    readSession: async (): Promise<AuthSession | null> => {
      const database = await readMockDatabase();
      const session = database.session;
      if (!session) return null;
      const id = session.sessionId ?? `legacy-${session.user.id}`;
      const active = database.securitySessions.find(
        (item) =>
          item.id === id &&
          item.userId === session.user.id &&
          new Date(item.expiresAt).getTime() > Date.now(),
      );
      if (!active) return null;
      if (Date.now() - new Date(active.lastActiveAt).getTime() > 60000)
        await mutateMockDatabase((latest) => ({
          database: {
            ...latest,
            securitySessions: latest.securitySessions.map((item) =>
              item.id === id ? { ...item, lastActiveAt: new Date().toISOString() } : item,
            ),
          },
          result: undefined,
        }));
      return readSession(session);
    },
    saveSession: async (session: AuthSession | null) => {
      await mutateMockDatabase((database) => ({
        database: {
          ...database,
          session,
          securitySessions: session
            ? [
                ...database.securitySessions.filter(
                  (item) => item.id !== (session.sessionId ?? `legacy-${session.user.id}`),
                ),
                ...legacySessions(session),
              ]
            : database.securitySessions.filter(
                (item) =>
                  item.id !==
                  (database.session?.sessionId ?? `legacy-${database.session?.user.id}`),
              ),
          users:
            session && !database.users.some((user) => user.id === session.user.id)
              ? [...database.users, fromIdentity(session.user)]
              : database.users,
        },
        result: undefined,
      }));
    },
  };
}
