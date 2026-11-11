import { readFile, readdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const frontendRoot = resolve(import.meta.dirname, '..');
const policy = JSON.parse(
  await readFile(join(frontendRoot, 'tooling', 'dependency-policy.json'), 'utf8'),
);
const violations = [];

async function checkWorkspace(workspace) {
  const packagePath = join(frontendRoot, workspace, 'package.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    const rule = policy.dependencies[dependency];
    if (!rule) {
      violations.push(`${workspace}: ${dependency} 缺少职责与允许边界`);
      continue;
    }
    if (!rule.allowed.includes(workspace)) {
      violations.push(`${workspace}: ${dependency} 超出允许边界 ${rule.allowed.join(', ')}`);
    }
  }
}

for (const root of ['apps', 'packages']) {
  const rootPath = join(frontendRoot, root);
  for (const entry of await readdir(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const workspace = `${root}/${entry.name}`;
    await checkWorkspace(workspace);
  }
}
await checkWorkspace('surfaces');

// Tooltip/Pressable 的上下文必须来自同一实例。满足 semver 的两份 react-aria
// 仍会使 HeroUI Trigger 与 RAC Provider 失联，普通依赖白名单无法发现。
const adapterRoot = join(frontendRoot, 'packages/ui-adapter');
const adapterRequire = createRequire(join(adapterRoot, 'package.json'));
const heroRoot = await realpath(join(adapterRoot, 'node_modules/@heroui/react'));
const heroRequire = createRequire(join(heroRoot, 'package.json'));
const racEntry = heroRequire.resolve('react-aria-components/Tooltip');
const racRequire = createRequire(racEntry);
if (
  heroRequire.resolve('react-aria/useFocusable') !==
    racRequire.resolve('react-aria/useFocusable') ||
  adapterRequire.resolve('react-aria-components/Tooltip') !== racEntry
)
  violations.push('packages/ui-adapter: HeroUI 与 React Aria Components 必须共享交互上下文实例');

if (violations.length > 0) {
  console.error(
    `Dependency governance failed:\n${violations.map((item) => `- ${item}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Dependency governance passed for ${Object.keys(policy.dependencies).length} governed dependencies.`,
  );
}
