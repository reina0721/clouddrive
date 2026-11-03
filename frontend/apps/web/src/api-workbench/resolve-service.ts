import type { ApiWorkbenchPort } from '@clouddrive/surface/api-workbench';
import { readAuthConfig } from '../auth/config';

/** Resolve the runtime implementation only when the workbench is used. */
export async function resolveService(): Promise<ApiWorkbenchPort> {
  const config = readAuthConfig();
  if (config.mode === 'backend') {
    const { createBackendApiWorkbenchService } = await import('./backend-service');
    return createBackendApiWorkbenchService(config.apiBaseUrl);
  }
  const { createMockApiWorkbenchService } = await import('./mock-service');
  return createMockApiWorkbenchService();
}
