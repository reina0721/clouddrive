export type AuthUser = Readonly<{
  id: string;
  name: string;
  email: string;
}>;

export type AuthSession = Readonly<{
  user: AuthUser;
  expiresAt: number;
  sessionId?: string;
  mustChangePassword?: boolean;
}>;
export type LoginInput = Readonly<{ email: string; password: string; code?: string }>;
export type RegisterInput = LoginInput & Readonly<{ name: string }>;
export type AuthErrorCode =
  | 'locked'
  | 'mfa-required'
  | 'configuration'
  | 'credentials'
  | 'account-exists'
  | 'expired'
  | 'forbidden'
  | 'network'
  | 'timeout'
  | 'protocol'
  | 'unavailable';

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(`Authentication: ${code}`);
    this.name = 'AuthError';
  }
}

/** Host lifecycle contract; pages consume this without knowing the selected adapter. */
export interface AuthService {
  restore(): Promise<AuthSession | null>;
  login(input: LoginInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  logout(): Promise<void>;
}

export function readSession(value: unknown): AuthSession {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('user' in value) ||
    !('expiresAt' in value) ||
    typeof value.expiresAt !== 'number' ||
    !Number.isFinite(value.expiresAt) ||
    typeof value.user !== 'object' ||
    value.user === null
  )
    throw new AuthError('protocol');
  const user = value.user;
  if (
    !('id' in user) ||
    typeof user.id !== 'string' ||
    !user.id ||
    !('name' in user) ||
    typeof user.name !== 'string' ||
    !user.name ||
    !('email' in user) ||
    typeof user.email !== 'string' ||
    !user.email
  )
    throw new AuthError('protocol');
  return {
    user: { id: user.id, name: user.name, email: user.email },
    expiresAt: value.expiresAt,
    ...('mustChangePassword' in value && typeof value.mustChangePassword === 'boolean'
      ? { mustChangePassword: value.mustChangePassword }
      : {}),
    ...('sessionId' in value && typeof value.sessionId === 'string'
      ? { sessionId: value.sessionId }
      : {}),
  };
}

/** Only same-origin paths may be restored; never accept an external login redirect. */
export function safeReturnTo(value: string | null): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 32)
  )
    return '/';
  try {
    const url = new URL(value, 'https://console.invalid');
    if (
      url.origin !== 'https://console.invalid' ||
      /^\/(login|register|session-expired)(\/|$)/.test(decodeURIComponent(url.pathname)) ||
      decodeURIComponent(url.pathname).includes('\\')
    )
      return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
