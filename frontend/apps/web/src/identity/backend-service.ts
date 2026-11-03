import {
  batchStatusInputSchema,
  batchStatusResultSchema,
  productInboxQuerySchema,
  productInboxPageSchema,
  notificationResponseSchema,
  roleSummariesSchema,
  accessSchema,
  registrationSettingsInputSchema,
  registrationSettingsResponseSchema,
  roleInputSchema,
  updateRoleSchema,
  roleResponseSchema,
  inboxSchema,
  readNotificationsSchema,
  auditQuerySchema,
  auditPageSchema,
  auditResponseSchema,
  rolePageSchema,
  userPageSchema,
  userResponseSchema,
  userQuerySchema,
  createUserSchema,
  updateUserSchema,
  errorEnvelopeSchema,
  identifierSchema,
  roleIdsSchema,
  userStatusSchema,
  IdentityError,
  parseIdentity,
  type IdentityErrorCode,
} from '@clouddrive/surface/identity';
import { createJsonClient, ApiError } from '../api/json-client';
import type { IdentityOperations } from './mock-service';

const statusCodes: Readonly<Partial<Record<number, IdentityErrorCode>>> = {
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  422: 'validation',
};
export function createBackendIdentityService(
  apiBaseUrl: string,
  request: typeof fetch = fetch,
): IdentityOperations {
  const json = createJsonClient(apiBaseUrl, request);
  async function call(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
  ) {
    try {
      return await json(path, { method, ...(body === undefined ? {} : { body }) });
    } catch (error) {
      if (!(error instanceof ApiError)) throw new IdentityError('unavailable');
      if (error.code !== 'http') throw new IdentityError(error.code);
      const expected = statusCodes[error.status] ?? 'unavailable';
      if (expected === 'unauthenticated') throw new IdentityError('unauthenticated');
      const parsed = errorEnvelopeSchema.safeParse(error.payload);
      if (parsed.success) {
        const failure = parsed.data.error;
        if (failure.code !== expected) throw new IdentityError('protocol');
        throw new IdentityError(failure.code, failure.reason, failure.fields, failure.requestId);
      }
      throw new IdentityError(expected);
    }
  }
  function idPath(id: string) {
    if (!identifierSchema.safeParse(id).success) throw new IdentityError('validation');
    return `/users/${encodeURIComponent(id)}`;
  }
  async function userCall(
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    body?: unknown,
  ) {
    return parseIdentity(userResponseSchema, await call(path, method, body)).user;
  }
  return {
    batchStatus: async (input) => {
      const parsed = batchStatusInputSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      const result = parseIdentity(
        batchStatusResultSchema,
        await call('/users/batch-status', 'POST', parsed.data),
      );
      if (
        result.items.length !== input.items.length ||
        new Set(result.items.map((item) => item.id)).size !== result.items.length ||
        result.items.some((item) => {
          const prior = input.items.find((entry) => entry.id === item.id);
          return (
            !prior ||
            (item.success &&
              (item.user.id !== item.id ||
                item.user.version < prior.version ||
                item.user.status !== input.status))
          );
        })
      )
        throw new IdentityError('protocol');
      return result;
    },
    roleSummaries: async () => {
      const result = parseIdentity(roleSummariesSchema, await call('/roles?include=memberCount'));
      if (new Set(result.items.map((item) => item.id)).size !== result.items.length)
        throw new IdentityError('protocol');
      return result.items;
    },
    roleMembers: async (id, query) => {
      if (!identifierSchema.safeParse(id).success || !userQuerySchema.safeParse(query).success)
        throw new IdentityError('validation');
      const params = new URLSearchParams({
        q: query.q,
        status: query.status,
        sort: query.sort,
        direction: query.direction,
        page: String(query.page),
        pageSize: String(query.pageSize),
      });
      const result = parseIdentity(
        userPageSchema,
        await call(`/roles/${encodeURIComponent(id)}/members?${params}`),
      );
      if (
        result.page !== query.page ||
        result.pageSize !== query.pageSize ||
        result.items.length > query.pageSize ||
        result.total < result.items.length ||
        new Set(result.items.map((item) => item.id)).size !== result.items.length ||
        result.items.some((user) => !user.roleIds.includes(id))
      )
        throw new IdentityError('protocol');
      return result;
    },
    changeRoleMember: async (roleId, userId, version, add) => {
      if (
        !identifierSchema.safeParse(roleId).success ||
        !identifierSchema.safeParse(userId).success ||
        !Number.isInteger(version) ||
        version < 1
      )
        throw new IdentityError('validation');
      const path = `/roles/${encodeURIComponent(roleId)}/members`;
      const user = await userCall(
        add ? path : `${path}/${encodeURIComponent(userId)}`,
        add ? 'POST' : 'DELETE',
        add ? { userId, version } : { version },
      );
      if (user.id !== userId || user.version < version || user.roleIds.includes(roleId) !== add)
        throw new IdentityError('protocol');
      return user;
    },
    inboxPage: async (query) => {
      if (!productInboxQuerySchema.safeParse(query).success) throw new IdentityError('validation');
      const params = new URLSearchParams({
        q: query.q,
        category: query.category,
        read: query.read,
        page: String(query.page),
        pageSize: String(query.pageSize),
      });
      const result = parseIdentity(productInboxPageSchema, await call(`/notifications?${params}`));
      if (
        result.page !== query.page ||
        result.pageSize !== query.pageSize ||
        result.items.length > query.pageSize ||
        result.total < result.items.length ||
        new Set(result.items.map((item) => item.id)).size !== result.items.length
      )
        throw new IdentityError('protocol');
      return result;
    },
    readNotification: async (id) => {
      if (!identifierSchema.safeParse(id).success) throw new IdentityError('validation');
      const result = parseIdentity(
        notificationResponseSchema,
        await call(`/notifications/${encodeURIComponent(id)}`),
      ).item;
      if (result.id !== id) throw new IdentityError('protocol');
      return result;
    },
    readAllNotifications: async () => {
      if ((await call('/notifications/read-all', 'PATCH', {})) !== null)
        throw new IdentityError('protocol');
    },
    access: async () => parseIdentity(accessSchema, await call('/auth/access')),
    registrationSettings: async () =>
      parseIdentity(registrationSettingsResponseSchema, await call('/system/registration'))
        .settings,
    updateRegistrationSettings: async (input) => {
      const parsed = registrationSettingsInputSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      const settings = parseIdentity(
        registrationSettingsResponseSchema,
        await call('/system/registration', 'PATCH', parsed.data),
      ).settings;
      if (settings.version <= input.version) throw new IdentityError('protocol');
      return settings;
    },
    roles: async (selfOnly = false) =>
      parseIdentity(rolePageSchema, await call(selfOnly ? '/roles?scope=self' : '/roles')).items,
    readRole: async (id) => {
      if (!identifierSchema.safeParse(id).success) throw new IdentityError('validation');
      const role = parseIdentity(
        roleResponseSchema,
        await call(`/roles/${encodeURIComponent(id)}`),
      ).role;
      if (role.id !== id) throw new IdentityError('protocol');
      return role;
    },
    createRole: async (input) => {
      const parsed = roleInputSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      return parseIdentity(roleResponseSchema, await call('/roles', 'POST', parsed.data)).role;
    },
    updateRole: async (id, input) => {
      const parsed = updateRoleSchema.safeParse(input);
      if (!parsed.success || !identifierSchema.safeParse(id).success)
        throw new IdentityError('validation');
      const role = parseIdentity(
        roleResponseSchema,
        await call(`/roles/${encodeURIComponent(id)}`, 'PATCH', parsed.data),
      ).role;
      if (role.id !== id || role.version <= input.version) throw new IdentityError('protocol');
      return role;
    },
    inbox: async () => parseIdentity(inboxSchema, await call('/notifications')).items,
    readNotifications: async (ids) => {
      const parsed = readNotificationsSchema.safeParse({ ids });
      if (!parsed.success) throw new IdentityError('validation');
      const result = await call('/notifications/read', 'PATCH', parsed.data);
      if (result !== null) throw new IdentityError('protocol');
    },
    audit: async (query) => {
      if (!auditQuerySchema.safeParse(query).success) throw new IdentityError('validation');
      const params = new URLSearchParams({
        q: query.q,
        operation: query.operation,
        result: query.result,
        page: String(query.page),
        pageSize: String(query.pageSize),
      });
      for (const key of ['actor', 'object', 'from', 'to'] as const)
        if (query[key]) params.set(key, query[key]);
      const page = parseIdentity(auditPageSchema, await call(`/audit-logs?${params}`));
      if (
        page.page !== query.page ||
        page.pageSize !== query.pageSize ||
        page.items.length > query.pageSize ||
        page.total < page.items.length ||
        new Set(page.items.map((item) => item.id)).size !== page.items.length
      )
        throw new IdentityError('protocol');
      return page;
    },
    readAudit: async (id) => {
      if (!identifierSchema.safeParse(id).success) throw new IdentityError('validation');
      const record = parseIdentity(
        auditResponseSchema,
        await call(`/audit-logs/${encodeURIComponent(id)}`),
      ).record;
      if (record.id !== id) throw new IdentityError('protocol');
      return record;
    },
    me: () => userCall('/me'),
    read: async (id) => {
      const user = await userCall(idPath(id));
      if (user.id !== id) throw new IdentityError('protocol');
      return user;
    },
    list: async (query) => {
      if (!userQuerySchema.safeParse(query).success) throw new IdentityError('validation');
      const params = new URLSearchParams({
        q: query.q,
        status: query.status,
        roleId: query.roleId,
        sort: query.sort,
        direction: query.direction,
        page: String(query.page),
        pageSize: String(query.pageSize),
      });
      const page = parseIdentity(userPageSchema, await call(`/users?${params}`));
      if (
        page.page !== query.page ||
        page.pageSize !== query.pageSize ||
        page.items.length > query.pageSize ||
        page.total < page.items.length ||
        new Set(page.items.map((user) => user.id)).size !== page.items.length
      )
        throw new IdentityError('protocol');
      return page;
    },
    create: async (input) => {
      const parsed = createUserSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      return userCall('/users', 'POST', parsed.data);
    },
    update: async (id, input) => {
      const parsed = updateUserSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      const user = await userCall(idPath(id), 'PATCH', parsed.data);
      if (user.id !== id || user.version <= input.version) throw new IdentityError('protocol');
      return user;
    },
    updateMe: async (input) => {
      const parsed = updateUserSchema.safeParse(input);
      if (!parsed.success) throw new IdentityError('validation');
      const user = await userCall('/me', 'PATCH', parsed.data);
      if (user.version <= input.version) throw new IdentityError('protocol');
      return user;
    },
    setStatus: async (id, version, status) => {
      if (!Number.isInteger(version) || version < 1 || !userStatusSchema.safeParse(status).success)
        throw new IdentityError('validation');
      const user = await userCall(`${idPath(id)}/status`, 'PATCH', { version, status });
      if (user.id !== id || user.version < version || user.status !== status)
        throw new IdentityError('protocol');
      return user;
    },
    setRoles: async (id, version, roleIds) => {
      if (!Number.isInteger(version) || version < 1 || !roleIdsSchema.safeParse(roleIds).success)
        throw new IdentityError('validation');
      const user = await userCall(`${idPath(id)}/roles`, 'PATCH', { version, roleIds });
      if (
        user.id !== id ||
        user.version < version ||
        JSON.stringify([...user.roleIds].sort()) !== JSON.stringify([...roleIds].sort())
      )
        throw new IdentityError('protocol');
      return user;
    },
  };
}
