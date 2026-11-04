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

const returnOrigin = 'https://console.invalid';
const returnFragmentKey = 'returnFragment';

/** safeReturnTo 只接受同源路径，拒绝外部或循环登录跳转。 */
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
    const url = new URL(value, returnOrigin);
    if (
      url.origin !== returnOrigin ||
      /^\/(login|register|session-expired)(\/|$)/.test(decodeURIComponent(url.pathname)) ||
      decodeURIComponent(url.pathname).includes('\\')
    )
      return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}

/** authPageHref 将片段留在浏览器端，避免分享标识被编码进登录请求query。 */
export function authPageHref(
  page: '/login' | '/register' | '/session-expired',
  target: string,
): string {
  const destination = new URL(safeReturnTo(target), returnOrigin);
  const query = new URLSearchParams({ returnTo: destination.pathname + destination.search });
  const fragment = destination.hash
    ? '#' + new URLSearchParams({ [returnFragmentKey]: destination.hash.slice(1) }).toString()
    : '';
  return page + '?' + query.toString() + fragment;
}

/** authReturnDestination 在客户端实际跳转时恢复独立片段，不改变已校验的路径/query。 */
export function authReturnDestination(queryTarget: string | null, authHash: string): string {
  const target = safeReturnTo(queryTarget);
  const fragment = new URLSearchParams(authHash.replace(/^#/, '')).get(returnFragmentKey);
  if (fragment === null) return target;
  const destination = new URL(target, returnOrigin);
  destination.hash = fragment;
  return destination.pathname + destination.search + destination.hash;
}
