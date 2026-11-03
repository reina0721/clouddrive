import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

import {
  getFoundationWorkspaceNameViolation,
  isFoundationDependencyAllowed,
} from './foundation-policy.mjs';

const frontendRoot = resolve(import.meta.dirname, '..');
const policy = JSON.parse(
  await readFile(join(frontendRoot, 'tooling', 'foundation-policy.json'), 'utf8'),
);
const registry = JSON.parse(
  await readFile(join(frontendRoot, 'tooling', 'foundation-contracts.json'), 'utf8'),
);
const violations = [];
const manifests = new Map();

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function registerWorkspace(workspace) {
  const manifestPath = join(frontendRoot, workspace, 'package.json');
  if (!(await exists(manifestPath))) return;
  manifests.set(workspace, JSON.parse(await readFile(manifestPath, 'utf8')));
}

for (const root of ['apps', 'packages']) {
  for (const entry of await readdir(join(frontendRoot, root), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const workspace = `${root}/${entry.name}`;
    await registerWorkspace(workspace);
  }
}
await registerWorkspace('surfaces');

const registeredWorkspaces = new Set(Object.keys(policy.workspaces));
for (const workspace of manifests.keys()) {
  if (!registeredWorkspaces.has(workspace)) violations.push(`${workspace}: workspace 未分类`);
}
for (const workspace of registeredWorkspaces) {
  if (!manifests.has(workspace)) violations.push(`${workspace}: 分类指向不存在的 workspace`);
}

const workspaceByPackage = new Map(
  [...manifests].map(([workspace, manifest]) => [manifest.name, workspace]),
);

for (const [workspace, manifest] of manifests) {
  const owner = policy.workspaces[workspace];
  if (!owner) continue;
  const nameViolation = getFoundationWorkspaceNameViolation(workspace, owner);
  if (nameViolation) violations.push(`${workspace}: ${nameViolation}`);
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    const targetWorkspace = workspaceByPackage.get(dependency);
    if (!targetWorkspace) continue;
    const target = policy.workspaces[targetWorkspace];
    if (!target || !isFoundationDependencyAllowed(owner, target)) {
      violations.push(`${workspace}: 禁止依赖 ${targetWorkspace}`);
    }
  }
}

for (const [packageName, contract] of Object.entries(registry.contracts)) {
  const workspace = workspaceByPackage.get(packageName);
  if (!workspace) {
    violations.push(`${packageName}: Contract 指向不存在的 package`);
    continue;
  }
  const manifest = manifests.get(workspace);
  const actualExports = Object.keys(manifest.exports ?? {}).sort();
  const registeredExports = [...contract.exports].sort();
  if (JSON.stringify(actualExports) !== JSON.stringify(registeredExports)) {
    violations.push(`${packageName}: exports 与 Contract registry 不一致`);
  }
  if (!['experimental', 'stable', 'replacing', 'retiring'].includes(contract.maturity)) {
    violations.push(`${packageName}: maturity 非法`);
  }
  if (!contract.owner || contract.authorityRoutes.length === 0 || contract.evidence.length === 0) {
    violations.push(`${packageName}: owner、authorityRoutes 与 evidence 不得为空`);
  }
  for (const evidence of contract.evidence) {
    if (!(await exists(join(frontendRoot, evidence)))) {
      violations.push(`${packageName}: 证据不存在 ${evidence}`);
    }
  }
}

for (const [workspace, manifest] of manifests) {
  if (
    (workspace.startsWith('packages/') || workspace === 'surfaces') &&
    !registry.contracts[manifest.name]
  ) {
    violations.push(`${manifest.name}: 公共 package/surface 缺少 Contract registry`);
  }
}

async function collectSourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'coverage'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(path)));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const legacyArchitecturePaths = [
  join(frontendRoot, 'packages', `${'ad' + 'min-'}framework`),
  join(frontendRoot, 'packages', `${'ad' + 'min-'}foundation`),
  join(frontendRoot, 'surfaces', `${'ad' + 'min'}`),
  join(frontendRoot, 'apps', `${'ad' + 'min-'}web`),
  join(frontendRoot, 'tooling', `${'ad' + 'min-'}codegen`),
];
for (const legacyPath of legacyArchitecturePaths) {
  if (await exists(legacyPath)) {
    violations.push(`${relative(frontendRoot, legacyPath)}: 禁止恢复旧架构目录`);
  }
}

const architectureNamingRoots = [
  join(frontendRoot, 'packages', 'plugin-framework', 'src'),
  join(frontendRoot, 'packages', 'surface-foundation', 'src'),
  join(frontendRoot, 'surfaces', 'src'),
  join(frontendRoot, 'apps', 'web', 'src', 'host'),
  join(frontendRoot, 'apps', 'web', 'src', 'shell'),
  join(frontendRoot, 'apps', 'web', 'src', 'i18n'),
];
for (const root of architectureNamingRoots) {
  for (const file of await collectSourceFiles(root)) {
    const content = await readFile(file, 'utf8');
    const redundantName = /\bAdmin[A-Z][A-Za-z0-9_]*/.exec(content)?.[0];
    if (redundantName) {
      violations.push(
        `${relative(frontendRoot, file).split(sep).join('/')}: 架构核心禁止重复上下文命名 ${redundantName}`,
      );
    }
  }
}

const vendorOwners = new Map([
  ['react-hook-form', 'packages/form-foundation'],
  ['@hookform/resolvers', 'packages/form-foundation'],
  ['i18next', 'packages/i18n'],
  ['react-i18next', 'packages/i18n'],
]);
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
for (const file of await collectSourceFiles(frontendRoot)) {
  const localPath = relative(frontendRoot, file).split(sep).join('/');
  const content = await readFile(file, 'utf8');
  for (const match of content.matchAll(importPattern)) {
    const specifier = match[1];
    for (const [vendor, owner] of vendorOwners) {
      if (
        (specifier === vendor || specifier.startsWith(`${vendor}/`)) &&
        !localPath.startsWith(`${owner}/`)
      ) {
        violations.push(`${localPath}: ${vendor} 只能由 ${owner} 直接依赖`);
      }
    }
    if (
      (specifier === 'next' || specifier.startsWith('next/')) &&
      !localPath.startsWith('apps/web/') &&
      // Plugin routes/ 是真实 Next App Router 子树：route 模块在受控白名单内可用
      // next/link 与 next/navigation（见 surfaces/AGENTS.md）。其它层仍禁。
      !/^surfaces\/plugins\/[^/]+\/routes\//.test(localPath) &&
      !/^surfaces\/plugins\/[^/]+\/src\//.test(localPath)
    ) {
      violations.push(`${localPath}: Next 只能由 Web Host 或 Plugin route 模块直接依赖`);
    }
  }
  if (
    /\bnew Intl\.(?:DateTimeFormat|NumberFormat|RelativeTimeFormat)\b/.test(content) &&
    !localPath.startsWith('packages/i18n/')
  ) {
    violations.push(`${localPath}: Intl 格式化必须经过 packages/i18n`);
  }
}

if (violations.length > 0) {
  console.error(
    `Foundation governance failed:\n${violations.map((item) => `- ${item}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Foundation governance passed for ${manifests.size} workspaces and ${Object.keys(registry.contracts).length} contract owners.`,
  );
}
