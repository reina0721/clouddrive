import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  IdentityError,
  defaultUserQuery,
  defaultAuditQuery,
  type CreateUserInput,
  type UpdateUserInput,
} from '@clouddrive/surface/identity';
import { createMockIdentityService, type IdentityOperations } from '../identity/mock-service';
import { createBackendIdentityService } from '../identity/backend-service';
import {
  readMockDatabase,
  createDatabaseAuthRepository,
  MOCK_DATABASE_KEY,
} from '../identity/mock-database';
import { createMockAuthService } from '../auth/mock-adapter';
import { createBrowserMockRepository } from '../auth/mock-repository';
import { withMockDirectory } from '../identity/mock-auth';
import { createJsonClient } from '../api/json-client';

let owner = 'mock-demo';
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  owner = 'mock-demo';
  window.localStorage.removeItem(MOCK_DATABASE_KEY);
  await createDatabaseAuthRepository().saveSession({
    user: { id: owner, name: 'Rin', email: 'demo@community.test' },
    expiresAt: Date.now() + 60000,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.removeItem(MOCK_DATABASE_KEY);
});

function contractRequest(service: IdentityOperations): typeof fetch {
  return async (input, options) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      'https://example.test',
    );
    const path = url.pathname.replace(/^\/api/, '');
    const method = options?.method ?? 'GET';
    expect(options?.credentials).toBe('include');
    expect(options?.cache).toBe('no-store');
    if (path === '/auth/csrf') return Response.json({ token: 'test-csrf' });
    if (method !== 'GET')
      expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('test-csrf');
    const body: unknown = typeof options?.body === 'string' ? JSON.parse(options.body) : undefined;
    try {
      if (path === '/auth/access') return Response.json(await service.access());
      if (path === '/system/registration' && method === 'GET')
        return Response.json({ settings: await service.registrationSettings() });
      if (path === '/system/registration' && method === 'PATCH') {
        const { registrationSettingsInputSchema } = await import('@clouddrive/surface/identity');
        return Response.json({
          settings: await service.updateRegistrationSettings(
            registrationSettingsInputSchema.parse(body),
          ),
        });
      }
      if (
        path === '/roles' &&
        method === 'GET' &&
        url.searchParams.get('include') === 'memberCount'
      )
        return Response.json({ items: await service.roleSummaries() });
      if (path === '/roles' && method === 'GET')
        return Response.json({ items: await service.roles() });
      if (path === '/roles' && method === 'POST') {
        const { roleInputSchema } = await import('@clouddrive/surface/identity');
        return Response.json(
          { role: await service.createRole(roleInputSchema.parse(body)) },
          { status: 201 },
        );
      }
      const roleMatch = /^\/roles\/([^/]+)$/.exec(path);
      if (roleMatch?.[1]) {
        const id = decodeURIComponent(roleMatch[1]);
        if (method === 'GET') return Response.json({ role: await service.readRole(id) });
        if (method === 'PATCH') {
          const { updateRoleSchema } = await import('@clouddrive/surface/identity');
          return Response.json({
            role: await service.updateRole(id, updateRoleSchema.parse(body)),
          });
        }
      }
      if (path === '/users/batch-status' && method === 'POST') {
        const { batchStatusInputSchema } = await import('@clouddrive/surface/identity');
        return Response.json(await service.batchStatus(batchStatusInputSchema.parse(body)));
      }
      const memberMatch = /^\/roles\/([^/]+)\/members(?:\/([^/]+))?$/.exec(path);
      if (memberMatch?.[1]) {
        const roleId = memberMatch[1];
        if (method === 'GET')
          return Response.json(
            await service.roleMembers(roleId, {
              ...defaultUserQuery,
              q: url.searchParams.get('q') ?? '',
              page: Number(url.searchParams.get('page')),
              pageSize: Number(url.searchParams.get('pageSize')) === 10 ? 10 : 20,
            }),
          );
        const { z } = await import('zod');
        const values = z.object({ userId: z.string().optional(), version: z.number() }).parse(body);
        return Response.json({
          user: await service.changeRoleMember(
            roleId,
            values.userId ?? memberMatch[2] ?? '',
            values.version,
            method === 'POST',
          ),
        });
      }
      if (path === '/notifications/read-all' && method === 'PATCH') {
        await service.readAllNotifications();
        return new Response(null, { status: 204 });
      }
      if (path.startsWith('/notifications/') && method === 'GET')
        return Response.json({
          item: await service.readNotification(path.slice('/notifications/'.length)),
        });
      if (path === '/notifications' && method === 'GET' && url.searchParams.has('page')) {
        const { productInboxQuerySchema } = await import('@clouddrive/surface/identity');
        return Response.json(
          await service.inboxPage(
            productInboxQuerySchema.parse({
              ...Object.fromEntries(url.searchParams),
              page: Number(url.searchParams.get('page')),
              pageSize: Number(url.searchParams.get('pageSize')),
            }),
          ),
        );
      }
      if (path === '/notifications' && method === 'GET')
        return Response.json({ items: await service.inbox() });
      if (path === '/notifications/read' && method === 'PATCH') {
        const { readNotificationsSchema } = await import('@clouddrive/surface/identity');
        await service.readNotifications(readNotificationsSchema.parse(body).ids);
        return new Response(null, { status: 204 });
      }
      if (path === '/audit-logs' && method === 'GET') {
        const { auditQuerySchema } = await import('@clouddrive/surface/identity');
        return Response.json(
          await service.audit(
            auditQuerySchema.parse({
              q: url.searchParams.get('q'),
              actor: url.searchParams.get('actor') ?? '',
              object: url.searchParams.get('object') ?? '',
              from: url.searchParams.get('from') ?? '',
              to: url.searchParams.get('to') ?? '',
              operation: url.searchParams.get('operation'),
              result: url.searchParams.get('result'),
              page: Number(url.searchParams.get('page')),
              pageSize: Number(url.searchParams.get('pageSize')),
            }),
          ),
        );
      }
      const auditMatch = /^\/audit-logs\/([^/]+)$/.exec(path);
      if (auditMatch?.[1] && method === 'GET')
        return Response.json({
          record: await service.readAudit(decodeURIComponent(auditMatch[1])),
        });
      if (path === '/me' && method === 'GET') return Response.json({ user: await service.me() });
      if (path === '/me' && method === 'PATCH') {
        const { updateUserSchema } = await import('@clouddrive/surface/identity');
        return Response.json({ user: await service.updateMe(updateUserSchema.parse(body)) });
      }
      if (path === '/users' && method === 'GET') {
        const query = {
          ...defaultUserQuery,
          q: url.searchParams.get('q') ?? '',
          page: Number(url.searchParams.get('page')),
          pageSize: Number(url.searchParams.get('pageSize')),
        };
        const { userQuerySchema } = await import('@clouddrive/surface/identity');
        return Response.json(
          await service.list(
            userQuerySchema.parse({
              ...query,
              status: url.searchParams.get('status'),
              roleId: url.searchParams.get('roleId'),
              sort: url.searchParams.get('sort'),
              direction: url.searchParams.get('direction'),
            }),
          ),
        );
      }
      if (path === '/users' && method === 'POST') {
        const { createUserSchema } = await import('@clouddrive/surface/identity');
        return Response.json(
          { user: await service.create(createUserSchema.parse(body)) },
          { status: 201 },
        );
      }
      const match = /^\/users\/([^/]+)(?:\/(status|roles))?$/.exec(path);
      const id = match?.[1];
      if (id && method === 'GET')
        return Response.json({ user: await service.read(decodeURIComponent(id)) });
      if (id && method === 'PATCH') {
        const { z } = await import('zod');
        const { updateUserSchema, userStatusSchema, roleIdsSchema } =
          await import('@clouddrive/surface/identity');
        if (match[2] === 'status') {
          const values = z.object({ status: userStatusSchema, version: z.number() }).parse(body);
          return Response.json({
            user: await service.setStatus(id, values.version, values.status),
          });
        }
        if (match[2] === 'roles') {
          const values = z.object({ roleIds: roleIdsSchema, version: z.number() }).parse(body);
          return Response.json({
            user: await service.setRoles(id, values.version, values.roleIds),
          });
        }
        return Response.json({ user: await service.update(id, updateUserSchema.parse(body)) });
      }
      return new Response(null, { status: 404 });
    } catch (error) {
      if (!(error instanceof IdentityError)) throw error;
      const status =
        error.code === 'unauthenticated'
          ? 401
          : error.code === 'forbidden'
            ? 403
            : error.code === 'not-found'
              ? 404
              : error.code === 'conflict'
                ? 409
                : error.code === 'validation'
                  ? 422
                  : 503;
      return Response.json(
        {
          error: {
            code: error.code,
            ...(error.reason ? { reason: error.reason } : {}),
            fields: error.fields,
          },
        },
        { status },
      );
    }
  };
}
describe.each(['mock', 'backend'] as const)('%s identity contract', (mode) => {
  function service() {
    const mock = createMockIdentityService(() => owner);
    return mode === 'mock' ? mock : createBackendIdentityService('/api', contractRequest(mock));
  }
  async function switchOwner(id: string) {
    const user = (await readMockDatabase()).users.find((candidate) => candidate.id === id);
    if (!user) throw new Error('Missing contract fixture user');
    owner = id;
    await createDatabaseAuthRepository().saveSession({
      user: { id, name: user.name, email: user.email },
      expiresAt: Date.now() + 60000,
    });
  }
  it('returns partial batch results and preserves other roles during member changes', async () => {
    const api = service();
    const member = await api.read('mock-viewer');
    const self = await api.me();
    const batch = await api.batchStatus({
      status: 'disabled',
      items: [
        { id: member.id, version: member.version },
        { id: self.id, version: self.version },
        { id: 'missing', version: 1 },
      ],
    });
    expect(batch.items.map((item) => item.success)).toEqual([true, false, false]);
    expect((await api.read(member.id)).status).toBe('disabled');
    const refreshed = await api.read(member.id);
    await api.changeRoleMember('operator', member.id, refreshed.version, true);
    const joined = await api.read(member.id);
    expect(joined.roleIds).toEqual(['viewer', 'operator']);
    await expect(
      api.changeRoleMember('operator', member.id, refreshed.version, false),
    ).rejects.toMatchObject({ code: 'conflict' });
    await api.changeRoleMember('operator', member.id, joined.version, false);
    expect((await api.read(member.id)).roleIds).toEqual(['viewer']);
    expect(
      (await api.roleSummaries()).find((role) => role.id === 'viewer')?.memberCount,
    ).toBeGreaterThan(0);
    expect(
      (await api.roleMembers('viewer', { ...defaultUserQuery, pageSize: 10 })).items.every((user) =>
        user.roleIds.includes('viewer'),
      ),
    ).toBe(true);
  });
  it('paginates owned notifications and marks only existing notifications read', async () => {
    const api = service();
    const user = await api.read('mock-viewer');
    for (let index = 0; index < 3; index++) {
      const current = await api.read(user.id);
      await api.setStatus(user.id, current.version, index % 2 ? 'active' : 'disabled');
    }
    const query = {
      q: '',
      category: 'all' as const,
      read: 'all' as const,
      page: 1,
      pageSize: 10 as const,
    };
    const page = await api.inboxPage(query);
    expect(page.total).toBeGreaterThanOrEqual(3);
    expect(page.items.every((item) => item.ownerId === owner)).toBe(true);
    const item = page.items[0];
    if (!item) throw new Error('Missing notification');
    expect((await api.readNotification(item.id)).id).toBe(item.id);
    await api.readAllNotifications();
    expect((await api.inboxPage(query)).unread).toBe(0);
    const current = await api.read(user.id);
    await api.setStatus(user.id, current.version, 'active');
    expect((await api.inboxPage(query)).unread).toBe(1);
  });
  it('filters audit by actor, object and inclusive timestamps', async () => {
    const api = service();
    const user = await api.read('mock-viewer');
    await api.setStatus(user.id, user.version, 'disabled');
    const items = await api.audit({ ...defaultAuditQuery, actor: 'Rin', object: 'Morgan' });
    expect(items.total).toBeGreaterThan(0);
    expect((await api.audit({ ...defaultAuditQuery, actor: 'missing-actor' })).total).toBe(0);
    const first = items.items[0];
    if (!first) throw new Error('Missing audit fixture');
    expect(
      (await api.audit({ ...defaultAuditQuery, from: first.createdAt, to: first.createdAt })).total,
    ).toBeGreaterThan(0);
    await expect(
      api.audit({ ...defaultAuditQuery, from: '2030-01-01T00:00:00Z', to: '2020-01-01T00:00:00Z' }),
    ).rejects.toMatchObject({ code: 'validation' });
  });
  it('applies registration policy at submission, preserves existing grants and audits conflicts', async () => {
    const api = service();
    const initial = await api.registrationSettings();
    expect(initial).toMatchObject({ enabled: true, defaultRoleId: 'viewer' });
    const changed = await api.updateRegistrationSettings({
      enabled: true,
      defaultRoleId: 'operator',
      version: initial.version,
    });
    const auth = createMockAuthService(createBrowserMockRepository());
    const session = await auth.register({
      name: 'Policy member',
      email: 'policy@example.test',
      password: 'PolicyPass2026!',
    });
    expect(
      (await readMockDatabase()).users.find((user) => user.id === session.user.id)?.roleIds,
    ).toEqual(['operator']);
    await switchOwner('mock-demo');
    const disabled = await api.updateRegistrationSettings({
      enabled: false,
      defaultRoleId: 'viewer',
      version: changed.version,
    });
    await expect(
      auth.register({
        name: 'Closed member',
        email: 'closed@example.test',
        password: 'PolicyPass2026!',
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(
      (await readMockDatabase()).users.some((user) => user.email === 'closed@example.test'),
    ).toBe(false);
    expect(
      (await readMockDatabase()).users.find((user) => user.id === session.user.id)?.roleIds,
    ).toEqual(['operator']);
    await expect(
      api.updateRegistrationSettings({
        enabled: true,
        defaultRoleId: 'viewer',
        version: changed.version,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(await api.registrationSettings()).toEqual(disabled);
    const records = await api.audit({ ...defaultAuditQuery, operation: 'settings.update' });
    expect(records.items.map((record) => record.result)).toEqual(['failure', 'success', 'success']);
  });
  it('rejects unauthorized policy changes and privileged registration roles', async () => {
    const api = service();
    const initial = await api.registrationSettings();
    await expect(
      api.updateRegistrationSettings({
        enabled: true,
        defaultRoleId: 'administrator',
        version: initial.version,
      }),
    ).rejects.toMatchObject({ code: 'validation' });
    const role = await api.createRole({
      name: 'Public reviewer',
      permissions: ['account.update', 'audit.read'],
    });
    await api.updateRegistrationSettings({
      enabled: true,
      defaultRoleId: role.id,
      version: initial.version,
    });
    await expect(
      api.updateRole(role.id, {
        name: role.name,
        permissions: ['account.update', 'users.roles'],
        version: role.version,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await switchOwner('mock-viewer');
    await expect(api.registrationSettings()).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      api.updateRegistrationSettings({
        enabled: false,
        defaultRoleId: 'viewer',
        version: initial.version,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
  it('persists custom roles, changes effective grants and queries actual membership', async () => {
    const api = service();
    const role = await api.createRole({
      name: 'Audit reviewer',
      permissions: ['account.update', 'users.read'],
    });
    expect(await service().readRole(role.id)).toEqual(role);
    const member = await api.read('member-001');
    await api.setRoles(member.id, member.version, [role.id]);
    const members = await api.list({ ...defaultUserQuery, roleId: role.id });
    expect(members.items.map((user) => user.id)).toEqual([member.id]);
    await switchOwner(member.id);
    expect((await api.access()).permissions).toEqual(role.permissions);
    await expect(api.audit(defaultAuditQuery)).rejects.toMatchObject({ code: 'forbidden' });
    await switchOwner('mock-demo');
    const updated = await api.updateRole(role.id, {
      name: 'Audit reviewer',
      permissions: ['account.update', 'audit.read'],
      version: role.version,
    });
    expect(updated.version).toBeGreaterThan(role.version);
    await expect(
      api.updateRole(role.id, { name: 'Stale', permissions: [], version: role.version }),
    ).rejects.toMatchObject({ code: 'conflict', reason: 'stale-version' });
    await switchOwner(member.id);
    expect((await service().access()).permissions).toEqual(updated.permissions);
    await expect(api.list(defaultUserQuery)).rejects.toMatchObject({ code: 'forbidden' });
    expect((await api.audit(defaultAuditQuery)).total).toBeGreaterThan(0);
  });
  it('does not lose concurrent successful creates or their notification/audit records', async () => {
    const api = service();
    const input = {
      name: 'Concurrent one',
      email: 'one@example.test',
      password: 'ConcurrentPassword2026!',
      status: 'active' as const,
      roleIds: ['viewer'],
    };
    const [one, two] = await Promise.all([
      api.create(input),
      service().create({ ...input, name: 'Concurrent two', email: 'two@example.test' }),
    ]);
    expect(one.id).not.toBe(two.id);
    expect(await api.read(one.id)).toEqual(one);
    expect(await api.read(two.id)).toEqual(two);
    expect((await api.audit({ ...defaultAuditQuery, operation: 'users.create' })).total).toBe(2);
    expect(await api.inbox()).toHaveLength(2);
  });
  it('protects system and own roles, and bounds delegated grants', async () => {
    const api = service();
    const administrator = await api.readRole('administrator');
    await expect(
      api.updateRole(administrator.id, {
        name: administrator.name,
        permissions: administrator.permissions,
        version: administrator.version,
      }),
    ).rejects.toMatchObject({ code: 'conflict', reason: 'protected-role' });
    const delegate = await api.createRole({
      name: 'Delegate',
      permissions: [
        'roles.read',
        'roles.create',
        'roles.update',
        'users.read',
        'users.roles',
        'account.update',
      ],
    });
    const foreign = await api.createRole({
      name: 'Foreign grants',
      permissions: ['audit.read', 'account.update'],
    });
    await expect(api.createRole({ name: 'Delegate', permissions: [] })).rejects.toMatchObject({
      code: 'conflict',
      reason: 'duplicate-role',
    });
    const member = await api.read('member-001');
    await api.setRoles(member.id, member.version, [delegate.id]);
    await switchOwner(member.id);
    await expect(
      api.createRole({ name: 'Escalation', permissions: ['audit.read'] }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      api.updateRole(delegate.id, {
        name: delegate.name,
        permissions: delegate.permissions,
        version: delegate.version,
      }),
    ).rejects.toMatchObject({ code: 'conflict', reason: 'protected-user' });
    const other = await api.read('member-002');
    await expect(api.setRoles(other.id, other.version, ['administrator'])).rejects.toMatchObject({
      code: 'forbidden',
    });
    const reduced = await api.updateRole(foreign.id, {
      name: foreign.name,
      permissions: ['account.update'],
      version: foreign.version,
    });
    expect(reduced.permissions).toEqual(['account.update']);
  });
  it('keeps notification ownership, batch read and success/failure audit consistent', async () => {
    const api = service();
    expect(await api.inbox()).toEqual([]);
    expect((await api.audit(defaultAuditQuery)).items).toEqual([]);
    const target = await api.read('member-001');
    const saved = await api.update(target.id, {
      name: 'Reviewed member',
      email: target.email,
      version: target.version,
    });
    await expect(
      api.update(target.id, { name: 'Stale member', email: target.email, version: target.version }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const own = await api.inbox();
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({
      ownerId: 'mock-demo',
      objectId: target.id,
      objectName: saved.name,
      read: false,
    });
    const success = await api.audit({
      ...defaultAuditQuery,
      operation: 'users.update',
      result: 'success',
      q: target.id,
    });
    const failure = await api.audit({ ...defaultAuditQuery, result: 'failure', q: target.id });
    expect(success.total).toBe(1);
    expect(failure.items[0]).toMatchObject({
      actorId: 'mock-demo',
      objectId: target.id,
      result: 'failure',
      errorCode: 'conflict',
    });
    const record = success.items[0];
    if (!record) throw new Error('Missing success audit');
    expect(await api.readAudit(record.id)).toEqual(record);
    await switchOwner(target.id);
    const received = await api.inbox();
    expect(received).toHaveLength(1);
    expect(received[0]?.id).not.toBe(own[0]?.id);
    const mine = received[0],
      other = own[0];
    if (!mine || !other) throw new Error('Missing notification fixtures');
    await expect(api.readNotifications([mine.id, other.id])).rejects.toMatchObject({
      code: 'not-found',
    });
    expect((await api.inbox())[0]?.read).toBe(false);
    await api.readNotifications([mine.id]);
    await api.readNotifications([mine.id]);
    expect((await service().inbox())[0]?.read).toBe(true);
    await expect(api.readAudit(record.id)).rejects.toMatchObject({ code: 'forbidden' });
    await switchOwner('mock-demo');
    expect((await api.inbox())[0]?.read).toBe(false);
  });
  it('closes query/create/read/edit/status/role/reload with one identity and preserved credentials', async () => {
    const api = service();
    const first = await api.list({ ...defaultUserQuery, pageSize: 10 });
    expect(first.items).toHaveLength(10);
    expect(first.total).toBe(24);
    const input: CreateUserInput = {
      name: 'New member',
      email: 'NEW@example.test',
      password: 'CreatedPassword2026!',
      status: 'active',
      roleIds: ['viewer'],
    };
    const created = await api.create(input);
    expect(created.email).toBe('new@example.test');
    expect(JSON.stringify(await readMockDatabase())).not.toContain(input.password);
    const searched = await api.list({ ...defaultUserQuery, q: 'new@example.test' });
    expect(searched.items.map((user) => user.id)).toEqual([created.id]);
    await expect(api.create(input)).rejects.toMatchObject({
      code: 'conflict',
      reason: 'duplicate-email',
    });
    const edited = await api.update(created.id, {
      name: 'Updated member',
      email: 'updated@example.test',
      version: created.version,
    });
    expect(await api.read(created.id)).toEqual(edited);
    await expect(
      api.update(created.id, { name: 'Stale', email: edited.email, version: created.version }),
    ).rejects.toMatchObject({ code: 'conflict', reason: 'stale-version' });
    const disabled = await api.setStatus(created.id, edited.version, 'disabled');
    expect(
      (await service().list({ ...defaultUserQuery, status: 'disabled', q: 'updated' })).items,
    ).toEqual([disabled]);
    const enabled = await api.setStatus(created.id, disabled.version, 'active');
    const assigned = await api.setRoles(created.id, enabled.version, ['operator', 'viewer']);
    expect((await service().read(created.id)).roleIds).toEqual(assigned.roleIds);
    const auth = withMockDirectory(createMockAuthService(createBrowserMockRepository()));
    await auth.logout();
    const session = await auth.login({ email: edited.email, password: input.password });
    expect(session.user.id).toBe(created.id);
  });
  it('protects self, validates role relationships and denies a restricted identity', async () => {
    const api = service();
    const self = await api.me();
    await expect(api.setStatus(self.id, self.version, 'disabled')).rejects.toMatchObject({
      code: 'conflict',
      reason: 'protected-user',
    });
    await expect(api.setRoles(self.id, self.version, ['viewer'])).rejects.toMatchObject({
      code: 'conflict',
      reason: 'protected-user',
    });
    const target = await api.read('member-001');
    await expect(api.setRoles(target.id, target.version, ['missing-role'])).rejects.toMatchObject({
      code: 'validation',
    });
    owner = 'mock-viewer';
    await createDatabaseAuthRepository().saveSession({
      user: { id: owner, name: 'Morgan Lee', email: 'viewer@community.test' },
      expiresAt: Date.now() + 60000,
    });
    await expect(api.list(defaultUserQuery)).rejects.toMatchObject({ code: 'forbidden' });
    const profile = await api.me();
    expect(profile.id).toBe(owner);
    expect((await api.access()).permissions).toEqual(['account.update']);
    const update: UpdateUserInput = {
      name: 'Morgan updated',
      email: profile.email,
      version: profile.version,
    };
    const changed = await api.updateMe(update);
    expect((await api.me()).name).toBe(changed.name);
    await expect(api.update(target.id, update)).rejects.toMatchObject({ code: 'forbidden' });
  });
});
it('migrates v2 records without replacing accounts, sessions or user changes', async () => {
  const prior = await readMockDatabase();
  const state = {
    accounts: prior.accounts,
    session: prior.session,
    users: prior.users,
    sequence: 12,
  };
  window.localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify({ version: 2, state }));
  const migrated = await readMockDatabase();
  expect(migrated.users).toEqual(state.users);
  expect(migrated.session).toEqual(state.session);
  expect(migrated.accounts).toEqual(state.accounts);
  expect(migrated.sequence).toBe(12);
  expect(migrated.roles.map((role) => role.id)).toEqual(['administrator', 'operator', 'viewer']);
  expect(migrated.notifications).toEqual([]);
  expect(migrated.auditRecords).toEqual([]);
});
it('migrates v1 accounts/session in place and preserves corrupt/unknown versions', async () => {
  const session = {
    user: { id: 'legacy-one', name: 'Legacy', email: 'legacy@example.test' },
    expiresAt: Date.now() + 60000,
  };
  window.localStorage.setItem(
    MOCK_DATABASE_KEY,
    JSON.stringify({
      version: 1,
      state: { accounts: [{ user: session.user, salt: 'salt', digest: 'a'.repeat(64) }], session },
    }),
  );
  const migrated = await readMockDatabase();
  expect(migrated.users.find((user) => user.id === session.user.id)).toMatchObject({
    ...session.user,
    roleIds: ['viewer'],
  });
  expect(migrated.accounts).toHaveLength(1);
  window.localStorage.setItem(MOCK_DATABASE_KEY, 'corrupt');
  await expect(readMockDatabase()).rejects.toMatchObject({ code: 'protocol' });
  expect(window.localStorage.getItem(MOCK_DATABASE_KEY)).toBe('corrupt');
  const newer = JSON.stringify({ version: 100, state: migrated });
  window.localStorage.setItem(MOCK_DATABASE_KEY, newer);
  await expect(readMockDatabase()).rejects.toMatchObject({ code: 'protocol' });
  expect(window.localStorage.getItem(MOCK_DATABASE_KEY)).toBe(newer);
});
it('migrates v3 in place without replacing users, role grants, notifications or audit', async () => {
  const database = await readMockDatabase();
  const { registrationSettings, securitySessions, ...prior } = database;
  expect(securitySessions.length).toBeGreaterThan(0);
  const original = {
    ...prior,
    roles: prior.roles.map((role) => ({
      ...role,
      permissions: role.permissions.filter((permission) => !permission.startsWith('settings.')),
    })),
  };
  window.localStorage.setItem(MOCK_DATABASE_KEY, JSON.stringify({ version: 3, state: original }));
  const migrated = await readMockDatabase();
  expect(migrated.registrationSettings).toMatchObject({
    enabled: true,
    defaultRoleId: 'viewer',
    version: 1,
  });
  expect(migrated.registrationSettings).toEqual(registrationSettings);
  expect(migrated.users).toEqual(original.users);
  expect(migrated.accounts).toEqual(original.accounts);
  expect(migrated.notifications).toEqual(original.notifications);
  expect(migrated.auditRecords).toEqual(original.auditRecords);
  expect(migrated.roles.find((role) => role.id === 'administrator')?.permissions).toEqual(
    expect.arrayContaining(['settings.read', 'settings.update']),
  );
  expect(migrated.roles.find((role) => role.id === 'viewer')?.permissions).toEqual([
    'account.update',
  ]);
});
it('never reports success when durable writes are rejected', async () => {
  const api = createMockIdentityService(() => owner);
  const self = await api.me();
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Full', 'QuotaExceededError');
  });
  await expect(
    api.updateMe({ name: 'Not saved', email: self.email, version: self.version }),
  ).rejects.toMatchObject({ code: 'persistence' });
  write.mockRestore();
  expect((await api.me()).name).toBe('Rin');
});
it('rejects malformed or mismatched backend payloads without fabricating users', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ user: { id: 'invalid' } }));
  const api = createBackendIdentityService('/api', request);
  await expect(api.me()).rejects.toMatchObject({ code: 'protocol' });
  const user = (await readMockDatabase()).users[0];
  request.mockResolvedValue(Response.json({ user }));
  await expect(api.read('member-001')).rejects.toMatchObject({ code: 'protocol' });
  request.mockResolvedValue(Response.json({ error: { code: 'unavailable' } }, { status: 401 }));
  await expect(api.me()).rejects.toMatchObject({ code: 'unauthenticated' });
});
it('retains timeout/network/protocol distinctions and never falls back to Mock', async () => {
  const network = createBackendIdentityService('/api', () =>
    Promise.reject(new TypeError('offline')),
  );
  await expect(network.me()).rejects.toMatchObject({ code: 'network' });
  vi.useFakeTimers();
  const call = createJsonClient(
    '/api',
    (_input, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      }),
  );
  const pending = expect(call('/me')).rejects.toMatchObject({ code: 'timeout' });
  await vi.advanceTimersByTimeAsync(15000);
  await pending;
  vi.useRealTimers();
});
