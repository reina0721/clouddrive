import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(root, 'apps/web/src/files/pdf/assets.json'), 'utf8'));
const directory = join(root, 'apps/web/public', config.publicPath);
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
const actual = new Map();
async function walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error('PDF asset symlink');
    if (entry.isDirectory()) await walk(join(dir, entry.name), path + '/');
    else if (path !== 'manifest.json') actual.set(path, await readFile(join(dir, entry.name)));
  }
}
await walk(directory);
if (manifest.version !== config.version || actual.size !== manifest.files.length)
  throw new Error('PDF asset inventory mismatch');
for (const entry of manifest.files) {
  const bytes = actual.get(entry.path);
  if (
    !bytes ||
    bytes.byteLength !== entry.sizeBytes ||
    createHash('sha256').update(bytes).digest('hex') !== entry.sha256
  )
    throw new Error('PDF asset digest mismatch: ' + entry.path);
}
if ([...actual.keys()].some((path) => /sandbox|scripting|\.map$/i.test(path)))
  throw new Error('Unapproved PDF runtime asset');
const gzip = (path) => gzipSync(actual.get(path)).byteLength;
const metrics = {
  coreGzipBytes:
    gzip('assets/pdf.min.mjs') +
    gzip('assets/pdf_viewer.mjs') +
    gzip('frame/engine.js') +
    gzip('protocol.js'),
  workerGzipBytes:
    gzip('assets/pdf.worker.min.mjs') + gzip('frame/worker.js') + gzip('protocol.js'),
  cssGzipBytes: gzip('assets/pdf_viewer.css') + gzip('frame/frame.css'),
  totalBytes: [...actual.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0),
};
for (const [key, value] of Object.entries(metrics))
  if (value > config.assetBudgets[key]) throw new Error('PDF asset budget exceeded: ' + key);
console.log(JSON.stringify({ version: manifest.version, metrics, files: actual.size }));
