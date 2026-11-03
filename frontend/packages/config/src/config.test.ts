import { describe, expect, it } from 'vitest';

import {
  ConfigError,
  formatHostForUrl,
  getListenUrl,
  getProbeHost,
  getProbeUrl,
  resolveConfig,
} from './index.ts';
import { parseEnvContent, populateProcessEnv } from './node/index.ts';

describe('packages/config - resolveConfig', () => {
  it('applies defaults correctly when environment is empty', () => {
    const config = resolveConfig({}, { isProduction: false });

    expect(config.web.host).toBe('0.0.0.0');
    expect(config.web.port).toBe(4173);
    expect(config.web.deploymentMode).toBe('server');
    expect(config.auth.mode).toBe('backend');
    expect(config.isProduction).toBe(false);
  });

  it('supports custom host, port, and deploymentMode overrides', () => {
    const config = resolveConfig({
      WEB_HOST: '127.0.0.1',
      WEB_PORT: '8080',
      WEB_DEPLOYMENT_MODE: 'server',
      NEXT_DIST_DIR: '.custom-dist',
    });

    expect(config.web.host).toBe('127.0.0.1');
    expect(config.web.port).toBe(8080);
    expect(config.web.deploymentMode).toBe('server');
    expect(config.web.distDir).toBe('.custom-dist');
  });

  it('falls back to PORT if WEB_PORT is not specified', () => {
    const config = resolveConfig({
      PORT: '3000',
    });

    expect(config.web.port).toBe(3000);
  });

  it('prefers WEB_PORT over PORT if both are present', () => {
    const config = resolveConfig({
      WEB_PORT: '4173',
      PORT: '3000',
    });

    expect(config.web.port).toBe(4173);
  });

  it('throws ConfigError when port is out of range or not an integer', () => {
    expect(() => resolveConfig({ WEB_PORT: 'not-a-number' })).toThrow(ConfigError);
    expect(() => resolveConfig({ WEB_PORT: '0' })).toThrow(ConfigError);
    expect(() => resolveConfig({ WEB_PORT: '70000' })).toThrow(ConfigError);
  });

  it('throws ConfigError when deployment mode is unknown', () => {
    expect(() => resolveConfig({ WEB_DEPLOYMENT_MODE: 'kubernetes' })).toThrow(ConfigError);
  });

  it('resolves backend auth mode with relative path or valid localhost/https url', () => {
    const relativeAuth = resolveConfig({
      NEXT_PUBLIC_AUTH_MODE: 'backend',
      NEXT_PUBLIC_AUTH_API_BASE_URL: '/api/auth',
    });
    expect(relativeAuth.auth).toEqual({ mode: 'backend', apiBaseUrl: '/api/auth' });

    const localAuth = resolveConfig(
      {
        NEXT_PUBLIC_AUTH_MODE: 'backend',
        NEXT_PUBLIC_AUTH_API_BASE_URL: 'http://127.0.0.1:4174/api',
      },
      { isProduction: false },
    );
    expect(localAuth.auth).toEqual({ mode: 'backend', apiBaseUrl: 'http://127.0.0.1:4174/api' });
  });

  it('rejects invalid backend auth configurations', () => {
    // Missing apiBaseUrl
    expect(() =>
      resolveConfig({
        NEXT_PUBLIC_AUTH_MODE: 'backend',
      }),
    ).toThrow(ConfigError);

    // HTTP in production
    expect(() =>
      resolveConfig(
        {
          NEXT_PUBLIC_AUTH_MODE: 'backend',
          NEXT_PUBLIC_AUTH_API_BASE_URL: 'http://api.example.com',
        },
        { isProduction: true },
      ),
    ).toThrow(ConfigError);
  });
});

describe('packages/config - derive helpers', () => {
  it('formats IPv6 host addresses correctly', () => {
    expect(formatHostForUrl('0.0.0.0')).toBe('0.0.0.0');
    expect(formatHostForUrl('127.0.0.1')).toBe('127.0.0.1');
    expect(formatHostForUrl('::')).toBe('[::]');
    expect(formatHostForUrl('::1')).toBe('[::1]');
    expect(formatHostForUrl('[::1]')).toBe('[::1]');
  });

  it('computes listen url', () => {
    expect(getListenUrl('0.0.0.0', 4173)).toBe('http://0.0.0.0:4173');
    expect(getListenUrl('::', 4173)).toBe('http://[::]:4173');
  });

  it('computes probe host and url by mapping wildcard addresses to loopback', () => {
    expect(getProbeHost('0.0.0.0')).toBe('127.0.0.1');
    expect(getProbeHost('::')).toBe('[::1]');
    expect(getProbeHost('[::]')).toBe('[::1]');
    expect(getProbeHost('192.168.1.10')).toBe('192.168.1.10');

    expect(getProbeUrl('0.0.0.0', 4173)).toBe('http://127.0.0.1:4173');
    expect(getProbeUrl('::', 4173)).toBe('http://[::1]:4173');
    expect(getProbeUrl('127.0.0.1', 4173)).toBe('http://127.0.0.1:4173');
  });
});

describe('packages/config - node env parser', () => {
  it('parses env file content including comments, whitespace and quotes', () => {
    const raw = `
      # Comment line
      WEB_HOST=0.0.0.0
      WEB_PORT = 4173
      EMPTY_VAL=
      QUOTED_DOUBLE="hello world"
      QUOTED_SINGLE='foo bar'
    `;

    const parsed = parseEnvContent(raw);
    expect(parsed['WEB_HOST']).toBe('0.0.0.0');
    expect(parsed['WEB_PORT']).toBe('4173');
    expect(parsed['EMPTY_VAL']).toBe('');
    expect(parsed['QUOTED_DOUBLE']).toBe('hello world');
    expect(parsed['QUOTED_SINGLE']).toBe('foo bar');
  });

  it('populates process.env without overriding existing keys', () => {
    const testKey = 'TEST_CONFIG_ENV_KEY_' + Date.now();
    process.env[testKey] = 'existing_value';

    populateProcessEnv({
      [testKey]: 'new_value',
      [testKey + '_UNSET']: 'unset_value',
    });

    expect(process.env[testKey]).toBe('existing_value');
    expect(process.env[testKey + '_UNSET']).toBe('unset_value');

    delete process.env[testKey];
    delete process.env[testKey + '_UNSET'];
  });
});
