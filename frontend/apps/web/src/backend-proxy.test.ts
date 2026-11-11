import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendDestination } from './backend-proxy';

afterEach(() => vi.unstubAllEnvs());

describe('runtime backend routing', () => {
  it('reads the deployment upstream without rebuilding or changing the requested resource', () => {
    vi.stubEnv('CLOUDDRIVE_BACKEND_URL', 'http://backend:8120');
    expect(backendDestination('https://files.example/api/files/a%2Fb?download=1').href).toBe(
      'http://backend:8120/api/files/a%2Fb?download=1',
    );
    vi.stubEnv('CLOUDDRIVE_BACKEND_URL', 'https://another-backend.example');
    expect(backendDestination('https://files.example/wopi/files/id?access_token=test').href).toBe(
      'https://another-backend.example/wopi/files/id?access_token=test',
    );
  });

  it('keeps the upstream fixed when a path resembles a protocol-relative URL', () => {
    expect(
      backendDestination('https://files.example//other.example/api', 'http://backend:8080').href,
    ).toBe('http://backend:8080//other.example/api');
  });

  it.each([
    '',
    'backend:8080',
    'file:///etc/passwd',
    'http://user:secret@backend',
    'http://backend/api',
    'http://backend/?target=other',
    'http://backend/#other',
  ])(
    'rejects an ambiguous or invalid upstream without including secrets in the error',
    (backend) => {
      expect(() => backendDestination('https://files.example/api', backend)).toThrow(
        'CLOUDDRIVE_BACKEND_URL must be an HTTP(S) origin.',
      );
    },
  );
});
