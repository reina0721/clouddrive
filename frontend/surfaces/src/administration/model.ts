import { z } from 'zod';

const id = z.string().min(1).max(100);
export const organizationItemSchema = z.object({
  leader: z.string().optional(),
  remark: z.string().optional(),
  memberCount: z.number().optional(),
  id,
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
  archived: z.boolean(),
  version: z.number().int().positive(),
  parentId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OrganizationItem = z.infer<typeof organizationItemSchema>;
export type OrganizationKind = 'departments' | 'positions';
export type OrganizationDraft = {
  code: string;
  name: string;
  leader?: string;
  remark?: string;
  parentId?: string;
  active?: boolean;
  archived?: boolean;
};
export const assignmentSchema = z.object({
  accountId: id,
  departmentId: z.string().nullable().optional(),
  positionIds: z.array(id),
  version: z.number().int().nonnegative(),
});
export type Assignment = z.infer<typeof assignmentSchema>;
export const menuSchema = z.object({
  id,
  label: z.string().default(''),
  permission: z.string().default(''),
  moduleId: z.string(),
  routeId: z.string(),
  titleMessageId: z.string(),
  iconId: z.string(),
  defaultParentId: z.string(),
  defaultOrder: z.number(),
  enabled: z.boolean(),
  parentId: z.string(),
  order: z.number(),
  version: z.number().int().nonnegative(),
  overridden: z.boolean(),
  parentOverridden: z.boolean(),
  orderOverridden: z.boolean(),
});
export type MenuItem = z.infer<typeof menuSchema>;
export const dictionarySchema = z.object({
  id,
  name: z.string(),
  code: z.string(),
  status: z.enum(['active', 'disabled']),
  remark: z.string(),
  updatedAt: z.number(),
  version: z.number().int().positive(),
});
export type Dictionary = z.infer<typeof dictionarySchema>;
export const dictionaryItemSchema = z.object({
  id,
  typeId: id,
  label: z.string(),
  value: z.string(),
  order: z.number(),
  status: z.enum(['active', 'disabled']),
  tone: z.enum(['default', 'primary', 'success', 'warning', 'danger']),
  version: z.number().int().positive(),
});
export type DictionaryItem = z.infer<typeof dictionaryItemSchema>;
export type DictionaryDraft = Omit<Dictionary, 'id' | 'version' | 'updatedAt'>;
export type DictionaryItemDraft = Omit<DictionaryItem, 'id' | 'typeId' | 'version'>;
export const dictionariesSchema = z.object({
  types: z.array(dictionarySchema),
  items: z.array(dictionaryItemSchema),
});
export type Dictionaries = z.infer<typeof dictionariesSchema>;
export const todoSchema = z.object({
  id,
  title: z.string(),
  status: z.enum(['pending', 'completed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});
export type Todo = z.infer<typeof todoSchema>;
export const dashboardSchema = z.object({
  users: z.number().nullable(),
  roles: z.number().nullable(),
  dailyOperations: z.array(z.object({ time: z.number(), count: z.number() })),
  generatedAt: z.string(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export const tokenSchema = z.object({
  version: z.number().int().positive(),
  id,
  name: z.string(),
  description: z.string().optional(),
  scopes: z.array(z.string()),
  status: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  secret: z.string().optional(),
});
export type AccessToken = z.infer<typeof tokenSchema>;
export const permissionSchema = z.object({
  key: z.string(),
  ownerModuleId: z.string(),
  descriptionMessageId: z.string(),
  risk: z.enum(['standard', 'elevated', 'critical']),
});
export type Permission = z.infer<typeof permissionSchema>;
export const runtimeMetadataSchema = z.object({
  configuration: z.array(z.object({ name: z.string(), value: z.string() })),
  capabilities: z.array(z.string()),
});
export const securityAuditPageSchema = z.object({
  items: z.array(
    z.object({
      eventId: z.union([z.string().min(1), z.number().int().positive()]).transform(String),
      operation: z.string(),
      decision: z.string(),
      outcome: z.string(),
      occurredAt: z.string(),
    }),
  ),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});
export type SecurityAuditPage = z.infer<typeof securityAuditPageSchema>;
export type RuntimeStatus = {
  configuration: readonly { name: string; value: string }[];
  capabilities: readonly string[];
  readiness: string;
  liveness: string;
  build: string;
  diagnostics: readonly { name: string; state: string }[];
  metrics: string;
};

export const profileSchema = z.object({
  nickname: z.string().max(64),
  bio: z.string().max(2048),
  birthDate: z.string().max(16),
  version: z.number().int().positive(),
});
export type AccountProfile = z.infer<typeof profileSchema>;

export const accountPreferencesSchema = z.object({
  version: z.number().int().nonnegative(),
  language: z.enum(['zh-CN', 'en-US']),
  timeZone: z.string().default(''),
  themeMode: z.enum(['system', 'light', 'dark']),
  themePreset: z.enum(['blue', 'cyan', 'green', 'violet', 'orange']),
  density: z.enum(['comfortable', 'compact']),
  reduceMotion: z.boolean(),
  notifications: z.object({
    emailDigest: z.boolean(),
    inApp: z.boolean(),
    showSummaries: z.boolean(),
    dailySummary: z.boolean(),
  }),
});
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;
export interface AdministrationPort {
  preferences(): Promise<AccountPreferences>;
  savePreferences(value: AccountPreferences): Promise<AccountPreferences>;
  profile(): Promise<AccountProfile>;
  saveProfile(value: AccountProfile): Promise<void>;
  organization(kind: OrganizationKind): Promise<readonly OrganizationItem[]>;
  saveOrganization(
    kind: OrganizationKind,
    draft: OrganizationDraft,
    existing?: OrganizationItem,
  ): Promise<void>;
  assignment(accountId: string): Promise<Assignment>;
  assign(value: Assignment): Promise<void>;
  menus(): Promise<readonly MenuItem[]>;
  saveMenu(value: MenuItem): Promise<void>;
  dictionaries(): Promise<Dictionaries>;
  saveDictionary(value: DictionaryDraft, existing?: Dictionary): Promise<Dictionaries>;
  removeDictionary(value: Dictionary): Promise<Dictionaries>;
  saveDictionaryItem(
    typeId: string,
    value: DictionaryItemDraft,
    existing?: DictionaryItem,
  ): Promise<Dictionaries>;
  removeDictionaryItem(value: DictionaryItem): Promise<Dictionaries>;
  todos(): Promise<readonly Todo[]>;
  createTodo(title: string): Promise<void>;
  completeTodo(id: string): Promise<void>;
  dashboard(): Promise<Dashboard>;
  mfaStatus(): Promise<boolean>;
  beginMfa(): Promise<{ secret: string; uri: string }>;
  confirmMfa(code: string): Promise<readonly string[]>;
  disableMfa(code: string): Promise<void>;
  tokens(): Promise<readonly AccessToken[]>;
  createToken(
    name: string,
    scopes: readonly string[],
    description?: string,
    expiresAt?: string,
  ): Promise<AccessToken>;
  updateToken(value: AccessToken): Promise<void>;
  tokenAction(
    id: string,
    action: 'enable' | 'disable' | 'revoke' | 'rotate',
    version: number,
  ): Promise<AccessToken | null>;
  permissions(): Promise<readonly Permission[]>;
  archiveAccount(id: string, version: number): Promise<void>;
  resetPassword(id: string, password: string, version: number): Promise<void>;
  beginArchive(): Promise<string>;
  confirmArchive(confirmationId: string): Promise<void>;
  runtime(): Promise<RuntimeStatus>;
  securityAudit(cursor: string): Promise<SecurityAuditPage>;
  endSession(): void;
  rolePermissions(
    id: string,
  ): Promise<{ roleId: string; roleVersion: number; permissionKeys: string[] }>;
  replaceRolePermissions(value: {
    roleId: string;
    roleVersion: number;
    permissionKeys: string[];
  }): Promise<void>;
}
