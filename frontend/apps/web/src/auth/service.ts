import { readAuthConfig } from './config';
import { createBackendAuthService } from './backend-adapter';
import type { AuthService } from './contract';

/** One composition entry; pages and controllers never branch on authentication mode. */
export async function createConfiguredAuthService(): Promise<AuthService> {
  const config = readAuthConfig();
  if (config.mode === 'backend') return createBackendAuthService(config.apiBaseUrl);
  const [{ createMockAuthService }, { createBrowserMockRepository }] = await Promise.all([
    import('./mock-adapter'),
    import('./mock-repository'),
  ]);
  const { withMockDirectory } = await import('../identity/mock-auth');
  return withMockDirectory(createMockAuthService(createBrowserMockRepository()));
}
