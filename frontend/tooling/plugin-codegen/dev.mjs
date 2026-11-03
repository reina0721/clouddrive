/**
 * dev orchestration —— `pnpm dev` 入口。
 *
 * 并行运行：
 * 1. plugin-codegen watch（Plugin 自动发现/生成/清理）；
 * 2. runtime-codegen watch（Design System Schema Watcher：Schema 变更 → 校验 + 生成 tokens.css/motion.css）；
 * 3. next dev（apps/web，唯一 Next dev server）。
 *
 * 任一进程退出：其余进程被终止（Ctrl+C 时同时收尾）。
 * Windows 兼容：全部经 spawn（shell: false），stdin 直通以支持 Ctrl+C。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '@clouddrive/config/node';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const frontendRoot = resolve(here, '..', '..');
const watchCli = join(here, 'watch.mjs');
const schemaWatchCli = join(frontendRoot, 'tooling', 'runtime-codegen', 'watch.mjs');
const webRoot = join(frontendRoot, 'apps', 'web');

/** 解析 next dev 可执行 JS：优先 Web Host node_modules 内 next 包，其次 require.resolve。 */
function resolveNextBin() {
  const candidates = [
    join(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
    join(frontendRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  try {
    // 经 pnpm store 解析（cwd = apps/web 时 next 可解析）。
    const resolved = require.resolve('next/dist/bin/next', { paths: [webRoot] });
    return resolved;
  } catch {
    throw new Error(
      '无法解析 next dev 可执行文件（apps/web/node_modules/next）。请先 pnpm install。',
    );
  }
}

const children = [];

function run(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? frontendRoot,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...options.env },
  });
  console.log(`[dev] ${name} 启动 (pid ${child.pid})`);
  children.push({ name, child });
  child.on('exit', (code, signal) => {
    console.log(`[dev] ${name} 退出 (code=${code}, signal=${signal})`);
    shutdown(code ?? (signal ? 1 : 0));
  });
  return child;
}

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[dev] 停止全部子进程…');
  for (const { name, child } of children) {
    if (child.exitCode === null && !child.killed) {
      console.log(`[dev] 终止 ${name}…`);
      child.kill();
    }
  }
  // 给子进程一点收尾时间后退出。
  setTimeout(() => process.exit(exitCode), 300);
}

// 1. Plugin codegen watch（自动 reconcile）。
run('plugin-codegen watch', process.execPath, [watchCli]);
// 2. Schema runtime watch（Design System Schema → tokens.css/motion.css）。
run('schema-codegen watch', process.execPath, [schemaWatchCli]);

const config = loadConfig({ cwd: webRoot });
const host = config.web.host;
const port = String(config.web.port);

// 3. Next dev server（Web Host）。
run('next dev', process.execPath, [resolveNextBin(), 'dev', '--hostname', host, '--port', port], {
  cwd: webRoot,
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
