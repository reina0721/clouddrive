import { createJsonClient, ApiError } from '../api/json-client';
import {
  AuthError,
  readSession,
  type AuthService,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
} from './contract';

/** Cookie session transport backed by the clouddrive IAM projection. */
export function createBackendAuthService(
  apiBaseUrl: string,
  request: typeof fetch = fetch,
): AuthService {
  const json = createJsonClient(apiBaseUrl, request);
  let challengeId: string | undefined;
  async function call(
    path: string,
    body?:
      | LoginInput
      | RegisterInput
      | Readonly<{ logout: true }>
      | Readonly<{ challengeId: string; code: string }>,
  ): Promise<unknown> {
    try {
      return await json(path, body ? { method: 'POST', body } : {});
    } catch (error) {
      if (!(error instanceof ApiError)) throw new AuthError('unavailable');
      if (error.code !== 'http') throw new AuthError(error.code);
      if (error.status === 401)
        throw new AuthError(path === '/auth/session' ? 'expired' : 'credentials');
      if (error.status === 429) throw new AuthError('locked');
      if (error.status === 403) throw new AuthError('forbidden');
      if (error.status === 409) throw new AuthError('account-exists');
      throw new AuthError('unavailable');
    }
  }
  async function restore(): Promise<AuthSession | null> {
    try {
      const session = readSession(await call('/auth/session'));
      return session.expiresAt <= Date.now() ? null : session;
    } catch (error) {
      if (error instanceof AuthError && error.code === 'expired') return null;
      throw error;
    }
  }
  async function authenticate(path: string, input: LoginInput | RegisterInput) {
    const result = await call(
      path,
      challengeId && input.code ? { challengeId, code: input.code } : input,
    );
    if (
      result &&
      typeof result === 'object' &&
      'mfaRequired' in result &&
      result.mfaRequired === true &&
      'challengeId' in result &&
      typeof result.challengeId === 'string'
    ) {
      challengeId = result.challengeId;
      throw new AuthError('mfa-required');
    }
    challengeId = undefined;
    const session = await restore();
    if (!session) throw new AuthError('expired');
    return session;
  }
  return {
    restore,
    login: (input) => authenticate('/auth/login', input),
    register: (input) => authenticate('/auth/register', input),
    logout: async () => {
      await call('/auth/logout', { logout: true });
    },
  };
}
