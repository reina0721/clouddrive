import { readdir, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stdout } from 'node:process';

const root = 'test-results/account-visual-current';
const destination = 'docs/changes/109-ui-ux-optimization/evidence/account-menu/visual-differences';
const manifest = [];
for (const directory of await readdir(root, { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  const files = await readdir(path.join(root, directory.name));
  for (const filename of files.filter((file) => file.endsWith('-expected.png'))) {
    const name = filename.replace('-expected.png', '');
    if (!files.includes(`${name}-actual.png`)) continue;
    const folder = String(manifest.length + 1).padStart(2, '0');
    await mkdir(path.join(destination, folder), { recursive: true });
    for (const kind of ['expected', 'actual', 'diff']) {
      const file = `${name}-${kind}.png`;
      if (files.includes(file))
        await copyFile(
          path.join(root, directory.name, file),
          path.join(destination, folder, `${kind}.png`),
        );
    }
    manifest.push({ folder, name, test: directory.name });
  }
}
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(
  path.join(destination, 'index.html'),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>账户菜单：视觉差异复核</title>
<style>body{font-family:system-ui;margin:24px;background:#f6f7fb;color:#172033}section{margin-bottom:40px}div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0}img{width:100%;border:1px solid #cfd5df}figcaption{padding:8px}</style>
<h1>账户菜单：视觉差异复核</h1><p>左：现有基线；中：当前结果；右：像素差异。基线未更新。本次全量检查产生 ${manifest.length} 个差异。</p>
${manifest.map(({ folder, name }) => `<section><h2>${folder} · ${name}</h2><div>${['expected', 'actual', 'diff'].map((kind) => `<figure><figcaption>${kind}</figcaption><a href="${folder}/${kind}.png"><img loading="lazy" src="${folder}/${kind}.png" alt="${name} ${kind}"></a></figure>`).join('')}</div></section>`).join('\n')}
</html>\n`,
);
stdout.write(`Saved ${manifest.length} visual differences.\n`);
