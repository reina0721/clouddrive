/** Product failure semantics are usable by the shell without loading data validation schemas. */
export const identityErrorCodes = [
  'configuration',
  'unauthenticated',
  'forbidden',
  'not-found',
  'conflict',
  'validation',
  'network',
  'timeout',
  'protocol',
  'unavailable',
  'persistence',
] as const;
export type IdentityErrorCode = (typeof identityErrorCodes)[number];
export type IdentityFieldIssue = Readonly<{
  field:
    | 'name'
    | 'email'
    | 'password'
    | 'roleIds'
    | 'permissions'
    | 'status'
    | 'version'
    | 'query'
    | 'defaultRoleId'
    | 'enabled';
  reason: 'required' | 'format' | 'length' | 'duplicate' | 'protected' | 'stale' | 'unknown';
}>;
export type IdentityErrorReason =
  | 'duplicate-email'
  | 'duplicate-role'
  | 'stale-version'
  | 'protected-user'
  | 'protected-role'
  | 'last-administrator';
export class IdentityError extends Error {
  constructor(
    public readonly code: IdentityErrorCode,
    public readonly reason?: IdentityErrorReason,
    public readonly fields: readonly IdentityFieldIssue[] = [],
    public readonly requestId?: string,
  ) {
    super(`Identity: ${code}`);
    this.name = 'IdentityError';
  }
}
