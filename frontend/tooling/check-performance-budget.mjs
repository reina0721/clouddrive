import { access, readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const frontendRoot = resolve(import.meta.dirname, '..');
const webRoot = join(frontendRoot, 'apps', 'web');
const outputCandidates = [join(webRoot, 'dist'), join(webRoot, 'out')];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const outputRoot = await (async () => {
  for (const candidate of outputCandidates) {
    if (
      (await exists(join(candidate, 'index.html'))) ||
      (await exists(join(candidate, 'server/app/index.html')))
    )
      return candidate;
  }
  throw new Error('Next.js 静态构建缺少 index.html');
})();

async function collectFiles(directory, extension) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(entryPath, extension)));
    if (entry.isFile() && entry.name.endsWith(extension)) files.push(entryPath);
  }
  return files;
}

async function gzipBytes(path) {
  return gzipSync(await readFile(path), { level: 9 }).byteLength;
}

const serverBuild = await exists(join(outputRoot, 'server/app/index.html'));
const htmlRoot = serverBuild ? join(outputRoot, 'server/app') : outputRoot;
const staticRoot = serverBuild ? join(outputRoot, 'static') : join(outputRoot, '_next', 'static');
const jsAssets = await collectFiles(staticRoot, '.js');
const cssAssets = await collectFiles(staticRoot, '.css');
const jsGzipSizes = await Promise.all(
  jsAssets.map(async (asset) => ({ asset, bytes: await gzipBytes(asset) })),
);
const jsGzipSizeByAsset = new Map(jsGzipSizes.map(({ asset, bytes }) => [resolve(asset), bytes]));
const cssGzipBytes = (await Promise.all(cssAssets.map((asset) => gzipBytes(asset)))).reduce(
  (sum, bytes) => sum + bytes,
  0,
);
const totalJsGzipBytes = jsGzipSizes.reduce((sum, item) => sum + item.bytes, 0);
const largestJsChunk = jsGzipSizes.reduce(
  (largest, item) => (item.bytes > largest.bytes ? item : largest),
  { asset: '', bytes: 0 },
);

const htmlFiles = await collectFiles(htmlRoot, '.html');

function routeOf(htmlFile) {
  const localPath = relative(htmlRoot, htmlFile).split(sep).join('/');
  if (localPath === 'index.html') return '/';
  if (localPath.endsWith('/index.html')) return `/${localPath.slice(0, -'/index.html'.length)}`;
  return `/${localPath.slice(0, -'.html'.length)}`;
}

async function measureRoute(htmlFile) {
  const html = await readFile(htmlFile, 'utf8');
  const assets = [
    ...new Set(
      [...html.matchAll(/<script[^>]+src=["']([^"']+\.js(?:\?[^"']*)?)["']/g)]
        .map(([, source]) => source)
        .filter((source) => !/^https?:\/\//.test(source))
        .map((source) =>
          resolve(
            outputRoot,
            decodeURIComponent(source.split('?')[0]).replace(
              serverBuild ? /^\/_next\// : /^\/+/,
              '',
            ),
          ),
        ),
    ),
  ];
  const missingAssets = assets.filter((asset) => !jsGzipSizeByAsset.has(asset));
  if (missingAssets.length > 0) {
    throw new Error(`静态页面引用了缺失的 JS：${missingAssets.join(', ')}`);
  }
  return {
    route: routeOf(htmlFile),
    bytes: assets.reduce((sum, asset) => sum + jsGzipSizeByAsset.get(asset), 0),
  };
}

const routeMeasurements = await Promise.all(htmlFiles.map(measureRoute));
const homepageMeasurement = routeMeasurements.find(({ route }) => route === '/');
if (!homepageMeasurement) throw new Error('Next.js 静态构建缺少首页路由测量');
const heaviestRoute = routeMeasurements.reduce(
  (heaviest, route) => (route.bytes > heaviest.bytes ? route : heaviest),
  { route: '', bytes: 0 },
);

const budgets = {
  initialJsGzipBytes: 400 * 1024,
  maxRouteJsGzipBytes: 435 * 1024,
  cssGzipBytes: 48 * 1024,
  largestJsChunkGzipBytes: 200 * 1024,
};
const measurements = {
  initialJsGzipBytes: homepageMeasurement.bytes,
  maxRouteJsGzipBytes: heaviestRoute.bytes,
  cssGzipBytes,
  largestJsChunkGzipBytes: largestJsChunk.bytes,
};
const violations = Object.entries(measurements)
  .filter(([name, bytes]) => bytes > budgets[name])
  .map(([name, bytes]) => `${name}: ${bytes} > ${budgets[name]}`);

if (violations.length > 0) {
  console.error(
    `Performance budget failed: initial=${homepageMeasurement.bytes}, maxRoute=${heaviestRoute.route}:${heaviestRoute.bytes}, union=${totalJsGzipBytes}, css=${cssGzipBytes}, largest=${largestJsChunk.asset}:${largestJsChunk.bytes}.\n${violations.map((item) => `- ${item}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  const rawBytes = (await Promise.all(jsAssets.map((asset) => stat(asset)))).reduce(
    (sum, item) => sum + item.size,
    0,
  );
  console.log(
    `Performance budget passed: initial=${homepageMeasurement.bytes}, maxRoute=${heaviestRoute.route}:${heaviestRoute.bytes}, union=${totalJsGzipBytes}, css=${cssGzipBytes}, largest=${largestJsChunk.asset}:${largestJsChunk.bytes}, rawJs=${rawBytes}.`,
  );
}
