import { registerHooks, createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.')) {
        const url = new URL(specifier + '.ts', context.parentURL);
        if (existsSync(fileURLToPath(url))) return next(url.href, context);
      }
      throw error;
    }
  },
});
const require = createRequire(new URL('../surfaces/package.json', import.meta.url));
const { z } = require('zod');
const identity = await import('../surfaces/src/identity/model.ts');
const security = await import('../surfaces/src/identity/security-schema.ts');
const admin = await import('../surfaces/src/administration/model.ts');
const site = await import('../surfaces/src/administration/site-profile.ts');
const str = z.string(),
  version = z.number().int().nonnegative(),
  id = str.min(1),
  empty = z.object({}).strict();
const session = z.object({
  user: z.object({ id, name: str, email: str }),
  expiresAt: z.number(),
  sessionId: str,
  mustChangePassword: z.boolean(),
});
const login = z.union([
  z.object({ email: str, password: str, code: str.optional() }).strict(),
  z.object({ challengeId: id, code: id }).strict(),
]);
const auth = z.union([session, z.object({ mfaRequired: z.literal(true), challengeId: id })]);
const kv = z.object({
  id,
  key: str,
  value: str,
  enabled: z.boolean(),
  description: str.optional(),
});
const request = z.object({
  id,
  collectionId: id,
  name: str,
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url: str,
  params: z.array(kv),
  headers: z.array(kv),
  auth: z.record(str, z.unknown()),
  body: z.record(str, z.unknown()),
  disguise: z.object({
    timeoutMs: z.number(),
    userAgent: str.optional(),
    proxy: str.optional(),
    fingerprint: str.optional(),
  }),
  extractors: z.array(z.record(str, z.unknown())),
  preScript: str,
  postScript: str,
});
const task = z.object({
  id,
  name: str,
  targetCollectionId: id,
  cronOrInterval: str,
  enabled: z.boolean(),
  version: version.optional(),
  lastRun: z.object({ time: str, passed: z.boolean(), message: str }).optional(),
});
const taskResponse = task.extend({ version: version.positive() });
const workspace = z.object({
  version: z.literal(1),
  projects: z.array(z.object({ id, name: str })),
  collections: z.array(z.object({ id, projectId: id, name: str })),
  requests: z.array(request),
  environments: z.array(z.object({ id, name: str, variables: z.array(kv) })),
  globals: z.array(kv),
  activeEnvironmentId: str.optional(),
  tasks: z.array(task),
  history: z.array(z.record(str, z.unknown())),
});
const resolved = z.object({
  method: str,
  url: str,
  headers: z.record(str, str),
  body: str.optional(),
  timeoutMs: z.number(),
  disguise: request.shape.disguise.optional(),
});
const execution = z.union([
  z.object({
    ok: z.literal(true),
    response: z.object({
      status: z.number(),
      statusText: str,
      durationMs: z.number(),
      sizeBytes: z.number(),
      headers: z.array(z.tuple([str, str])),
      body: str,
    }),
  }),
  z.object({
    ok: z.literal(false),
    failure: z.object({
      kind: z.enum(['network', 'cors', 'timeout', 'aborted', 'invalid-url', 'unsupported']),
      message: str,
    }),
  }),
]);
const operations = [];
function add(method, path, input, output, permission = '', code = 200, query) {
  operations.push({ method, path, input, output, permission, code, query });
}
add('GET', '/auth/csrf', null, z.object({ token: id }));
add('GET', '/auth/registration-policy', null, z.object({ enabled: z.boolean() }));
add('GET', '/site-profile', null, site.siteProfileSchema);
add(
  'POST',
  '/auth/setup',
  z.object({ name: str, email: str, password: str, setupToken: str }).strict(),
  session,
);
add('POST', '/auth/login', login, auth);
add('POST', '/auth/register', z.object({ name: str, email: str, password: str }).strict(), session);
add('POST', '/auth/logout', z.object({ logout: z.boolean().optional() }).strict(), null, '', 204);
add('GET', '/auth/session', null, session);
add(
  'POST',
  '/auth/password/verify',
  z.object({ password: str.min(1).max(128) }).strict(),
  z.object({ verified: z.literal(true) }),
);
add('GET', '/auth/access', null, identity.accessSchema);
add(
  'POST',
  '/auth/password',
  security.changePasswordSchema,
  null,
  'iam:account:self:password:write',
  204,
);
add('GET', '/auth/sessions', null, security.accountSessionsSchema);
add('DELETE', '/auth/sessions/{id}', empty, null, '', 204);
add('POST', '/auth/sessions/revoke-others', empty, null, '', 204);
add(
  'GET',
  '/users',
  null,
  identity.userPageSchema,
  'iam:account:read',
  200,
  identity.userQuerySchema,
);
add('POST', '/users', identity.createUserSchema, identity.userResponseSchema, 'iam:account:write');
add('GET', '/users/{id}', null, identity.userResponseSchema, 'iam:account:read');
add(
  'PATCH',
  '/users/{id}',
  identity.updateUserSchema,
  identity.userResponseSchema,
  'iam:account:write',
);
add(
  'PATCH',
  '/users/{id}/status',
  z.object({ version, status: identity.userStatusSchema }).strict(),
  identity.userResponseSchema,
  'iam:account:write',
);
add(
  'PATCH',
  '/users/{id}/roles',
  z.object({ version, roleIds: identity.roleIdsSchema }).strict(),
  identity.userResponseSchema,
  'iam:account:write',
);
add(
  'POST',
  '/users/batch-status',
  identity.batchStatusInputSchema,
  identity.batchStatusResultSchema,
  'iam:account:write',
);
add('GET', '/me', null, identity.userResponseSchema);
add(
  'PATCH',
  '/me',
  identity.updateUserSchema,
  identity.userResponseSchema,
  'iam:account:self:profile:write',
);
add(
  'GET',
  '/roles',
  null,
  z.union([identity.rolePageSchema, identity.roleSummariesSchema]),
  'iam:role:read',
);
add('POST', '/roles', identity.roleInputSchema, identity.roleResponseSchema, 'iam:role:write');
add('GET', '/roles/{id}', null, identity.roleResponseSchema, 'iam:role:read');
add(
  'PATCH',
  '/roles/{id}',
  identity.updateRoleSchema,
  identity.roleResponseSchema,
  'iam:role:write',
);
add(
  'GET',
  '/roles/{id}/members',
  null,
  identity.userPageSchema,
  'iam:account:read',
  200,
  identity.userQuerySchema,
);
add(
  'POST',
  '/roles/{id}/members',
  z.object({ userId: id, version }).strict(),
  identity.userResponseSchema,
  'iam:account:write',
);
add(
  'DELETE',
  '/roles/{id}/members/{userId}',
  z.object({ version }).strict(),
  identity.userResponseSchema,
  'iam:account:write',
);
add(
  'GET',
  '/system/registration',
  null,
  identity.registrationSettingsResponseSchema,
  'console:settings:read',
);
add(
  'PATCH',
  '/system/registration',
  identity.registrationSettingsInputSchema,
  identity.registrationSettingsResponseSchema,
  'console:settings:write',
);
add('GET', '/system/site-profile', null, site.siteProfileManagementSchema, 'console:settings:read');
add(
  'PUT',
  '/system/site-profile',
  site.siteProfileVersionSchema,
  site.siteProfileManagementSchema,
  'console:settings:write',
);
add(
  'GET',
  '/notifications',
  null,
  identity.productInboxPageSchema,
  '',
  200,
  identity.productInboxQuerySchema,
);
add('GET', '/notifications/{id}', null, identity.notificationResponseSchema);
add('PATCH', '/notifications/read', identity.readNotificationsSchema, null, '', 204);
add('PATCH', '/notifications/read-all', empty, null, '', 204);
add(
  'GET',
  '/audit-logs',
  null,
  identity.auditPageSchema,
  'auth:audit:read',
  200,
  identity.auditQuerySchema,
);
add('GET', '/audit-logs/{id}', null, identity.auditResponseSchema, 'auth:audit:read');
add(
  'GET',
  '/navigation',
  null,
  z.object({ items: z.array(admin.menuSchema), catalogRevision: str, navigationRevision: str }),
);
add('GET', '/dictionaries', null, admin.dictionariesSchema, 'console:dictionary:read');
add(
  'POST',
  '/dictionaries',
  admin.dictionarySchema.omit({ id: true, version: true, updatedAt: true }),
  admin.dictionariesSchema,
  'console:dictionary:write',
);
add(
  'PATCH',
  '/dictionaries/{id}',
  admin.dictionarySchema.omit({ id: true, updatedAt: true }),
  admin.dictionariesSchema,
  'console:dictionary:write',
);
add(
  'DELETE',
  '/dictionaries/{id}',
  z.object({ version }),
  admin.dictionariesSchema,
  'console:dictionary:write',
);
add(
  'POST',
  '/dictionaries/{id}/items',
  admin.dictionaryItemSchema.omit({ id: true, typeId: true, version: true }),
  admin.dictionariesSchema,
  'console:dictionary:write',
);
add(
  'PATCH',
  '/dictionary-items/{id}',
  admin.dictionaryItemSchema.omit({ id: true, typeId: true }),
  admin.dictionariesSchema,
  'console:dictionary:write',
);
add(
  'DELETE',
  '/dictionary-items/{id}',
  z.object({ version }),
  admin.dictionariesSchema,
  'console:dictionary:write',
);
add('GET', '/dashboard', null, admin.dashboardSchema);
add('GET', '/system/runtime', null, admin.runtimeMetadataSchema, 'management:read');
add(
  'GET',
  '/todos',
  null,
  z.object({
    items: z.array(admin.todoSchema),
    offset: z.number(),
    limit: z.number(),
    total: z.number(),
  }),
  'todos:read',
);
add('POST', '/todos', z.object({ title: str }), admin.todoSchema, 'todos:write');
add('PATCH', '/todos/{id}/complete', empty, admin.todoSchema, 'todos:write');
add(
  'GET',
  '/api-workbench/workspace',
  null,
  workspace.extend({ tasks: z.array(taskResponse) }),
  'console:workbench:read',
);
add('PUT', '/api-workbench/workspace', workspace, null, 'console:workbench:write', 204);
add('DELETE', '/api-workbench/workspace/history', empty, null, 'console:workbench:write', 204);
add(
  'GET',
  '/api-workbench/workspace/usage',
  null,
  z.object({ dbSizeFormatted: str, count: z.number() }),
  'console:workbench:read',
);
add('POST', '/api-workbench/execute', resolved, execution, 'console:workbench:execute');
add('GET', '/api-workbench/tasks', null, z.array(taskResponse), 'console:workbench:read');
add(
  'POST',
  '/api-workbench/tasks',
  task,
  null,
  'console:workbench:write + console:workbench:execute',
  204,
);
add(
  'DELETE',
  '/api-workbench/tasks/{id}',
  empty,
  null,
  'console:workbench:write + console:workbench:execute',
  204,
  z.object({ version }),
);
const native = JSON.parse(
  await readFile(new URL('../apps/web/src/generated/native-openapi.json', import.meta.url), 'utf8'),
);
const paths = {};
for (const [path, value] of Object.entries(native.paths))
  if (path.startsWith('/api/v1/'))
    paths['/api/console/v1/native' + path.slice('/api/v1'.length)] = value;
