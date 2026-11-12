import { z } from 'zod';
import {
  accountPreferencesSchema,
  profileSchema,
  securityAuditPageSchema,
  organizationItemSchema,
  assignmentSchema,
  menuSchema,
  dictionariesSchema,
  todoSchema,
  dashboardSchema,
  tokenSchema,
  permissionSchema,
  type AdministrationPort,
} from '@clouddrive/surface/administration';
import { refreshServerNavigation } from '../state/use-server-navigation';
import { createJsonClient, ApiError } from '../api/json-client';
import { applyAccountPreferences } from './preferences';
import { createRuntimePort, readRuntimeInformation } from './runtime-backend';
import { IdentityError } from '@clouddrive/surface/identity/runtime';
import { createAccountRequest } from '../api/account-request';

export function createAdministrationPort(
  base: string,
  currentUserId?: () => string | null,
): AdministrationPort {
  function ownerGuard() {
    const owner = currentUserId?.();
    return () => {
      if (currentUserId && (!owner || owner !== currentUserId())) throw new ApiError('http', 401);
    };
  }
  const json: ReturnType<typeof createJsonClient> = async (path, options) => {
    const assertOwner = ownerGuard();
    assertOwner();
    const transport = createJsonClient(
      base,
      currentUserId ? createAccountRequest(currentUserId, currentUserId()) : fetch,
    );
    try {
      return await transport(path, options);
    } finally {
      assertOwner();
    }
  };
  const native = '/native';
  const list = <T>(schema: z.ZodType<T>) =>
    z.object({
      items: z.array(schema),
      total: z.number().optional(),
      offset: z.number().optional(),
      limit: z.number().optional(),
    });
  async function all<T>(path: string, schema: z.ZodType<T>): Promise<T[]> {
    const assertOwner = ownerGuard();
    assertOwner();
    const items: T[] = [];
    for (let offset = 0; ; offset += 100) {
      const value = list(schema).parse(
        await json(`${path}${path.includes('?') ? '&' : '?'}offset=${offset}&limit=100`),
      );
      assertOwner();
      items.push(...value.items);
      if (value.total === undefined || items.length >= value.total) break;
      if (value.items.length === 0) throw new ApiError('protocol');
    }
    return items;
  }
  async function write(
    path: string,
    body: unknown = {},
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST',
    headers?: Readonly<Record<string, string>>,
  ) {
    return json(path, { method, body, ...(headers ? { headers } : {}) });
  }
  async function tokenOperation<T>(operation: () => Promise<T>): Promise<T> {
    const owner = currentUserId?.();
    try {
      return await operation();
    } catch (error) {
      if (currentUserId && (!owner || owner !== currentUserId()))
        throw new IdentityError('unauthenticated');
      if (error instanceof z.ZodError) throw new IdentityError('protocol');
      if (!(error instanceof ApiError)) throw error;
      if (error.code === 'network' || error.code === 'timeout' || error.code === 'protocol')
        throw new IdentityError(error.code);
      const status = error.status;
      throw new IdentityError(
        status === 401
          ? 'unauthenticated'
          : status === 403
            ? 'forbidden'
            : status === 404
              ? 'not-found'
              : status === 409 || status === 412
                ? 'conflict'
                : status === 400 || status === 422
                  ? 'validation'
                  : 'unavailable',
      );
    }
  }
  return {
    preferences: async () =>
      accountPreferencesSchema.parse(await json(native + '/iam/self/preferences')),
    savePreferences: async (value) => {
      const owner = currentUserId?.();
      const saved = accountPreferencesSchema.parse(
        await write(native + '/iam/self/preferences', value, 'PATCH'),
      );
      if (!currentUserId || owner === currentUserId()) applyAccountPreferences(saved);
      return saved;
    },
    profile: async () => {
      const [session, me] = await Promise.all([json(native + '/iam/session'), json('/me')]);
      const identity = z
        .object({
          identity: z.object({ nickname: z.string(), bio: z.string(), birthDate: z.string() }),
        })
        .parse(session).identity;
      const version = z.object({ user: z.object({ version: z.number() }) }).parse(me).user.version;
      return profileSchema.parse({ ...identity, version });
    },
    saveProfile: async (value) => {
      await write(
        native + '/iam/self/profile',
        {
          expectedVersion: value.version,
          nickname: value.nickname,
          bio: value.bio,
          birthDate: value.birthDate,
        },
        'PATCH',
      );
    },
    organization: (kind) => all(`${native}/organization/${kind}`, organizationItemSchema),
    saveOrganization: async (kind, draft, existing) => {
      const path = `${native}/organization/${kind}${existing ? '/' + encodeURIComponent(existing.id) : ''}`;
      const details =
        kind === 'departments' ? { leader: draft.leader ?? '', remark: draft.remark ?? '' } : {};
      const body = existing
        ? {
            ...details,
            version: existing.version,
            name: draft.name,
            active: draft.active,
            archived: draft.archived,
            ...(kind === 'departments'
              ? { parentId: draft.parentId || undefined, clearParent: !draft.parentId }
              : {}),
          }
        : {
            ...details,
            code: draft.code,
            name: draft.name,
            ...(kind === 'departments' && draft.parentId ? { parentId: draft.parentId } : {}),
          };
      await write(path, body, existing ? 'PATCH' : 'POST');
    },
    assignment: async (accountId) =>
      assignmentSchema.parse(
        await json(`${native}/organization/accounts/${encodeURIComponent(accountId)}/assignment`),
      ),
    assign: async (value) => {
      await write(
        `${native}/organization/accounts/${encodeURIComponent(value.accountId)}/assignment`,
        {
          departmentId: value.departmentId ?? null,
          positionIds: value.positionIds,
          expectedVersion: value.version,
        },
        'PUT',
      );
    },
    menus: async () =>
      z.object({ items: z.array(menuSchema) }).parse(await json(`${native}/navigation/menus`))
        .items,
    saveMenu: async (value) => {
      await write(
        `${native}/navigation/menus/${encodeURIComponent(value.id)}`,
        {
          version: value.version,
          enabled: value.enabled,
          parentOverride: value.parentId,
          orderOverride: value.order,
          label: value.label,
          permission: value.permission,
        },
        'PUT',
      );
      await refreshServerNavigation(base);
    },
    dictionaries: async () => dictionariesSchema.parse(await json('/dictionaries')),
    saveDictionary: async (value, existing) =>
      dictionariesSchema.parse(
        await write(
          `/dictionaries${existing ? '/' + encodeURIComponent(existing.id) : ''}`,
          { ...value, ...(existing ? { version: existing.version } : {}) },
          existing ? 'PATCH' : 'POST',
        ),
      ),
    removeDictionary: async (value) =>
      dictionariesSchema.parse(
        await write(
          `/dictionaries/${encodeURIComponent(value.id)}`,
          { version: value.version },
          'DELETE',
        ),
      ),
    saveDictionaryItem: async (typeId, value, existing) =>
      dictionariesSchema.parse(
        await write(
          existing
            ? `/dictionary-items/${encodeURIComponent(existing.id)}`
            : `/dictionaries/${encodeURIComponent(typeId)}/items`,
          { ...value, ...(existing ? { version: existing.version } : {}) },
          existing ? 'PATCH' : 'POST',
        ),
      ),
    removeDictionaryItem: async (value) =>
      dictionariesSchema.parse(
        await write(
          `/dictionary-items/${encodeURIComponent(value.id)}`,
          { version: value.version },
          'DELETE',
        ),
      ),
    todos: async () => {
      const items: z.infer<typeof todoSchema>[] = [];
      for (let page = 1; ; page++) {
        const value = z
          .object({ items: z.array(todoSchema), total: z.number() })
          .parse(await json('/todos?page=' + page + '&pageSize=50'));
        items.push(...value.items);
        if (items.length >= value.total) break;
        if (value.items.length === 0) throw new ApiError('protocol');
      }
      return items;
    },
    createTodo: async (title) => {
      await write('/todos', { title });
    },
    completeTodo: async (id) => {
      await write(`/todos/${encodeURIComponent(id)}/complete`, {}, 'PATCH');
    },
    dashboard: async () => dashboardSchema.parse(await json('/dashboard')),
    mfaStatus: async () =>
      z.object({ registered: z.boolean() }).parse(await json(`${native}/iam/self/mfa`)).registered,
    beginMfa: async () =>
      z
        .object({ secret: z.string(), uri: z.string() })
        .parse(await write(`${native}/iam/self/mfa`)),
    confirmMfa: async (code) =>
      z
        .object({ recoveryCodes: z.array(z.string()) })
        .parse(await write(`${native}/iam/self/mfa/confirm`, { code })).recoveryCodes,
    disableMfa: async (code) => {
      await write(`${native}/iam/self/mfa/disable`, { code });
    },
    tokens: () => tokenOperation(() => all(`${native}/iam/api-tokens?status=all`, tokenSchema)),
    createToken: async (name, scopes, description = '', expiresAt) =>
      tokenOperation(async () =>
        tokenSchema.parse(
          await write(`${native}/iam/api-tokens`, {
            name,
            scopes,
            description,
            ...(expiresAt ? { expiresAt } : {}),
          }),
        ),
      ),
    updateToken: async (value) =>
      tokenOperation(async () => {
        await write(
          `${native}/iam/api-tokens/${encodeURIComponent(value.id)}`,
          {
            name: value.name,
            description: value.description ?? '',
            ...(value.expiresAt ? { expiresAt: value.expiresAt } : { neverExpires: true }),
          },
          'PATCH',
          { 'If-Match': '"' + String(value.version) + '"' },
        );
      }),
    tokenAction: async (id, action, version) =>
      tokenOperation(async () => {
        const result = await write(
          `${native}/iam/api-tokens/${encodeURIComponent(id)}/${action}`,
          {},
          'POST',
          { 'If-Match': '"' + String(version) + '"' },
        );
        return action === 'rotate' ? tokenSchema.parse(result) : null;
      }),
    permissions: () => all(`${native}/iam/permissions`, permissionSchema),
    archiveAccount: async (id, version) => {
      await write(`${native}/iam/accounts/${encodeURIComponent(id)}/archive`, {}, 'POST', {
        'If-Match': '"' + String(version) + '"',
      });
    },
    resetPassword: async (id, password, version) => {
      await write(
        `${native}/iam/accounts/${encodeURIComponent(id)}/password-reset`,
        { password },
        'POST',
        { 'If-Match': '"' + String(version) + '"' },
      );
    },
    beginArchive: async () =>
      z.object({ confirmationId: z.string() }).parse(await write(`${native}/iam/self/archive`))
        .confirmationId,
    confirmArchive: async (confirmationId) => {
      await write(`${native}/iam/self/archive/confirm`, { confirmationId });
    },
    endSession: () => window.location.replace('/login'),
    rolePermissions: async (id) =>
      z
        .object({
          roleId: z.string(),
          roleVersion: z.number(),
          permissionKeys: z.array(z.string()),
        })
        .parse(await json(native + '/iam/roles/' + encodeURIComponent(id) + '/permissions')),
    replaceRolePermissions: async (value) => {
      await write(
        native + '/iam/roles/' + encodeURIComponent(value.roleId) + '/permissions',
        { expectedRoleVersion: value.roleVersion, permissionKeys: value.permissionKeys },
        'PUT',
      );
    },
    securityAudit: (cursor, signal) =>
      readRuntimeInformation(
        async () => {
          const result = securityAuditPageSchema.safeParse(
            await json(
              native +
                '/auth/audit?limit=20' +
                (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''),
              signal ? { signal } : {},
            ),
          );
          if (!result.success) throw new ApiError('protocol');
          return result.data;
        },
        currentUserId,
        signal,
      ),
    runtime: createRuntimePort(
      (signal) => json('/system/runtime', signal ? { signal } : {}),
      currentUserId,
    ),
  };
}
