import { ConfigError, type ConfigIssue } from './errors.ts';
import {
  type AppConfig,
  type AuthConfig,
  DEFAULT_DEPLOYMENT_MODE,
  DEFAULT_WEB_HOST,
  DEFAULT_WEB_PORT,
  deploymentModeSchema,
  type WebConfig,
  webHostSchema,
  webPortSchema,
} from './schema.ts';

export type ResolveConfigOptions = Readonly<{
  isProduction?: boolean;
}>;

export function parseAuthConfig(
  mode: string | undefined,
  apiBaseUrl: string | undefined,
  production: boolean,
): AuthConfig {
  if (!mode) return { mode: 'backend', apiBaseUrl: apiBaseUrl ?? '/api/console/v1' };

  if (mode === 'mock') {
    return { mode: 'mock' };
  }

  if (mode !== 'backend') {
    throw new ConfigError('Invalid authentication configuration', [
      {
        path: 'auth.mode',
        message: `Invalid auth mode "${mode}", expected "mock" or "backend"`,
      },
    ]);
  }

  if (!apiBaseUrl) {
    throw new ConfigError('Invalid authentication configuration', [
      {
        path: 'auth.apiBaseUrl',
        message: 'Backend authentication requires NEXT_PUBLIC_AUTH_API_BASE_URL to be set',
      },
    ]);
  }

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
      throw new ConfigError('Invalid authentication API base URL', [
        {
          path: 'auth.apiBaseUrl',
          message: 'apiBaseUrl must be relative path or valid HTTPS URL (or HTTP localhost in dev)',
        },
      ]);
    }
    return { mode: 'backend', apiBaseUrl: apiBaseUrl.replace(/\/$/, '') };
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError('Invalid authentication API base URL', [
      {
        path: 'auth.apiBaseUrl',
        message: 'apiBaseUrl must be a valid URL',
      },
    ]);
  }
}

export function resolveWebConfig(rawEnv: Record<string, string | undefined>): WebConfig {
  const issues: ConfigIssue[] = [];

  const rawHost =
    rawEnv.WEB_HOST !== undefined && rawEnv.WEB_HOST !== '' ? rawEnv.WEB_HOST : DEFAULT_WEB_HOST;
  const hostResult = webHostSchema.safeParse(rawHost);
  let host = DEFAULT_WEB_HOST;
  if (hostResult.success) {
    host = hostResult.data;
  } else {
    for (const err of hostResult.error.issues) {
      issues.push({ path: 'web.host', message: err.message });
    }
  }

  const rawPort =
    rawEnv.WEB_PORT !== undefined && rawEnv.WEB_PORT !== ''
      ? rawEnv.WEB_PORT
      : rawEnv.PORT !== undefined && rawEnv.PORT !== ''
        ? rawEnv.PORT
        : DEFAULT_WEB_PORT;
  const portResult = webPortSchema.safeParse(rawPort);
  let port = DEFAULT_WEB_PORT;
  if (portResult.success) {
    port = portResult.data;
  } else {
    for (const err of portResult.error.issues) {
      issues.push({ path: 'web.port', message: err.message });
    }
  }

  const rawDeploymentMode =
    rawEnv.WEB_DEPLOYMENT_MODE !== undefined && rawEnv.WEB_DEPLOYMENT_MODE !== ''
      ? rawEnv.WEB_DEPLOYMENT_MODE
      : DEFAULT_DEPLOYMENT_MODE;
  const deploymentModeResult = deploymentModeSchema.safeParse(rawDeploymentMode);
  let deploymentMode = DEFAULT_DEPLOYMENT_MODE;
  if (deploymentModeResult.success) {
    deploymentMode = deploymentModeResult.data;
  } else {
    for (const err of deploymentModeResult.error.issues) {
      issues.push({ path: 'web.deploymentMode', message: err.message });
    }
  }

  const distDir = rawEnv.NEXT_DIST_DIR?.trim() || undefined;

  if (issues.length > 0) {
    throw new ConfigError('Invalid web configuration', issues);
  }

  return {
    host,
    port,
    deploymentMode,
    ...(distDir ? { distDir } : {}),
  };
}

export function resolveConfig(
  rawEnv: Record<string, string | undefined>,
  options?: ResolveConfigOptions,
): AppConfig {
  const issues: ConfigIssue[] = [];
  const isProduction = options?.isProduction ?? rawEnv.NODE_ENV === 'production';

  // 1. Resolve WebConfig
  let web: WebConfig;
  try {
    web = resolveWebConfig(rawEnv);
  } catch (err) {
    if (err instanceof ConfigError) {
      issues.push(...err.issues);
      web = {
        host: DEFAULT_WEB_HOST,
        port: DEFAULT_WEB_PORT,
        deploymentMode: DEFAULT_DEPLOYMENT_MODE,
      };
    } else {
      throw err;
    }
  }

  // 2. Resolve AuthConfig
  let auth: AuthConfig = { mode: 'mock' };
  try {
    auth = parseAuthConfig(
      rawEnv.NEXT_PUBLIC_AUTH_MODE,
      rawEnv.NEXT_PUBLIC_AUTH_API_BASE_URL,
      isProduction,
    );
  } catch (err) {
    if (err instanceof ConfigError) {
      issues.push(...err.issues);
    } else if (err instanceof Error) {
      issues.push({ path: 'auth', message: err.message });
    }
  }

  if (issues.length > 0) {
    throw new ConfigError('Invalid configuration', issues);
  }

  return {
    web,
    auth,
    isProduction,
  };
}
