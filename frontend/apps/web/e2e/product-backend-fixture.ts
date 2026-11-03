import type { BrowserContext } from '@playwright/test';
import {
  batchStatusInputSchema,
  productInboxQuerySchema,
  changePasswordSchema,
  permissionCodes,
  registrationSettingsInputSchema,
  createUserSchema,
  updateUserSchema,
  roleInputSchema,
  updateRoleSchema,
  readNotificationsSchema,
  userQuerySchema,
  auditQuerySchema,
  type DirectoryUser,
  type DirectoryRole,
  type ProductNotification,
  type AuditRecord,
} from '@clouddrive/surface/identity';

/** Controlled HTTP contract fixture. It proves adapter/UI requests, never a real backend deployment. */
export async function installProductBackend(context: BrowserContext) {
  const date = '2026-10-12T00:00:00.000Z';
  const admin: DirectoryUser = {
    id: 'backend-review',
    name: 'Backend Review',
    email: 'backend@example.test',
    status: 'active',
    roleIds: ['administrator'],
    version: 1,
    createdAt: date,
    updatedAt: date,
  };
  const users: DirectoryUser[] = [admin];
  const roles: DirectoryRole[] = [
    {
      id: 'administrator',
      name: 'Administrator',
      permissions: [...permissionCodes],
      protected: true,
      version: 1,
      createdAt: date,
      updatedAt: date,
    },
    {
      id: 'viewer',
      name: 'Viewer',
      permissions: ['account.update'],
      protected: true,
      version: 1,
      createdAt: date,
      updatedAt: date,
    },
  ];
  let registrationSettings = {
    enabled: true,
    defaultRoleId: 'viewer',
    version: 1,
    updatedAt: date,
  };
  const notifications: ProductNotification[] = [];
  const audit: AuditRecord[] = [];
  const writes: { path: string; method: string; csrf: string | undefined }[] = [];
  let nextId = 0;
  let authenticated = true;
  let password = 'BackendPassword2026!';
  let sessions = [
    {
      id: 'backend-current',
      device: 'Browser',
      createdAt: date,
      lastActiveAt: date,
      expiresAt: '2030-10-01T00:00:00.000Z',
      current: true,
    },
    {
      id: 'backend-other',
      device: 'Other browser',
      createdAt: date,
      lastActiveAt: date,
      expiresAt: '2030-10-01T00:00:00.000Z',
      current: false,
    },
  ];
  let conflict = false;
  let policyConflict = false;
  function record(operation: AuditRecord['operation'], objectId: string, objectName: string) {
    nextId += 1;
    audit.unshift({
      id: `audit-${nextId}`,
      actorId: admin.id,
      actorName: admin.name,
      objectId,
      objectName,
      operation,
      createdAt: date,
      result: 'success',
    });
    notifications.unshift({
      id: `notice-${nextId}`,
      ownerId: admin.id,
      objectId,
      objectName,
      operation,
      category: 'success',
      createdAt: date,
      read: false,
    });
  }
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    const error = (status: number, code: string, reason?: string) =>
      reply({ error: { code, ...(reason ? { reason } : {}) } }, status);
    if (path === '/auth/csrf') return reply({ token: 'product-csrf' });
    if (method !== 'GET') {
      writes.push({ path, method, csrf: request.headers()['x-csrf-token'] });
      if (request.headers()['x-csrf-token'] !== 'product-csrf') return error(403, 'forbidden');
    }
    if (path === '/auth/session' && !authenticated) return error(401, 'unauthenticated');
    if (path === '/auth/session')
      return reply({
        user: { id: admin.id, name: admin.name, email: admin.email },
        expiresAt: Date.now() + 3_600_000,
      });
    if (path === '/auth/access') return reply({ user: admin, permissions: [...permissionCodes] });
    const body: unknown = method === 'GET' ? undefined : request.postDataJSON();
    if (path === '/auth/sessions' && method === 'GET') return reply({ items: sessions });
    if (path === '/auth/password' && method === 'POST') {
      const parsed = changePasswordSchema.safeParse(body);
      if (!parsed.success || parsed.data.currentPassword !== password)
        return error(422, 'validation');
      password = parsed.data.newPassword;
      authenticated = false;
      sessions = [];
      return route.fulfill({ status: 204 });
    }
    if (path === '/auth/login' && method === 'POST') {
      if (typeof body !== 'object' || body === null || !('email' in body) || !('password' in body))
        return error(422, 'validation');
      if (body.email !== admin.email || body.password !== password)
        return error(401, 'credentials');
      authenticated = true;
      sessions = [
        {
          id: 'backend-current',
          device: 'Browser',
          createdAt: date,
          lastActiveAt: date,
          expiresAt: '2030-10-01T00:00:00.000Z',
          current: true,
        },
      ];
      return route.fulfill({ status: 204 });
    }
    if (path === '/auth/sessions/revoke-others' && method === 'POST') {
      sessions = sessions.filter((item) => item.current);
      return route.fulfill({ status: 204 });
    }
    if (path.startsWith('/auth/sessions/') && method === 'DELETE') {
      const id = path.slice('/auth/sessions/'.length);
      const session = sessions.find((item) => item.id === id);
      if (!session) return error(404, 'not-found');
      sessions = sessions.filter((item) => item.id !== id);
      if (session.current) authenticated = false;
      return route.fulfill({ status: 204 });
    }
    if (path === '/auth/registration-policy')
      return reply({ enabled: registrationSettings.enabled });
    if (path === '/system/registration' && method === 'GET')
      return reply({ settings: registrationSettings });
    if (path === '/system/registration' && method === 'PATCH') {
      const parsed = registrationSettingsInputSchema.safeParse(body);
      if (!parsed.success) return error(422, 'validation');
      if (policyConflict) {
        policyConflict = false;
        registrationSettings = {
          ...registrationSettings,
          version: registrationSettings.version + 1,
        };
        return error(409, 'conflict', 'stale-version');
      }
      if (parsed.data.version !== registrationSettings.version)
        return error(409, 'conflict', 'stale-version');
      if (parsed.data.defaultRoleId !== 'viewer') return error(422, 'validation');
      registrationSettings = {
        ...parsed.data,
        version: registrationSettings.version + 1,
        updatedAt: date,
      };
      record('settings.update', 'registration-policy', 'Registration policy');
      return reply({ settings: registrationSettings });
    }
    if (path === '/me' && method === 'GET') return reply({ user: admin });
    if (path === '/roles' && method === 'GET')
      return reply({
        items:
          url.searchParams.get('include') === 'memberCount'
            ? roles.map((role) => ({
                ...role,
                memberCount: users.filter((user) => user.roleIds.includes(role.id)).length,
              }))
            : roles,
      });
    if (path === '/roles' && method === 'POST') {
      const parsed = roleInputSchema.safeParse(body);
      if (!parsed.success) return error(422, 'validation');
      const role: DirectoryRole = {
        ...parsed.data,
        id: `custom-${++nextId}`,
        protected: false,
        version: 1,
        createdAt: date,
        updatedAt: date,
      };
      roles.push(role);
      record('roles.create', role.id, role.name);
      return reply({ role }, 201);
    }
    const roleId = /^\/roles\/([^/]+)$/.exec(path)?.[1];
    if (roleId) {
      const role = roles.find((item) => item.id === decodeURIComponent(roleId));
      if (!role) return error(404, 'not-found');
      if (method === 'GET') return reply({ role });
      if (method === 'PATCH') {
        const parsed = updateRoleSchema.safeParse(body);
        if (!parsed.success) return error(422, 'validation');
        if (role.protected) return error(409, 'conflict', 'protected-role');
        if (parsed.data.version !== role.version) return error(409, 'conflict', 'stale-version');
        Object.assign(role, parsed.data, { version: role.version + 1 });
        record('roles.update', role.id, role.name);
        return reply({ role });
      }
    }
    if (path === '/users' && method === 'GET') {
      const parsed = userQuerySchema.safeParse({
        q: url.searchParams.get('q'),
        status: url.searchParams.get('status'),
        roleId: url.searchParams.get('roleId'),
        sort: url.searchParams.get('sort'),
        direction: url.searchParams.get('direction'),
        page: Number(url.searchParams.get('page')),
        pageSize: Number(url.searchParams.get('pageSize')),
      });
      if (!parsed.success) return error(422, 'validation');
      const query = parsed.data;
      const items = users.filter(
        (user) =>
          (!query.q ||
            `${user.name} ${user.email}`.toLowerCase().includes(query.q.toLowerCase())) &&
          (query.status === 'all' || query.status === user.status) &&
          (query.roleId === 'all' || user.roleIds.includes(query.roleId)),
      );
      const start = (query.page - 1) * query.pageSize;
      return reply({
        items: items.slice(start, start + query.pageSize),
        total: items.length,
        page: query.page,
        pageSize: query.pageSize,
      });
    }
    if (path === '/users/batch-status' && method === 'POST') {
      const parsed = batchStatusInputSchema.safeParse(body);
      if (!parsed.success) return error(422, 'validation');
      return reply({
        items: parsed.data.items.map((item) => {
          const user = users.find((user) => user.id === item.id);
          if (!user) return { id: item.id, success: false, code: 'not-found' };
          if (user.id === admin.id && parsed.data.status === 'disabled')
            return { id: item.id, success: false, code: 'conflict', reason: 'protected-user' };
          if (user.version !== item.version)
            return { id: item.id, success: false, code: 'conflict', reason: 'stale-version' };
          user.status = parsed.data.status;
          user.version += 1;
          record('users.status', user.id, user.name);
          return { id: item.id, success: true, user: { ...user } };
        }),
      });
    }
    const memberMatch = /^\/roles\/([^/]+)\/members(?:\/([^/]+))?$/.exec(path);
    if (memberMatch?.[1]) {
      const roleId = memberMatch[1];
      if (!roles.some((role) => role.id === roleId)) return error(404, 'not-found');
      if (method === 'GET') {
        const page = Number(url.searchParams.get('page')),
          pageSize = Number(url.searchParams.get('pageSize'));
        const items = users.filter((user) => user.roleIds.includes(roleId));
        return reply({
          items: items.slice((page - 1) * pageSize, page * pageSize),
          total: items.length,
          page,
          pageSize,
        });
      }
      if (
        typeof body !== 'object' ||
        body === null ||
        !('version' in body) ||
        typeof body.version !== 'number'
      )
        return error(422, 'validation');
      const targetId = 'userId' in body ? body.userId : memberMatch[2];
      const user = users.find((user) => user.id === targetId);
      if (!user) return error(404, 'not-found');
      if (user.id === admin.id) return error(409, 'conflict', 'protected-user');
      if (user.version !== body.version) return error(409, 'conflict', 'stale-version');
      const roleIds =
        method === 'POST'
          ? [...new Set([...user.roleIds, roleId])]
          : user.roleIds.filter((id) => id !== roleId);
      if (!roleIds.length) return error(422, 'validation');
      user.roleIds = roleIds;
      user.version += 1;
      record('users.roles', user.id, user.name);
      return reply({ user });
    }
    if (path === '/users' && method === 'POST') {
      const parsed = createUserSchema.safeParse(body);
      if (!parsed.success) return error(422, 'validation');
      const { name, email, roleIds, status } = parsed.data;
      const user: DirectoryUser = {
        name,
        email,
        roleIds,
        status,
        id: `user-${++nextId}`,
        version: 1,
        createdAt: date,
        updatedAt: date,
      };
      users.push(user);
      record('users.create', user.id, user.name);
      return reply({ user }, 201);
    }
    const userId = /^\/users\/([^/]+)$/.exec(path)?.[1];
    const user = path === '/me' ? admin : users.find((item) => item.id === userId);
    if (user && method === 'GET') return reply({ user });
    if (user && method === 'PATCH') {
      const parsed = updateUserSchema.safeParse(body);
      if (!parsed.success) return error(422, 'validation');
      if (conflict) {
        conflict = false;
        user.version += 1;
        user.name = 'Server profile';
        return error(409, 'conflict', 'stale-version');
      }
      if (user.version !== parsed.data.version) return error(409, 'conflict', 'stale-version');
      Object.assign(user, parsed.data, { version: user.version + 1 });
      record(path === '/me' ? 'account.update' : 'users.update', user.id, user.name);
      return reply({ user });
    }
    if (path === '/notifications' && method === 'GET') {
      if (!url.searchParams.has('page')) return reply({ items: notifications });
      const parsed = productInboxQuerySchema.safeParse({
        ...Object.fromEntries(url.searchParams),
        page: Number(url.searchParams.get('page')),
        pageSize: Number(url.searchParams.get('pageSize')),
      });
      if (!parsed.success) return error(422, 'validation');
      const query = parsed.data;
      const items = notifications.filter(
        (item) =>
          (!query.q ||
            `${item.objectName} ${item.operation}`.toLowerCase().includes(query.q.toLowerCase())) &&
          (query.category === 'all' || item.category === query.category) &&
          (query.read === 'all' || item.read === (query.read === 'read')),
      );
      return reply({
        items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: items.length,
        unread: notifications.filter((item) => !item.read).length,
        page: query.page,
        pageSize: query.pageSize,
      });
    }
    if (path === '/notifications/read-all' && method === 'PATCH') {
      notifications.forEach((item) => {
        item.read = true;
      });
      return route.fulfill({ status: 204 });
    }
    if (path.startsWith('/notifications/') && method === 'GET') {
      const item = notifications.find((item) => item.id === path.slice('/notifications/'.length));
      return item ? reply({ item }) : error(404, 'not-found');
    }
    if (path === '/notifications/read' && method === 'PATCH') {
      const parsed = readNotificationsSchema.safeParse(body);
      if (!parsed.success) return error(422, 'validation');
      if (parsed.data.ids.some((id) => !notifications.some((item) => item.id === id)))
        return error(404, 'not-found');
      notifications.forEach((item) => {
        if (parsed.data.ids.includes(item.id)) item.read = true;
      });
      return route.fulfill({ status: 204 });
    }
    if (path === '/audit-logs' && method === 'GET') {
      const parsed = auditQuerySchema.safeParse({
        q: url.searchParams.get('q'),
        actor: url.searchParams.get('actor') ?? '',
        object: url.searchParams.get('object') ?? '',
        from: url.searchParams.get('from') ?? '',
        to: url.searchParams.get('to') ?? '',
        operation: url.searchParams.get('operation'),
        result: url.searchParams.get('result'),
        page: Number(url.searchParams.get('page')),
        pageSize: Number(url.searchParams.get('pageSize')),
      });
      if (!parsed.success) return error(422, 'validation');
      const query = parsed.data;
      const items = audit.filter(
        (item) =>
          (!query.q ||
            `${item.actorName} ${item.objectName}`.toLowerCase().includes(query.q.toLowerCase())) &&
          (query.operation === 'all' || item.operation === query.operation) &&
          (query.result === 'all' || item.result === query.result) &&
          (!query.actor || item.actorName.includes(query.actor)) &&
          (!query.object || item.objectName.includes(query.object)) &&
          (!query.from || Date.parse(item.createdAt) >= Date.parse(query.from)) &&
          (!query.to || Date.parse(item.createdAt) <= Date.parse(query.to)),
      );
      const start = (query.page - 1) * query.pageSize;
      return reply({
        items: items.slice(start, start + query.pageSize),
        total: items.length,
        page: query.page,
        pageSize: query.pageSize,
      });
    }
    const auditId = /^\/audit-logs\/([^/]+)$/.exec(path)?.[1];
    if (auditId && method === 'GET') {
      const record = audit.find((item) => item.id === auditId);
      return record ? reply({ record }) : error(404, 'not-found');
    }
    return error(404, 'not-found');
  });
  return {
    writes,
    rejectNextProfileWrite: () => {
      conflict = true;
    },
    rejectNextPolicyWrite: () => {
      policyConflict = true;
    },
  };
}
