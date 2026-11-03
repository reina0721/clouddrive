import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  type AppConfig,
  type ResolveConfigOptions,
  resolveConfig,
  resolveWebConfig,
  type WebConfig,
} from '../index.ts';

export * from '../index.ts';

/**
 * Parses raw .env file contents into a key-value record.
 * Handles comments, empty lines, and basic single/double quoted values.
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip wrapping quotes if matching
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Reads and parses an env file from disk if it exists.
 */
export function loadEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  try {
    const content = readFileSync(filePath, 'utf8');
    return parseEnvContent(content);
  } catch {
    return {};
  }
}

/**
 * Populates process.env with values from envRecord, without overwriting existing variables.
 * Guarantees that explicit environment variables (e.g. CI / CLI) take precedence.
 */
export function populateProcessEnv(envRecord: Record<string, string>): void {
  for (const [key, value] of Object.entries(envRecord)) {
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

/**
 * Resolves the path to apps/web/.env starting from a directory.
 */
export function findHostEnvPath(startDir: string = process.cwd()): string {
  // Check candidate locations:
  // 1. Direct path inside startDir (if cwd is repo root)
  const candidate1 = resolve(startDir, 'apps', 'web', '.env');
  if (existsSync(candidate1)) return candidate1;

  // 2. Direct .env inside startDir (if cwd is apps/web)
  const candidate2 = resolve(startDir, '.env');
  if (existsSync(candidate2)) return candidate2;

  // 3. Parent directory candidates
  let current = startDir;
  for (let i = 0; i < 4; i++) {
    const check1 = join(current, 'apps', 'web', '.env');
    if (existsSync(check1)) return check1;
    const check2 = join(current, '.env');
    if (existsSync(check2) && current.endsWith('web')) return check2;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Fallback default
  return candidate1;
}

export type LoadConfigOptions = ResolveConfigOptions &
  Readonly<{
    envPath?: string;
    cwd?: string;
    populateEnv?: boolean;
  }>;

/**
 * Loads Host Web configuration only (host, port, deploymentMode, distDir).
 * Does not require auth variables to be defined, safe for build / codegen / next.config.ts.
 */
export function loadWebConfig(options?: LoadConfigOptions): WebConfig {
  const envPath = options?.envPath ?? findHostEnvPath(options?.cwd);
  const fileEnv = loadEnvFile(envPath);

  if (options?.populateEnv !== false) {
    populateProcessEnv(fileEnv);
  }

  const mergedEnv: Record<string, string | undefined> = {
    ...fileEnv,
    ...process.env,
  };

  return resolveWebConfig(mergedEnv);
}

/**
 * Loads full Host configuration from disk (.env) and environment variables (process.env).
 * By default populates process.env with missing .env variables and returns validated AppConfig.
 */
export function loadConfig(options?: LoadConfigOptions): AppConfig {
  const envPath = options?.envPath ?? findHostEnvPath(options?.cwd);
  const fileEnv = loadEnvFile(envPath);

  if (options?.populateEnv !== false) {
    populateProcessEnv(fileEnv);
  }

  // Merge: file values as baseline, process.env overrides
  const mergedEnv: Record<string, string | undefined> = {
    ...fileEnv,
    ...process.env,
  };

  return resolveConfig(mergedEnv, {
    ...(options?.isProduction !== undefined ? { isProduction: options.isProduction } : {}),
  });
}
