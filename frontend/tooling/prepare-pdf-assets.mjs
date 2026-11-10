import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'apps/web/src/files/pdf');
const config = JSON.parse(await readFile(join(source, 'assets.json'), 'utf8'));
const require = createRequire(join(root, 'apps/web/package.json'));
const vendor = dirname(require.resolve('pdfjs-dist/package.json'));
const pkg = JSON.parse(await readFile(join(vendor, 'package.json'), 'utf8'));
if (pkg.version !== config.version)
  throw new Error('PDF SDK version does not match declared assets');
const generated = join(root, 'apps/web/public/file-viewers/pdf');
const targetName = config.version + '-p' + config.protocolVersion;
const target = resolve(generated, targetName);
if (
  !/^\d+\.\d+\.\d+-p[1-9]\d*$/.test(targetName) ||
  config.publicPath !== '/file-viewers/pdf/' + targetName ||
  dirname(target) !== generated
)
  throw new Error('Invalid generated PDF target');
const allowFiles = [
  'build/pdf.min.mjs',
  'build/pdf.worker.min.mjs',
  'web/pdf_viewer.mjs',
  'web/pdf_viewer.css',
  'LICENSE',
];
const allowDirs = ['cmaps', 'standard_fonts', 'wasm', 'iccs', 'web/images'];
const planned = new Map();
async function addFile(from, to) {
  const bytes = await readFile(from);
  if (planned.has(to)) throw new Error('Duplicate PDF asset');
  planned.set(to, bytes);
}
async function addTree(from, to) {
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('PDF asset symlink refused');
    if (entry.isDirectory()) await addTree(join(from, entry.name), to + '/' + entry.name);
    else if (entry.isFile()) await addFile(join(from, entry.name), to + '/' + entry.name);
  }
}
for (const path of allowFiles)
  await addFile(
    join(vendor, path),
    path === 'LICENSE' ? 'LICENSE' : 'assets/' + path.split('/').at(-1),
  );
for (const path of allowDirs) await addTree(join(vendor, path), 'assets/' + path.split('/').at(-1));
await addFile(join(source, 'frame/index.html'), 'index.html');
await addFile(join(source, 'frame/frame.css'), 'frame/frame.css');
await addTree(join(source, 'locales'), 'locale');
planned.set(
  'locale/locale.json',
  Buffer.from(JSON.stringify({ 'en-us': 'en-US/viewer.ftl', 'zh-cn': 'zh-CN/viewer.ftl' })),
);
for (const path of ['protocol.ts', 'frame/engine.ts', 'frame/worker.ts']) {
  const result = ts.transpileModule(await readFile(join(source, path), 'utf8'), {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      verbatimModuleSyntax: true,
    },
  });
  planned.set(path.replace(/\.ts$/, '.js'), Buffer.from(result.outputText));
}
const gzip = (path) => gzipSync(planned.get(path)).byteLength;
const metrics = {
  coreGzipBytes:
    gzip('assets/pdf.min.mjs') +
    gzip('assets/pdf_viewer.mjs') +
    gzip('frame/engine.js') +
    gzip('protocol.js'),
  workerGzipBytes:
    gzip('assets/pdf.worker.min.mjs') + gzip('frame/worker.js') + gzip('protocol.js'),
  cssGzipBytes: gzip('assets/pdf_viewer.css') + gzip('frame/frame.css'),
  totalBytes: [...planned.values()].reduce((total, bytes) => total + bytes.byteLength, 0),
};
for (const [key, value] of Object.entries(metrics))
  if (value > config.assetBudgets[key])
    throw new Error('PDF asset budget exceeded: ' + key + ' ' + value);
// 只生成明确allowlist。旧版本清理由任务显式处理，禁止递归清理public或.next。
for (const [path, bytes] of planned) {
  const output = resolve(target, path);
  if (!output.startsWith(target + sep)) throw new Error('PDF asset escaped target');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
}
const files = [...planned].map(([path, bytes]) => ({
  path,
  sizeBytes: bytes.byteLength,
  sha256: createHash('sha256').update(bytes).digest('hex'),
}));
await writeFile(
  join(target, 'manifest.json'),
  JSON.stringify(
    {
      sdk: pkg.name,
      version: pkg.version,
      protocolVersion: config.protocolVersion,
      metrics,
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log('PDF assets prepared', config.version, metrics);
