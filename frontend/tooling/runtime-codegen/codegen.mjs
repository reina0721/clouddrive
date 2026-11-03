/**
 * runtime-codegen —— Design System Schema Runtime codegen CLI。
 *
 * 与 `@clouddrive/schemas/runtime` 同一实现：经 Node 24 type-stripping
 * 动态 import runtime 模块，Source Path 清单来自 runtime 内建最小 Registry
 * （不在此重复任何 Authority 元数据）。
 *
 * 用法：
 *   node tooling/runtime-codegen/codegen.mjs            # 生成全部 artifact
 *   node tooling/runtime-codegen/codegen.mjs --check    # freshness 逐字节校验
 */

import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const frontendRoot = resolve(import.meta.dirname, '..', '..');

/** 动态 import runtime 入口（Node 24 type-stripping 直接加载 .ts）。 */
async function loadRuntime() {
  const runtimeDir = join(frontendRoot, 'packages', 'schemas', 'src', 'runtime');
  const module = await import(pathToFileURL(join(runtimeDir, 'index.ts')).href);
  return module;
}

async function main() {
  const check = process.argv.includes('--check');
  const runtimeModule = await loadRuntime();
  const { createSchemaRuntime, SOURCE_PATHS } = runtimeModule;

  const sources = SOURCE_PATHS.map((entry) => ({
    sourceId: entry.sourceId,
    schemaPath: entry.schemaPath,
  }));

  const runtime = await createSchemaRuntime({
    workspaceRoot: frontendRoot,
    sources,
    registryFile: 'tooling/foundation-contracts.json',
  });

  try {
    // 1. validate 全部 Schema Source（fail-fast）。
    let failed = false;
    for (const summary of await runtime.listSources()) {
      const result = await runtime.validate(summary.sourceId);
      if (!result.ok) {
        failed = true;
        console.error(`[runtime-codegen] Schema 校验失败 ${summary.sourceId}:`);
        for (const issue of result.issues) console.error(`  - ${issue}`);
      }
    }
    if (failed) {
      process.exitCode = 1;
      return;
    }

    if (check) {
      const freshness = await runtime.checkFreshness();
      let allOk = true;
      for (const item of freshness) {
        if (!item.ok) {
          allOk = false;
          console.error(`[runtime-codegen] freshness 失败 ${item.target}: ${item.error ?? ''}`);
          for (const region of item.regions ?? []) {
            if (!region.ok) console.error(`  - region ${region.regionId} 漂移`);
          }
        } else {
          console.log(`[runtime-codegen] fresh ${item.target}`);
        }
      }
      if (!allOk) {
        console.error('运行 `pnpm codegen:design` 重新生成（Generated Artifact 禁止手改）。');
        process.exitCode = 1;
        return;
      }
      console.log('[runtime-codegen] 全部 Artifact fresh。');
      return;
    }

    const results = await runtime.generate();
    let failedGenerate = false;
    for (const item of results) {
      if (item.ok) {
        console.log(`[runtime-codegen] 生成 ${item.target} (${item.generator})`);
      } else {
        failedGenerate = true;
        console.error(`[runtime-codegen] 生成失败 ${item.target}: ${item.error ?? ''}`);
      }
    }
    if (failedGenerate) {
      process.exitCode = 1;
      return;
    }
    console.log('[runtime-codegen] Artifact 生成完成。');
  } finally {
    await runtime.close();
  }
}

// 仅供 CLI 使用；若被 import 则跳过执行。
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
