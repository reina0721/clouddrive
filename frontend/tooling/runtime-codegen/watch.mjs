/**
 * runtime-codegen watch —— Schema Watcher（`pnpm codegen:design:watch`）。
 *
 * 监听 Source Path Registry 中全部 Schema 文件；防抖后调用 codegen CLI
 * （spawn 子进程，与 `pnpm codegen:design` 同一实现）。首轮全量 reconcile。
 * 失败打印但不退出，等待下次变更重试。开发期配合 `pnpm dev` 使用
 * （dev.mjs 三进程编排：plugin watch + schema watch + next dev）。
 */

import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..', '..');
const schemaFile = join(frontendRoot, 'packages', 'design-system', 'design-system.schema.json');
const codegenCli = join(here, 'codegen.mjs');

const quietArg = process.argv.indexOf('--quiet-ms');
const quietMs = quietArg >= 0 ? Number(process.argv[quietArg + 1]) : 300;
if (!Number.isFinite(quietMs) || quietMs < 0) {
  console.error('Invalid --quiet-ms');
  process.exit(1);
}

function log(message) {
  console.log(`[runtime-codegen:watch] ${message}`);
}

let timer = null;
let running = false;
let pending = false;

function runCodegen() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  log('reconcile 开始…');
  const child = spawn(process.execPath, [codegenCli], { cwd: frontendRoot, stdio: 'inherit' });
  child.on('exit', (code) => {
    running = false;
    if (code === 0) {
      log('reconcile 完成（Schema 校验通过；Artifact 已更新）。');
    } else {
      log(`reconcile 失败（exit ${code}）：可能为瞬时中间态，等待下次变更重试。`);
    }
    if (pending) {
      pending = false;
      runCodegen();
    }
  });
}

function scheduleReconcile(reason) {
  log(`检测到变更（${reason}），${quietMs}ms 防抖后 reconcile…`);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    runCodegen();
  }, quietMs);
}

// 首轮全量 reconcile。
runCodegen();

log(`监听 ${schemaFile} …（--quiet-ms=${quietMs}）`);

let watcher;
try {
  watcher = watch(dirname(schemaFile), (_event, filename) => {
    if (!filename) return;
    const name = String(filename);
    // 只关注 Schema 文件本身；忽略编辑器临时文件。
    if (
      /~(?:$|\.)|^\.#|\.swp$|\.tmp$|\.tmpdir$|\.tmpdir[\\/]/.test(name) ||
      name.includes('.tmpdir')
    ) {
      return;
    }
    if (name === 'design-system.schema.json') {
      scheduleReconcile(name);
    }
  });
} catch (error) {
  console.error(`[runtime-codegen:watch] watch 启动失败: ${error.message}`);
  process.exit(1);
}

function shutdown() {
  log('停止 watch。');
  try {
    watcher?.close();
  } catch {
    /* noop */
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
