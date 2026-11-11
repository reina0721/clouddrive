/** 校验当前文档入口、主题和链接；历史任务目录不是必备资产。 */

import { access, readFile } from 'node:fs/promises';
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
const requiredSectionKeywords = ['架构地图', '主题 authority', '文档维护规则'];
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

/* 3. 当前 authority 的相对链接必须可解析。 */
const authorityFiles = [
  join(frontendRoot, 'README.md'),
  join(frontendRoot, 'AGENTS.md'),
  join(docsRoot, 'README.md'),
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

if (violations.length > 0) {
  console.error(
    `Docs structure check failed:\n${violations.map((item) => `- ${item}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Docs structure check passed: entry + ${requiredAuthorities.length} authorities, current links resolved.`,
  );
}
