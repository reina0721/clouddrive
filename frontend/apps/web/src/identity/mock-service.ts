import {
  batchStatusInputSchema,
  productInboxQuerySchema,
  type BatchStatusResult,
  createUserSchema,
  registrationSettingsInputSchema,
  registrationRestrictedPermissions,
  roleInputSchema,
  updateRoleSchema,
  auditQuerySchema,
  readNotificationsSchema,
  type AuditRecord,
  type DirectoryRole,
  updateUserSchema,
  userQuerySchema,
  roleIdsSchema,
  identifierSchema,
  userStatusSchema,
  IdentityError,
  type IdentityPort,
  type DirectoryUser,
  type IdentityPermission,
} from '@clouddrive/surface/identity';
import { passwordDigest } from '../auth/mock-adapter';
import { readMockDatabase, mutateMockDatabase, type MockDatabase } from './mock-database';

export type IdentityOperations = Omit<
  IdentityPort,
  'mode' | 'currentUserId' | 'getRevision' | 'subscribe'
>;
function actor(database: MockDatabase, id: string | null, permission?: IdentityPermission) {
  const user = database.users.find((candidate) => candidate.id === id);
  if (
    !user ||
    user.status !== 'active' ||
    database.session?.user.id !== id ||
    database.session.expiresAt <= Date.now()
  )
    throw new IdentityError('unauthenticated');
  const permissions = [
    ...new Set(
      database.roles
        .filter((role) => user.roleIds.includes(role.id))
        .flatMap((role) => role.permissions),
    ),
  ];
  if (permission && !permissions.includes(permission)) throw new IdentityError('forbidden');
  return { user, permissions };
}
function findUser(database: MockDatabase, id: string) {
  const user = database.users.find((candidate) => candidate.id === id);
  if (!user) throw new IdentityError('not-found');
  return user;
}
function checkVersion(user: DirectoryUser | DirectoryRole, version: number) {
  if (!Number.isInteger(version) || version < 1) throw new IdentityError('validation');
  if (user.version !== version)
    throw new IdentityError('conflict', 'stale-version', [{ field: 'version', reason: 'stale' }]);
}
function checkRoles(database: MockDatabase, roleIds: readonly string[]) {
  if (
    !roleIdsSchema.safeParse(roleIds).success ||
    roleIds.some((id) => !database.roles.some((role) => role.id === id))
  )
    throw new IdentityError('validation', undefined, [{ field: 'roleIds', reason: 'unknown' }]);
}
function replaceUser(database: MockDatabase, user: DirectoryUser): MockDatabase {
  const identity = { id: user.id, name: user.name, email: user.email };
  return {
    ...database,
    users: database.users.map((prior) => (prior.id === user.id ? user : prior)),
    accounts: database.accounts.map((account) =>
      account.user.id === user.id ? { ...account, user: identity } : account,
    ),
    session:
      database.session?.user.id === user.id
        ? { ...database.session, user: identity }
        : database.session,
  };
}
function duplicateEmail(database: MockDatabase, email: string, id?: string) {
  if (database.users.some((user) => user.email === email && user.id !== id))
    throw new IdentityError('conflict', 'duplicate-email', [
      { field: 'email', reason: 'duplicate' },
    ]);
}
function protect(
  database: MockDatabase,
  prior: DirectoryUser,
  next: DirectoryUser,
  actorId: string,
) {
  if (
    prior.id === actorId &&
    (next.status !== 'active' ||
      JSON.stringify([...prior.roleIds].sort()) !== JSON.stringify([...next.roleIds].sort()))
  )
    throw new IdentityError('conflict', 'protected-user');
  if (
    prior.status === 'active' &&
    prior.roleIds.includes('administrator') &&
    (next.status !== 'active' || !next.roleIds.includes('administrator')) &&
    database.users.filter(
      (user) => user.status === 'active' && user.roleIds.includes('administrator'),
    ).length <= 1
  )
    throw new IdentityError('conflict', 'last-administrator');
}
function recordMutation(
  database: MockDatabase,
  user: DirectoryUser,
  operation: AuditRecord['operation'],
  objectId: string,
  objectName: string,
): MockDatabase {
  const record: AuditRecord = {
    id: `audit-${crypto.randomUUID()}`,
    actorId: user.id,
    actorName: user.name,
    objectId,
    objectName,
    operation,
    createdAt: new Date().toISOString(),
    result: 'success',
  };
  const recipients = new Set([
    user.id,
    ...(operation.startsWith('users.') || operation === 'account.update'
      ? [objectId]
      : database.users
          .filter((member) => member.roleIds.includes(objectId))
          .map((member) => member.id)),
  ]);
  return {
    ...database,
    auditRecords: [record, ...database.auditRecords],
    notifications: [
      ...[...recipients]
        .filter((id) => database.users.some((member) => member.id === id))
        .map((ownerId) => ({
          id: `inbox-${crypto.randomUUID()}`,
          ownerId,
          operation,
          objectId,
          objectName,
          category: 'success' as const,
          createdAt: record.createdAt,
          read: false,
        })),
      ...database.notifications,
    ],
  };
}
export function createMockIdentityService(currentUserId: () => string | null): IdentityOperations {
  async function revise(
    id: string,
    version: number,
    permission: Extract<AuditRecord['operation'], IdentityPermission>,
    patch: Partial<Pick<DirectoryUser, 'name' | 'email' | 'status' | 'roleIds'>>,
    own = false,
  ) {
    return mutateMockDatabase((database) => {
      const access = actor(database, currentUserId(), permission);
      if (own && access.user.id !== id) throw new IdentityError('forbidden');
      const prior = findUser(database, id);
      checkVersion(prior, version);
      const next = {
        ...prior,
        ...patch,
        version: prior.version + 1,
        updatedAt: new Date().toISOString(),
      };
      if (patch.email) duplicateEmail(database, patch.email, id);
      if (patch.roleIds) {
        checkRoles(database, patch.roleIds);
        if (
          database.roles
            .filter((role) => patch.roleIds?.includes(role.id))
            .some((role) =>
              role.permissions.some((permission) => !access.permissions.includes(permission)),
            )
        )
          throw new IdentityError('forbidden');
      }
      protect(database, prior, next, access.user.id);
      return {
        database: recordMutation(
          replaceUser(database, next),
          access.user,
          permission,
          next.id,
          next.name,
        ),
        result: next,
      };
    });
  }
  const operations: IdentityOperations = {
    batchStatus: async (input) => {
      const parsed = batchStatusInputSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      return mutateMockDatabase((database) => {
        const access = actor(database, currentUserId(), 'users.status');
        let nextDatabase = database;
        const items: BatchStatusResult['items'] = [];
        for (const item of parsed.data.items) {
          try {
            const prior = findUser(nextDatabase, item.id);
            checkVersion(prior, item.version);
            const user = {
              ...prior,
              status: parsed.data.status,
              version: prior.version + 1,
              updatedAt: new Date().toISOString(),
            };
            protect(nextDatabase, prior, user, access.user.id);
            nextDatabase = recordMutation(
              replaceUser(nextDatabase, user),
              access.user,
              'users.status',
              user.id,
              user.name,
            );
            items.push({ id: item.id, success: true, user });
          } catch (error) {
            if (!(error instanceof IdentityError)) throw error;
            nextDatabase = {
              ...nextDatabase,
              auditRecords: [
                {
                  id: `audit-${crypto.randomUUID()}`,
                  actorId: access.user.id,
                  actorName: access.user.name,
                  objectId: item.id,
                  objectName:
                    nextDatabase.users.find((user) => user.id === item.id)?.name ??
                    item.id.slice(0, 80),
                  operation: 'users.status',
                  createdAt: new Date().toISOString(),
                  result: 'failure',
                  errorCode: error.code,
                },
                ...nextDatabase.auditRecords,
              ],
            };
            items.push({
              id: item.id,
              success: false,
              code: error.code,
              ...(error.reason === 'stale-version' ||
              error.reason === 'protected-user' ||
              error.reason === 'last-administrator'
                ? { reason: error.reason }
                : {}),
            });
          }
        }
        return { database: nextDatabase, result: { items } };
      });
    },
    roleSummaries: async () => {
      const database = await readMockDatabase();
      actor(database, currentUserId(), 'roles.read');
      return database.roles.map((role) => ({
        ...role,
        memberCount: database.users.filter((user) => user.roleIds.includes(role.id)).length,
      }));
    },
    roleMembers: async (id, query) => {
      if (!identifierSchema.safeParse(id).success) throw new IdentityError('validation');
      await operations.readRole(id);
      return operations.list({ ...query, roleId: id });
    },
    changeRoleMember: async (roleId, userId, version, add) => {
      if (
        !identifierSchema.safeParse(roleId).success ||
        !identifierSchema.safeParse(userId).success
      )
        throw new IdentityError('validation');
      return mutateMockDatabase((database) => {
        const access = actor(database, currentUserId(), 'users.roles');
        const role = database.roles.find((item) => item.id === roleId);
        if (!role) throw new IdentityError('not-found');
        if (add && role.permissions.some((permission) => !access.permissions.includes(permission)))
          throw new IdentityError('forbidden');
        const prior = findUser(database, userId);
        checkVersion(prior, version);
        const roleIds = add
          ? [...new Set([...prior.roleIds, roleId])]
          : prior.roleIds.filter((id) => id !== roleId);
        checkRoles(database, roleIds);
        const user = {
          ...prior,
          roleIds,
          version: prior.version + 1,
          updatedAt: new Date().toISOString(),
        };
        protect(database, prior, user, access.user.id);
        return {
          database: recordMutation(
            replaceUser(database, user),
            access.user,
            'users.roles',
            user.id,
            user.name,
          ),
          result: user,
        };
      });
    },
    inboxPage: async (input) => {
      const parsed = productInboxQuerySchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      const query = parsed.data;
      const all = await operations.inbox();
      const q = query.q.toLowerCase();
      const items = all
        .filter(
          (item) =>
            (!q ||
              [item.objectName, item.objectId, item.operation].some((value) =>
                value.toLowerCase().includes(q),
              )) &&
            (query.category === 'all' || query.category === item.category) &&
            (query.read === 'all' || item.read === (query.read === 'read')),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
      return {
        items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: items.length,
        unread: all.filter((item) => !item.read).length,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    readNotification: async (id) => {
      if (!identifierSchema.safeParse(id).success) throw new IdentityError('validation');
      const item = (await operations.inbox()).find((item) => item.id === id);
      if (!item) throw new IdentityError('not-found');
      return item;
    },
    readAllNotifications: async () => {
      await mutateMockDatabase((database) => {
        const access = actor(database, currentUserId());
        return {
          database: {
            ...database,
            notifications: database.notifications.map((item) =>
              item.ownerId === access.user.id ? { ...item, read: true } : item,
            ),
          },
          result: undefined,
        };
      });
    },
    registrationSettings: async () => {
      const database = await readMockDatabase();
      actor(database, currentUserId(), 'settings.read');
      return database.registrationSettings;
    },
    updateRegistrationSettings: async (input) => {
      const parsed = registrationSettingsInputSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      return mutateMockDatabase((database) => {
        const access = actor(database, currentUserId(), 'settings.update');
        if (database.registrationSettings.version !== parsed.data.version)
          throw new IdentityError('conflict', 'stale-version');
        const role = database.roles.find((candidate) => candidate.id === parsed.data.defaultRoleId);
        if (
          !role ||
          role.permissions.some(
            (permission) =>
              !access.permissions.includes(permission) ||
              registrationRestrictedPermissions.some((restricted) => restricted === permission),
          )
        )
          throw new IdentityError('validation');
        const settings = {
          ...parsed.data,
          version: parsed.data.version + 1,
          updatedAt: new Date().toISOString(),
        };
        return {
          database: recordMutation(
            { ...database, registrationSettings: settings },
            access.user,
            'settings.update',
            'registration-policy',
            'Registration policy',
          ),
          result: settings,
        };
      });
    },
    readRole: async (id) => {
      const database = await readMockDatabase();
      actor(database, currentUserId(), 'roles.read');
      const role = database.roles.find((item) => item.id === id);
      if (!role) throw new IdentityError('not-found');
      return role;
    },
    createRole: async (input) => {
      const parsed = roleInputSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      return mutateMockDatabase((database) => {
        const access = actor(database, currentUserId(), 'roles.create');
        if (parsed.data.permissions.some((permission) => !access.permissions.includes(permission)))
          throw new IdentityError('forbidden');
        if (
          database.roles.some((role) => role.name.toLowerCase() === parsed.data.name.toLowerCase())
        )
          throw new IdentityError('conflict', 'duplicate-role');
        const now = new Date().toISOString();
        const role: DirectoryRole = {
          ...parsed.data,
          id: `role-${crypto.randomUUID()}`,
          protected: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        return {
          database: recordMutation(
            { ...database, roles: [...database.roles, role] },
            access.user,
            'roles.create',
            role.id,
            role.name,
          ),
          result: role,
        };
      });
    },
    updateRole: async (id, input) => {
      const parsed = updateRoleSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      return mutateMockDatabase((database) => {
        const access = actor(database, currentUserId(), 'roles.update');
        const prior = database.roles.find((role) => role.id === id);
        if (!prior) throw new IdentityError('not-found');
        checkVersion(prior, parsed.data.version);
        if (prior.protected) throw new IdentityError('conflict', 'protected-role');
        if (
          database.registrationSettings.defaultRoleId === id &&
          parsed.data.permissions.some((permission) =>
            registrationRestrictedPermissions.some((restricted) => restricted === permission),
          )
        )
          throw new IdentityError('conflict', 'protected-role');
        if (access.user.roleIds.includes(id)) throw new IdentityError('conflict', 'protected-user');
        if (parsed.data.permissions.some((permission) => !access.permissions.includes(permission)))
          throw new IdentityError('forbidden');
        if (
          database.roles.some(
            (role) => role.id !== id && role.name.toLowerCase() === parsed.data.name.toLowerCase(),
          )
        )
          throw new IdentityError('conflict', 'duplicate-role');
        const role = {
          ...prior,
          ...parsed.data,
          version: prior.version + 1,
          updatedAt: new Date().toISOString(),
        };
        return {
          database: recordMutation(
            { ...database, roles: database.roles.map((item) => (item.id === id ? role : item)) },
            access.user,
            'roles.update',
            id,
            role.name,
          ),
          result: role,
        };
      });
    },
    inbox: async () => {
      const database = await readMockDatabase();
      const access = actor(database, currentUserId());
      return database.notifications.filter((item) => item.ownerId === access.user.id);
    },
    readNotifications: async (ids) => {
      if (!readNotificationsSchema.safeParse({ ids }).success)
        throw new IdentityError('validation');
      await mutateMockDatabase((database) => {
        const access = actor(database, currentUserId());
        if (
          ids.some(
            (id) =>
              !database.notifications.some(
                (item) => item.id === id && item.ownerId === access.user.id,
              ),
          )
        )
          throw new IdentityError('not-found');
        return {
          database: {
            ...database,
            notifications: database.notifications.map((item) =>
              item.ownerId === access.user.id && ids.includes(item.id)
                ? { ...item, read: true }
                : item,
            ),
          },
          result: undefined,
        };
      });
    },
    audit: async (input) => {
      const parsed = auditQuerySchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      const database = await readMockDatabase();
      actor(database, currentUserId(), 'audit.read');
      const query = parsed.data;
      const q = query.q.toLowerCase();
      const items = database.auditRecords.filter(
        (item) =>
          (!q ||
            [item.actorId, item.actorName, item.objectId, item.objectName].some((value) =>
              value.toLowerCase().includes(q),
            )) &&
          (query.operation === 'all' || item.operation === query.operation) &&
          (query.result === 'all' || item.result === query.result) &&
          (!query.actor ||
            [item.actorId, item.actorName].some((value) =>
              value.toLowerCase().includes(query.actor?.toLowerCase() ?? ''),
            )) &&
          (!query.object ||
            [item.objectId, item.objectName].some((value) =>
              value.toLowerCase().includes(query.object?.toLowerCase() ?? ''),
            )) &&
          (!query.from || Date.parse(item.createdAt) >= Date.parse(query.from)) &&
          (!query.to || Date.parse(item.createdAt) <= Date.parse(query.to)),
      );
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
      const start = (query.page - 1) * query.pageSize;
      return {
        items: items.slice(start, start + query.pageSize),
        total: items.length,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    readAudit: async (id) => {
      const database = await readMockDatabase();
      actor(database, currentUserId(), 'audit.read');
      const record = database.auditRecords.find((item) => item.id === id);
      if (!record) throw new IdentityError('not-found');
      return record;
    },
    access: async () => actor(await readMockDatabase(), currentUserId()),
    roles: async () => {
      const database = await readMockDatabase();
      actor(database, currentUserId());
      const access = actor(database, currentUserId());
      return access.permissions.includes('roles.read') ||
        access.permissions.includes('users.read') ||
        access.permissions.includes('settings.read')
        ? database.roles
        : database.roles.filter((role) => access.user.roleIds.includes(role.id));
    },
    me: async () => actor(await readMockDatabase(), currentUserId()).user,
    read: async (id) => {
      const database = await readMockDatabase();
      actor(database, currentUserId(), 'users.read');
      return findUser(database, id);
    },
    list: async (input) => {
      const parsed = userQuerySchema.safeParse(input);
      if (!parsed.success)
        throw new IdentityError('validation', undefined, [{ field: 'query', reason: 'format' }]);
      const query = parsed.data;
      const database = await readMockDatabase();
      actor(database, currentUserId(), 'users.read');
      const q = query.q.toLowerCase();
      const users = database.users
        .filter(
          (user) =>
            (!q || user.name.toLowerCase().includes(q) || user.email.includes(q)) &&
            (query.status === 'all' || user.status === query.status) &&
            (query.roleId === 'all' || user.roleIds.includes(query.roleId)),
        )
        .sort((a, b) => {
          const av = a[query.sort].toLowerCase(),
            bv = b[query.sort].toLowerCase();
          const comparison =
            av === bv ? (a.id < b.id ? -1 : a.id === b.id ? 0 : 1) : av < bv ? -1 : 1;
          return query.direction === 'asc' ? comparison : -comparison;
        });
      const start = (query.page - 1) * query.pageSize;
      return {
        items: users.slice(start, start + query.pageSize),
        total: users.length,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
    create: async (input) => {
      const parsed = createUserSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      const values = parsed.data;
      actor(await readMockDatabase(), currentUserId(), 'users.create');
      const salt = crypto.randomUUID();
      const digest = await passwordDigest(values.password, salt);
      return mutateMockDatabase((database) => {
        const access = actor(database, currentUserId(), 'users.create');
        if (
          values.roleIds.some((id) => id !== 'viewer') &&
          !access.permissions.includes('users.roles')
        )
          throw new IdentityError('forbidden');
        if (values.status !== 'active' && !access.permissions.includes('users.status'))
          throw new IdentityError('forbidden');
        checkRoles(database, values.roleIds);
        if (
          access.permissions.includes('users.roles') &&
          database.roles
            .filter((role) => values.roleIds.includes(role.id))
            .some((role) =>
              role.permissions.some((permission) => !access.permissions.includes(permission)),
            )
        )
          throw new IdentityError('forbidden');
        duplicateEmail(database, values.email);
        let sequence = database.sequence + 1;
        while (database.users.some((user) => user.id === `managed-${sequence}`)) sequence += 1;
        const now = new Date().toISOString();
        const user: DirectoryUser = {
          id: `managed-${sequence}`,
          name: values.name,
          email: values.email,
          roleIds: values.roleIds,
          status: values.status,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        return {
          database: recordMutation(
            {
              ...database,
              sequence,
              users: [...database.users, user],
              accounts: [
                ...database.accounts,
                { user: { id: user.id, name: user.name, email: user.email }, salt, digest },
              ],
            },
            access.user,
            'users.create',
            user.id,
            user.name,
          ),
          result: user,
        };
      });
    },
    update: async (id, input) => {
      const parsed = updateUserSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      return revise(id, parsed.data.version, 'users.update', {
        name: parsed.data.name,
        email: parsed.data.email,
      });
    },
    updateMe: async (input) => {
      const id = currentUserId();
      if (!id) throw new IdentityError('unauthenticated');
      const parsed = updateUserSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      return revise(
        id,
        parsed.data.version,
        'account.update',
        { name: parsed.data.name, email: parsed.data.email },
        true,
      );
    },
    setStatus: (id, version, status) => {
      if (!userStatusSchema.safeParse(status).success || !Number.isInteger(version) || version < 1)
        throw new IdentityError('validation');
      return revise(id, version, 'users.status', { status });
    },
    setRoles: (id, version, roleIds) =>
      revise(id, version, 'users.roles', { roleIds: [...roleIds] }),
  };
  async function audited<T>(
    operation: AuditRecord['operation'],
    objectId: string,
    perform: () => Promise<T>,
  ): Promise<T> {
    try {
      return await perform();
    } catch (error) {
      if (
        error instanceof IdentityError &&
        ['forbidden', 'conflict', 'validation', 'not-found'].includes(error.code)
      ) {
        try {
          await mutateMockDatabase((database) => {
            const access = actor(database, currentUserId());
            const safeId = identifierSchema.safeParse(objectId).success
              ? objectId
              : 'invalid-target';
            const objectName =
              database.users.find((item) => item.id === safeId)?.name ??
              database.roles.find((item) => item.id === safeId)?.name ??
              safeId.slice(0, 80);
            const record: AuditRecord = {
              id: `audit-${crypto.randomUUID()}`,
              actorId: access.user.id,
              actorName: access.user.name,
              objectId: safeId,
              objectName,
              operation,
              createdAt: new Date().toISOString(),
              result: 'failure',
              errorCode: error.code,
            };
            return {
              database: { ...database, auditRecords: [record, ...database.auditRecords] },
              result: undefined,
            };
          });
        } catch {
          /* A failed audit write never turns a denied operation into a success. */
        }
      }
      throw error;
    }
  }
  return {
    ...operations,
    changeRoleMember: (roleId, userId, version, add) =>
      audited('users.roles', userId, () =>
        operations.changeRoleMember(roleId, userId, version, add),
      ),
    updateRegistrationSettings: (input) =>
      audited('settings.update', 'registration-policy', () =>
        operations.updateRegistrationSettings(input),
      ),
    create: (input) => audited('users.create', 'new-user', () => operations.create(input)),
    update: (id, input) => audited('users.update', id, () => operations.update(id, input)),
    updateMe: (input) =>
      audited('account.update', currentUserId() ?? 'unknown-user', () =>
        operations.updateMe(input),
      ),
    setStatus: (id, version, status) =>
      audited('users.status', id, () => operations.setStatus(id, version, status)),
    setRoles: (id, version, roleIds) =>
      audited('users.roles', id, () => operations.setRoles(id, version, roleIds)),
    createRole: (input) => audited('roles.create', 'new-role', () => operations.createRole(input)),
    updateRole: (id, input) => audited('roles.update', id, () => operations.updateRole(id, input)),
  };
}
