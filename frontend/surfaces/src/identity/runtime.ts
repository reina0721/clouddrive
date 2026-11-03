/** Render-time product contract. Validation stays in the data adapters and feature schemas. */
export { IdentityProvider, useIdentityPort } from './context';
export { IdentityError, identityErrorCodes } from './errors';
export type { IdentityErrorCode, IdentityErrorReason, IdentityFieldIssue } from './errors';
export type * from './model';
export { permissionCodes, auditOperations, defaultUserQuery, defaultAuditQuery } from './constants';
export { registrationRestrictedPermissions } from './constants';
export { useProductAccess } from './use-access';
export { useProductInbox } from './use-inbox';
export { AccountSecurityProvider, useAccountSecurityPort } from './account-security';
export type { AccountSecurityPort, AccountSession } from './account-security';
