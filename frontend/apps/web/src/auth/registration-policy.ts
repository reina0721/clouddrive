import { readAuthConfig } from './config';
import { AuthError } from './contract';
import { createJsonClient } from '../api/json-client';

/** Public policy exposes availability only, never role grants or administrator settings. */
export async function readRegistrationAvailability(): Promise<boolean> {
  const config = readAuthConfig();
  if (config.mode === 'mock') {
    const { readMockDatabase } = await import('../identity/mock-database');
    return (await readMockDatabase()).registrationSettings.enabled;
  }
  let value: unknown;
  try {
    value = await createJsonClient(config.apiBaseUrl)('/auth/registration-policy');
  } catch {
    throw new AuthError('unavailable');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !('enabled' in value) ||
    typeof value.enabled !== 'boolean' ||
    Object.keys(value).length !== 1
  )
    throw new AuthError('protocol');
  return value.enabled;
}
