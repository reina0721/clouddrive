import { access, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadWebConfig } from '@clouddrive/config/node';

const webRoot = resolve(import.meta.dirname, '../apps/web');
const config = loadWebConfig({ cwd: webRoot });
if (config.deploymentMode === 'server') {
  const dist = resolve(webRoot, config.distDir ?? 'dist');
  const runtime = resolve(dist, 'standalone/apps/web');
  // Next traces runtime dependencies; public and static assets are deliberately
  // omitted. Complete that documented layout so a single directory can ship.
  await access(resolve(runtime, 'server.js'));
  await cp(resolve(webRoot, 'public'), resolve(runtime, 'public'), { recursive: true });
  await cp(resolve(dist, 'static'), resolve(runtime, config.distDir ?? 'dist', 'static'), {
    recursive: true,
  });
  console.log(`Standalone runtime ready: ${runtime}/server.js`);
}
