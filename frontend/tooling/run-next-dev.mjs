/**
 * run-next-dev.mjs — Standalone runner for Next.js dev server in apps/web.
 * Loads Host configuration via @clouddrive/config/node and passes dynamic
 * --hostname and --port to Next CLI.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '@clouddrive/config/node';
import { nextDevOptions } from './next-dev-options.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const frontendRoot = resolve(here, '..');
const webRoot = join(frontendRoot, 'apps', 'web');

function resolveNextBin() {
  const candidates = [
    join(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
    join(frontendRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  try {
    return require.resolve('next/dist/bin/next', { paths: [webRoot] });
  } catch {
    throw new Error(
      '无法解析 next dev 可执行文件（apps/web/node_modules/next）。请先 pnpm install。',
    );
  }
}

const config = loadConfig({ cwd: webRoot });
const host = config.web.host;
const port = String(config.web.port);

const child = spawn(
  process.execPath,
  [resolveNextBin(), 'dev', ...nextDevOptions(), '--hostname', host, '--port', port],
  {
    cwd: webRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  },
);

child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
