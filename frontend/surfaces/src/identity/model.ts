import { z } from 'zod';
import { permissionCodes, auditOperations } from './constants';
export {
  permissionCodes,
  auditOperations,
  defaultUserQuery,
  defaultAuditQuery,
  registrationRestrictedPermissions,
} from './constants';
import { IdentityError, identityErrorCodes } from './errors';
export { IdentityError, identityErrorCodes } from './errors';
export type { IdentityErrorCode, IdentityFieldIssue, IdentityErrorReason } from './errors';

export type IdentityPermission = (typeof permissionCodes)[number];
export const identifierSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
export const nameSchema = z.string().trim().min(1).max(80);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const roleIdsSchema = z
  .array(identifierSchema)
  .min(1)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length);
export const userStatusSchema = z.enum(['active', 'disabled']);
export const userSchema = z
  .object({
    id: identifierSchema,
    name: nameSchema,
    email: emailSchema,
    status: userStatusSchema,
    roleIds: roleIdsSchema,
    version: z.number().int().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type DirectoryUser = z.infer<typeof userSchema>;
export const roleSchema = z
  .object({
    id: identifierSchema,
    name: z.string().min(1).max(80),
    permissions: z
      .array(z.enum(permissionCodes))
      .max(permissionCodes.length)
      .refine((items) => new Set(items).size === items.length),
    protected: z.boolean(),
    version: z.number().int().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type DirectoryRole = z.infer<typeof roleSchema>;
export const accessSchema = z
  .object({
    nativePermissions: z.array(z.string()).optional(),
    user: userSchema,
    permissions: z
      .array(z.enum(permissionCodes))
      .max(permissionCodes.length)
      .refine((items) => new Set(items).size === items.length),
  })
  .strict();
export type IdentityAccess = z.infer<typeof accessSchema>;
export const userQuerySchema = z
  .object({
    q: z.string().trim().max(100),
    status: z.enum(['all', 'active', 'disabled']),
    roleId: z.union([z.literal('all'), identifierSchema]),
    sort: z.enum(['name', 'email', 'createdAt']),
    direction: z.enum(['asc', 'desc']),
    page: z.number().int().min(1).max(100000),
    pageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  })
  .strict();
export type UserQuery = z.infer<typeof userQuerySchema>;

export const userPageSchema = z
  .object({
    items: z.array(userSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
  .strict();
export type UserPage = z.infer<typeof userPageSchema>;
export const createUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: z.string().min(15).max(128),
    roleIds: roleIdsSchema,
    status: userStatusSchema,
  })
  .strict();
export type CreateUserInput = z.infer<typeof createUserSchema>;
export const updateUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    version: z.number().int().positive(),
  })
  .strict();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export const userResponseSchema = z.object({ user: userSchema }).strict();
export const rolePageSchema = z
  .object({
    items: z
      .array(roleSchema)
      .refine((items) => new Set(items.map((role) => role.id)).size === items.length),
  })
  .strict();
export const fieldIssueSchema = z
  .object({
    field: z.enum([
      'name',
      'email',
      'password',
      'roleIds',
      'permissions',
      'status',
      'version',
      'query',
      'defaultRoleId',
      'enabled',
    ]),
    reason: z.enum(['required', 'format', 'length', 'duplicate', 'protected', 'stale', 'unknown']),
  })
  .strict();
export const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.enum(identityErrorCodes),
        reason: z
          .enum([
            'duplicate-email',
            'duplicate-role',
            'stale-version',
            'protected-user',
            'protected-role',
            'last-administrator',
          ])
          .optional(),
        fields: z.array(fieldIssueSchema).optional(),
        requestId: z.string().max(128).optional(),
      })
      .strict(),
  })
  .strict();
export function parseIdentity<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new IdentityError('protocol');
  return result.data;
}

/** Shared product language model, not HTTP, storage, session or authorization runtime. */
export interface IdentityPort {
  readonly mode: 'mock' | 'backend';
  currentUserId(): string | null;
  getRevision(): number;
  subscribe(listener: () => void): () => void;
  access(): Promise<IdentityAccess>;
  registrationSettings(): Promise<RegistrationSettings>;
  updateRegistrationSettings(input: RegistrationSettingsInput): Promise<RegistrationSettings>;
  roles(selfOnly?: boolean): Promise<readonly DirectoryRole[]>;
  readRole(id: string): Promise<DirectoryRole>;
  createRole(input: RoleInput): Promise<DirectoryRole>;
  updateRole(id: string, input: RoleInput & { version: number }): Promise<DirectoryRole>;
  inbox(): Promise<readonly ProductNotification[]>;
  readNotifications(ids: readonly string[]): Promise<void>;
  audit(query: AuditQuery): Promise<AuditPage>;
  readAudit(id: string): Promise<AuditRecord>;
  list(query: UserQuery): Promise<UserPage>;
  read(id: string): Promise<DirectoryUser>;
  create(input: CreateUserInput): Promise<DirectoryUser>;
  update(id: string, input: UpdateUserInput): Promise<DirectoryUser>;
  setStatus(id: string, version: number, status: DirectoryUser['status']): Promise<DirectoryUser>;
  setRoles(id: string, version: number, roleIds: readonly string[]): Promise<DirectoryUser>;
  batchStatus(input: BatchStatusInput): Promise<BatchStatusResult>;
  roleSummaries(): Promise<readonly RoleSummary[]>;
  roleMembers(id: string, query: UserQuery): Promise<UserPage>;
  changeRoleMember(
    roleId: string,
    userId: string,
    version: number,
    add: boolean,
  ): Promise<DirectoryUser>;
  inboxPage(query: ProductInboxQuery): Promise<ProductInboxPage>;
  readNotification(id: string): Promise<ProductNotification>;
  readAllNotifications(): Promise<void>;
  me(): Promise<DirectoryUser>;
  updateMe(input: UpdateUserInput): Promise<DirectoryUser>;
}

