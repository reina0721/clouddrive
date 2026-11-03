/**
 * check-tailwind-sources —— Tailwind v4 source coverage 架构门禁。
 *
 * 背景：Tailwind v4 只对显式 `@source`（或入口 CSS 所在目录的自动检测）内的
 * 源码生成 utility。若某个正式允许业务直接写 Tailwind utility 的源码根不在
 * coverage 内，会出现「该根内独有使用的 utility 静默不生成、样式悄悄失效」——
 * 历史上 `surfaces/` 曾漏登记，导致 DataTable 示例的 `mb-4` 等 22 个 utility
 * 从未编译出来（代码无错但样式缺失，且是否生效取决于其它目录是否碰巧使用同名
 * class）。本门禁把「正式源码根 × @source coverage」变成可校验 contract：
 *
 * - 覆盖判定基于目录根与 @source 路径的解析关系，不依赖任何具体 className；
 * - 未来新增正式源码根（含 .tsx，即能写 className）但未登记 @source 时明确失败；
 * - apps/web 是 Tailwind 入口（styles.css）所在目录，由 v4 自动检测覆盖；
 *   若未来入口迁移或行为变化，允许显式登记同样通过。
 *
 * 与 foundation-policy.json 共享「正式 workspace root」的机器可读分类，
 * 不在此硬编码目录清单。
 */

import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { isRootCoveredBySources } from './tailwind-source-policy.mjs';

const frontendRoot = resolve(import.meta.dirname, '..');
const entryStyles = join(frontendRoot, 'apps', 'web', 'src', 'styles.css');
const policyPath = join(frontendRoot, 'tooling', 'foundation-policy.json');
const violations = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 递归判断目录下是否存在任何 .tsx 源码（排除 node_modules/构建/测试产物）。 */
async function containsTsx(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (
      ['node_modules', '.next', 'dist', 'coverage', 'test-results', 'playwright-report'].includes(
        entry.name,
      )
    ) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (await containsTsx(path)) return true;
    } else if (entry.name.endsWith('.tsx')) {
      return true;
    }
  }
  return false;
}

/** 解析 styles.css 中全部 `@source '<path>'` 声明为绝对路径（跳过注释行）。 */
async function resolveSourceRoots(stylesPath) {
  const content = await readFile(stylesPath, 'utf8');
  const roots = [];
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('//') || line.startsWith('/*')) continue;
    const match = line.match(/@source\s+['"]([^'"]+)['"]/);
    if (match) roots.push(resolve(dirname(stylesPath), match[1]));
  }
  return roots;
}

if (!(await exists(entryStyles))) {
  violations.push('apps/web/src/styles.css 不存在：Tailwind 入口缺失');
} else {
  const sourceRoots = await resolveSourceRoots(entryStyles);
  if (sourceRoots.length === 0) {
    violations.push('apps/web/src/styles.css 未声明任何 @source：正式源码根无法被校验');
  }

  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  const entryRoot = resolve(dirname(entryStyles), '..'); // apps/web（入口所在目录）

  for (const workspace of Object.keys(policy.workspaces)) {
    // 仅校验含真实业务源码（.tsx）的正式 workspace root；纯 CSS/纯 TS 层（types/schemas/core 等）不写 utility，不要求覆盖。
    const workspacePath = join(frontendRoot, workspace);
    if (!(await exists(workspacePath))) {
      violations.push(`${workspace}: foundation-policy 指向不存在的目录`);
      continue;
    }
    if (!(await containsTsx(workspacePath))) continue;
    if (resolve(workspacePath) === resolve(entryRoot)) continue; // apps/web：入口自动覆盖
    if (!isRootCoveredBySources(workspacePath, sourceRoots)) {
      const relPath = relative(frontendRoot, workspacePath).split(sep).join('/');
      violations.push(
        `${relPath}: 正式源码根未被 Tailwind @source 覆盖——该目录内的独有 utility 会静默不生成；请在 apps/web/src/styles.css 登记 @source`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(
    `Tailwind source coverage failed:\n${violations.map((item) => `- ${item}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Tailwind source coverage passed: entry + ${(await resolveSourceRoots(entryStyles)).length} @source roots cover all TSX-bearing workspaces.`,
  );
}
