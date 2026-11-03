import { readdir, mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { argv, stdout } from 'node:process';

const root = argv[2] ?? 'test-results/playwright';
const destination =
  argv[3] ?? 'docs/changes/109-ui-ux-optimization/evidence/sidebar/visual-differences';
const designChanges = new Set([
  'surface-shell-parent-navigation',
  'surface-shell-compact-sibling-swap',
  'surface-shell-compact-flyout',
  'ui-elements-family-overlays',
  'mobile-navigation-open',
  'ui-elements-destructive-confirm',
]);
const manifest = [];
const overlayRecheck = await readFile(
  'docs/changes/109-ui-ux-optimization/evidence/sidebar-overlay-recheck.txt',
  'utf8',
);
const resolved =
  overlayRecheck.includes('  1 passed') && !overlayRecheck.includes('  1 failed')
    ? {
        'ui-elements-date-picker-open':
          '原截图断言复验通过，无需基线更新；见 sidebar-overlay-recheck.txt。',
      }
    : {};
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
async function listPng(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? listPng(file) : file.endsWith('.png') ? [file] : [];
    }),
  );
  return nested.flat();
}
const baselines = await listPng('apps/web/e2e');
for (const directory of await readdir(root, { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  const files = await readdir(path.join(root, directory.name));
  for (const filename of files.filter((file) => file.endsWith('-expected.png'))) {
    const name = filename.replace('-expected.png', '');
    if (!files.includes(`${name}-actual.png`)) continue;
    const folder = String(manifest.length + 1).padStart(2, '0');
    await mkdir(path.join(destination, folder), { recursive: true });
    const hashes = {};
    for (const kind of ['expected', 'actual', 'diff']) {
      const source = path.join(root, directory.name, `${name}-${kind}.png`);
      if (!files.includes(`${name}-${kind}.png`)) continue;
      await copyFile(source, path.join(destination, folder, `${kind}.png`));
      hashes[kind] = await hash(source);
    }
    const candidates = baselines.filter((file) =>
      [`${name}.png`, `${name}-chromium-win32.png`, `${name}-backend-contract-win32.png`].includes(
        path.basename(file),
      ),
    );
    manifest.push({
      folder,
      name,
      test: directory.name,
      baselines: candidates,
      hashes,
      requiresApproval: designChanges.has(name) && !resolved[name],
      resolution:
        resolved[name] ??
        (designChanges.has(name)
          ? null
          : '不属于本轮设计基线更新范围；截图稳定性及原断言复验见 sidebar-verification.md。'),
    });
  }
}
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  path.join(destination, 'index.html'),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Sidebar 视觉差异复核</title>
<style>body{font-family:system-ui;margin:24px;background:#f6f7fb;color:#172033}section{margin-bottom:40px}div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}img{width:100%;border:1px solid #cfd5df}figcaption{padding:8px}</style>
<h1>Sidebar 视觉差异复核</h1><p>左：现有基线；中：当前结果；右：像素差异。基线未更新。共 ${manifest.filter((item) => item.requiresApproval).length} 项待人工复核；原图与 SHA-256 见 manifest.json。已复验通过的偶发截图也保留，并明确标记为无需更新。</p>
${manifest.map(({ folder, name, resolution }) => `<section><h2>${folder} · ${name}</h2><p>${resolution ?? '待人工确认本轮设计变化。'}</p><div>${['expected', 'actual', 'diff'].map((kind) => `<figure><figcaption>${kind}</figcaption><a href="${folder}/${kind}.png"><img loading="lazy" src="${folder}/${kind}.png" alt="${name} ${kind}"></a></figure>`).join('')}</div></section>`).join('\n')}
</html>\n`,
);
stdout.write(`Saved ${manifest.length} visual differences.\n`);