const jsonSchema = (schema) => {
  const result = z.toJSONSchema(schema, { target: 'openapi-3.0', unrepresentable: 'any' });
  delete result.$schema;
  return result;
};
for (const op of operations) {
  const parameters = [...op.path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
  if (op.query) {
    const schema = jsonSchema(op.query);
    for (const [name, value] of Object.entries(schema.properties ?? {}))
      parameters.push({ name, in: 'query', required: false, schema: value });
  }
  if (op.method !== 'GET') {
    parameters.push(
      { name: 'Origin', in: 'header', required: true, schema: { type: 'string' } },
      { name: 'X-CSRF-Token', in: 'header', required: true, schema: { type: 'string' } },
    );
  }
  if (
    (op.path === '/api-workbench/workspace' && op.method === 'PUT') ||
    op.path === '/api-workbench/workspace/history'
  )
    parameters.push({
      name: 'If-Match',
      in: 'header',
      required: true,
      schema: { type: 'string' },
      description: 'Quoted workspace version, initially "0"; stale versions return 409.',
    });
  const entry = {
    operationId:
      'console.' +
      op.method.toLowerCase() +
      '.' +
      op.path.replaceAll(/[{}]/g, '').replaceAll('/', '.'),
    security:
      op.path === '/site-profile' ||
      (op.path.startsWith('/auth/') &&
        ['csrf', 'login', 'setup', 'register', 'registration-policy'].includes(
          op.path.split('/').at(-1),
        ))
        ? []
        : [{ ConsoleCookie: [] }],
    parameters,
    responses: {
      [op.code]: {
        description: 'Success',
        ...(op.output
          ? { content: { 'application/json': { schema: jsonSchema(op.output) } } }
          : {}),
      },
      ...Object.fromEntries(
        [401, 403, 404, 409, 422, 500].map((code) => [
          code,
          {
            description: String(code),
            content: {
              'application/json': {
                schema: jsonSchema(
                  z.object({ error: z.object({ code: str, reason: str.optional() }) }),
                ),
              },
            },
          },
        ]),
      ),
    },
    ...(op.input
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: jsonSchema(op.input) } },
          },
        }
      : {}),
    'x-required-permission': op.permission || 'authenticated session',
  };
  const path = '/api/console/v1' + op.path;
  paths[path] ??= {};
  paths[path][op.method.toLowerCase()] = entry;
}
const output =
  JSON.stringify(
    {
      openapi: '3.0.3',
      info: {
        title: 'clouddrive console API',
        version: '1.0.0',
        description:
          'Generated from console-web response validators and native Huma contracts. Cookie credentials are never stored in browser persistent storage. Writes require Origin and console CSRF; native forwarding repeats native authorization.',
      },
      paths,
      components: {
        ...native.components,
        securitySchemes: {
          ...native.components.securitySchemes,
          ConsoleCookie: { type: 'apiKey', in: 'cookie', name: '__Host-clouddrive_iam_session' },
        },
      },
    },
    null,
    2,
  ) + '\n';
const file = new URL('../../api/console-openapi.json', import.meta.url);
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output) throw new Error('Console OpenAPI is stale');
} else await writeFile(file, output);
console.log(`Console OpenAPI: ${operations.length} console operations plus native projections.`);