export const roleInputSchema = z
  .object({
    name: nameSchema,
    permissions: z
      .array(z.enum(permissionCodes))
      .max(permissionCodes.length)
      .refine((items) => new Set(items).size === items.length),
  })
  .strict();
export type RoleInput = z.infer<typeof roleInputSchema>;
export const updateRoleSchema = roleInputSchema.extend({ version: z.number().int().positive() });
export const registrationSettingsSchema = z
  .object({
    enabled: z.boolean(),
    defaultRoleId: z.union([z.literal(''), identifierSchema]),
    version: z.number().int().positive(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const registrationSettingsInputSchema = registrationSettingsSchema.omit({ updatedAt: true });
export const registrationSettingsResponseSchema = z
  .object({ settings: registrationSettingsSchema })
  .strict();
export type RegistrationSettings = z.infer<typeof registrationSettingsSchema>;
export type RegistrationSettingsInput = z.infer<typeof registrationSettingsInputSchema>;
export const roleResponseSchema = z.object({ role: roleSchema }).strict();

export const auditRecordSchema = z
  .object({
    id: identifierSchema,
    actorId: identifierSchema,
    actorName: nameSchema,
    objectId: identifierSchema,
    objectName: nameSchema,
    operation: z.enum(auditOperations),
    createdAt: z.string().datetime(),
    result: z.enum(['success', 'failure']),
    errorCode: z.enum(identityErrorCodes).optional(),
  })
  .strict();
export type AuditRecord = z.infer<typeof auditRecordSchema>;
export const auditQuerySchema = z
  .object({
    q: z.string().trim().max(100),
    operation: z.union([z.literal('all'), z.enum(auditOperations)]),
    result: z.enum(['all', 'success', 'failure']),
    page: z.number().int().min(1).max(100000),
    pageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]),
    actor: z.string().trim().max(100).optional(),
    object: z.string().trim().max(100).optional(),
    from: z.union([z.literal(''), z.string().datetime()]).optional(),
    to: z.union([z.literal(''), z.string().datetime()]).optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || Date.parse(query.from) <= Date.parse(query.to));
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const auditPageSchema = z
  .object({
    items: z.array(auditRecordSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
  .strict();
export type AuditPage = z.infer<typeof auditPageSchema>;
export const auditResponseSchema = z.object({ record: auditRecordSchema }).strict();
export const productNotificationSchema = z
  .object({
    id: identifierSchema,
    ownerId: identifierSchema,
    operation: z.enum(auditOperations),
    objectId: identifierSchema,
    objectName: nameSchema,
    category: z.enum(['success', 'failure', 'system', 'task', 'warning']),
    createdAt: z.string().datetime(),
    read: z.boolean(),
  })
  .strict();
export type ProductNotification = z.infer<typeof productNotificationSchema>;
export const inboxSchema = z
  .object({
    total: z.number().int().nonnegative().optional(),
    unread: z.number().int().nonnegative().optional(),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional(),
    items: z
      .array(productNotificationSchema)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  })
  .strict();
export const readNotificationsSchema = z
  .object({
    ids: z
      .array(identifierSchema)
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();

export const batchStatusInputSchema = z
  .object({
    status: userStatusSchema,
    items: z
      .array(z.object({ id: identifierSchema, version: z.number().int().positive() }).strict())
      .min(1)
      .max(200)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  })
  .strict();
export type BatchStatusInput = z.infer<typeof batchStatusInputSchema>;
export const batchStatusResultSchema = z
  .object({
    items: z
      .array(
        z.discriminatedUnion('success', [
          z.object({ id: identifierSchema, success: z.literal(true), user: userSchema }).strict(),
          z
            .object({
              id: identifierSchema,
              success: z.literal(false),
              code: z.enum(identityErrorCodes),
              reason: z.enum(['stale-version', 'protected-user', 'last-administrator']).optional(),
            })
            .strict(),
        ]),
      )
      .max(200),
  })
  .strict();
export type BatchStatusResult = z.infer<typeof batchStatusResultSchema>;
export const roleSummarySchema = roleSchema.extend({ memberCount: z.number().int().nonnegative() });
export type RoleSummary = z.infer<typeof roleSummarySchema>;
export const roleSummariesSchema = z.object({ items: z.array(roleSummarySchema) }).strict();
export const productInboxQuerySchema = z
  .object({
    q: z.string().trim().max(100),
    category: z.enum(['all', 'success', 'failure', 'system', 'task', 'warning']),
    read: z.enum(['all', 'read', 'unread']),
    page: z.number().int().min(1).max(100000),
    pageSize: z.union([z.literal(10), z.literal(20), z.literal(50)]),
  })
  .strict();
export type ProductInboxQuery = z.infer<typeof productInboxQuerySchema>;
export const productInboxPageSchema = z
  .object({
    items: z.array(productNotificationSchema),
    total: z.number().int().nonnegative(),
    unread: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
  .strict();
export type ProductInboxPage = z.infer<typeof productInboxPageSchema>;
export const notificationResponseSchema = z.object({ item: productNotificationSchema }).strict();
