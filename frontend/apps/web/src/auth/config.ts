import { AuthError } from './contract';

export type AuthConfig =
  Readonly<{ mode: 'mock' }> | Readonly<{ mode: 'backend'; apiBaseUrl: string }>;

export function parseAuthConfig(
  mode: string | undefined,
  apiBaseUrl: string | undefined,
  production: boolean,
): AuthConfig {
  if (mode === 'mock') return { mode: 'mock' };
  if (!mode) return parseAuthConfig('backend', apiBaseUrl ?? '/api/console/v1', production);
  if (mode !== 'backend' || !apiBaseUrl) throw new AuthError('configuration');
  if (apiBaseUrl.startsWith('/') && !apiBaseUrl.startsWith('//') && !/[\s\\?#]/.test(apiBaseUrl)) {
    return { mode: 'backend', apiBaseUrl: apiBaseUrl.replace(/\/$/, '') };
  }
  try {
    const url = new URL(apiBaseUrl);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          !production &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        ))
    ) {
      throw new AuthError('configuration');
    }
    return { mode: 'backend', apiBaseUrl: apiBaseUrl.replace(/\/$/, '') };
  } catch {
    throw new AuthError('configuration');
  }
}

/** Next public variables are build-time values, not deployment-time runtime overrides. */
export function readAuthConfig(): AuthConfig {
  return parseAuthConfig(
    process.env.NEXT_PUBLIC_AUTH_MODE,
    process.env.NEXT_PUBLIC_AUTH_API_BASE_URL,
    process.env.NODE_ENV === 'production',
  );
}
