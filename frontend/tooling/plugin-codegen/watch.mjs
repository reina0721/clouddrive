/**
 * plugin-codegen watch —— Plugin 开发期自动 reconciliation。
 *
 * 监听 surfaces/plugins/**（plugin.ts / plugin.navigation.ts / i18n.ts /
 * routes/** 的 Next special file 与 route.meta.ts），在防抖窗口后调用 codegen CLI
 * （spawn 子进程，与 `pnpm codegen:plugins` 同一实现，保证 watch 与 CLI 行为一致）。
 *
 * - 防抖：连续变更在 quietMs 内合并为一次 reconcile（避免保存中间态重复生成）。
 * - 失败：reconcile 失败（如临时中间态非法）打印错误但不退出，等待下一次变更重试
 *   （watch 长驻，开发期不应因瞬时非法态崩溃）。
 * - 首轮：启动时先跑一次全量 reconcile，保证基线一致（配合 `pnpm dev` 使用）。
 *
 * 用法：node tooling/plugin-codegen/watch.mjs [--quiet-ms 300]
 */

import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, '..', '..');
const pluginsRoot = join(frontendRoot, 'surfaces', 'plugins');
const codegenCli = join(here, 'codegen.mjs');

const quietArg = process.argv.indexOf('--quiet-ms');
const quietMs = quietArg >= 0 ? Number(process.argv[quietArg + 1]) : 300;
if (!Number.isFinite(quietMs) || quietMs < 0) {
  console.error('Invalid --quiet-ms');
  process.exit(1);
}

let timer = null;
let running = false;
let pending = false;

function log(message) {
  console.log(`[plugin-codegen:watch] ${message}`);
}

/** 跑一次 codegen（串行：若上一轮仍在跑则标记 pending，结束后补跑）。 */
function runCodegen() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  log('reconcile 开始…');
  const child = spawn(process.execPath, [codegenCli], {
    cwd: frontendRoot,
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    running = false;
    if (code === 0) {
      log('reconcile 完成（生成物已更新，Next dev 将自动感知 app 变化）。');
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

// 首轮全量 reconcile（基线一致）。
runCodegen();

log(`监听 ${pluginsRoot} …（--quiet-ms=${quietMs}）`);

// Node >= 20：recursive watch。Windows 可用。
let watcher;
try {
  watcher = watch(pluginsRoot, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const name = String(filename);
    // 只关注 Plugin 治理文件与 Next special file / route.meta.ts；忽略编辑器临时文件
    // （含 write-tool 的 `.name.<pid>.<uuid>.tmpdir` 临时目录）。
    if (
      /~(?:$|\.)|^\.#|\.swp$|\.tmp$|\.tmpdir$|\.tmpdir[\\/]/.test(name) ||
      name.includes('.tmpdir') ||
      /(?:^|[\\/])\.[^\\/]+\.\d+\.[^.\\/]+\.tmpdir(?:[\\/]|$)/.test(name)
    ) {
      return;
    }
    scheduleReconcile(name);
  });
} catch (error) {
  console.error(`[plugin-codegen:watch] recursive watch 启动失败: ${error.message}`);
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
