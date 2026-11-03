import type { UserQuery, AuditQuery } from './model';
export const registrationRestrictedPermissions = [
  'users.roles',
  'roles.create',
  'roles.update',
  'settings.update',
] as const;

export const permissionCodes = [
  'users.read',
  'users.create',
  'users.update',
  'users.status',
  'users.roles',
  'account.update',
  'roles.read',
  'roles.create',
  'roles.update',
  'audit.read',
  'settings.read',
  'settings.update',
] as const;

export const defaultUserQuery: UserQuery = {
  q: '',
  status: 'all',
  roleId: 'all',
  sort: 'name',
  direction: 'asc',
  page: 1,
  pageSize: 20,
};

export const auditOperations = [
  'workbench.task',
  'account.password',
  'account.sessions',
  'users.create',
  'users.update',
  'users.status',
  'users.roles',
  'account.update',
  'roles.create',
  'roles.update',
  'settings.update',
] as const;

export const defaultAuditQuery: AuditQuery = {
  q: '',
  operation: 'all',
  result: 'all',
  page: 1,
  pageSize: 20,
};
