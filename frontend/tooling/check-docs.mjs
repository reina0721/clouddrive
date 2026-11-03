/**
 * docs:check —— Frontend 文档结构门禁（结构性，不校验数字断言）。
 *
 * 校验：
 * 1. docs/README.md 入口存在，且包含必备章节锚点。
 * 2. 必备 authority 文档存在。
 * 3. 当前 authority 文档（frontend/README.md、AGENTS.md、docs/ 顶层主题文档与
 *    docs/changes/README.md 索引）的相对链接均可解析。历史变更记录（docs/changes/<seq>/**）
 *    是冻结证据，不深度扫描其内部链接。
 * 4. docs/changes/README.md 索引覆盖最新变更目录（数量 >= 最大序号变更）。
 *
 * 不校验文档中的数字与代码一致性（避免脆弱门禁）；数字正确性由变更记录证据保证。
 */

import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

const frontendRoot = resolve(import.meta.dirname, '..');
const docsRoot = join(frontendRoot, 'docs');
const violations = [];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function toPosix(path) {
  return path.split(sep).join('/');
}

/* 1. 入口存在与必备章节 */
const requiredSectionKeywords = ['架构地图', '主题 authority', '文档维护规则', '变更记录导航'];
const entryPath = join(docsRoot, 'README.md');
if (!(await exists(entryPath))) {
  violations.push('missing: docs/README.md 入口手册不存在');
} else {
  const content = await readFile(entryPath, 'utf8');
  const headings = [...content.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1] ?? '');
  for (const keyword of requiredSectionKeywords) {
    const found = headings.some((heading) => heading.includes(keyword));
    if (!found) {
      violations.push(`docs/README.md 缺少必备章节: ${keyword}`);
    }
  }
}

/* 2. 必备 authority 文档 */
const requiredAuthorities = [
  'frontend-foundation.md',
  'surface-foundation.md',
  'plugin-framework.md',
  'foundation-extension-governance.md',
  'ui-element-system.md',
  'ui-visual-calibration.md',
  'motion-foundation.md',
  'quality-evidence.md',
];
for (const name of requiredAuthorities) {
  if (!(await exists(join(docsRoot, name)))) {
    violations.push(`missing: docs/${name} authority 文档不存在`);
  }
}

/* 3. 当前 authority 相对链接可解析（历史变更记录内部冻结，不扫描） */
const authorityFiles = [
  join(frontendRoot, 'README.md'),
  join(frontendRoot, 'AGENTS.md'),
  join(docsRoot, 'README.md'),
  join(docsRoot, 'changes', 'README.md'),
  ...requiredAuthorities.map((name) => join(docsRoot, name)),
];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
for (const file of authorityFiles) {
  if (!(await exists(file))) continue;
  const content = await readFile(file, 'utf8');
  const localFile = toPosix(relative(frontendRoot, file));
  for (const match of content.matchAll(linkPattern)) {
    const target = match[1]?.trim() ?? '';
    if (
      !target ||
      target.startsWith('#') ||
      target.startsWith('http://') ||
      target.startsWith('https://')
    ) {
      continue;
    }
    // 去掉锚点与查询
    const cleanTarget = target.split('#')[0]?.split('?')[0] ?? '';
    if (!cleanTarget) continue;
    const resolvedPath = resolve(dirname(file), cleanTarget);
    // 仓库外的网络/绝对路径已在上面跳过；node_modules 内部目标不校验
    if (resolvedPath.includes(`${sep}node_modules${sep}`)) continue;
    if (!(await exists(resolvedPath))) {
      violations.push(`broken link: ${localFile} -> ${cleanTarget}`);
    }
  }
}

/* 4. changes 索引覆盖最新变更 */
const indexPath = join(docsRoot, 'changes', 'README.md');
const changeDir = join(docsRoot, 'changes');
const changeEntries = [];
for (const entry of await readdir(changeDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const seq = Number.parseInt(entry.name, 10);
  if (!Number.isNaN(seq)) changeEntries.push(seq);
}
const latestSeq = Math.max(0, ...changeEntries);
if (await exists(indexPath)) {
  const indexContent = await readFile(indexPath, 'utf8');
  if (latestSeq > 0 && !indexContent.includes(String(latestSeq))) {
    violations.push(`docs/changes/README.md 索引未覆盖最新变更 ${latestSeq}`);
  }
} else {
  violations.push('missing: docs/changes/README.md 索引不存在');
}

if (violations.length > 0) {
  console.error(
    `Docs structure check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Docs structure check passed: entry + ${requiredAuthorities.length} authorities, ${changeEntries.length} change records indexed.`,
  );
}
