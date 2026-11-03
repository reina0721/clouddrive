import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { argv, stdout } from 'node:process';

const source = argv[2];
const destination = argv[3];
if (!source || !destination) throw new Error('Specify test output and a fresh evidence directory');
// A fresh destination preserves earlier evidence and avoids overwriting open previews.
await mkdir(destination);
const manifest = [];
for (const entry of await readdir(source, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('sidebar-')) continue;
  const directory = path.join(source, entry.name);
  for (const name of await readdir(directory)) {
    if (!/\.(png|json)$/.test(name) || name.startsWith('test-failed-')) continue;
    const file = path.join(directory, name);
    const hash = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
    await copyFile(file, path.join(destination, name));
    manifest.push({ name, test: entry.name, hash });
  }
}
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
stdout.write(`Archived ${manifest.length} Sidebar evidence files.\n`);
