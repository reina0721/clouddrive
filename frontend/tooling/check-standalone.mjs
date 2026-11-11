import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { access, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { loadWebConfig } from '@clouddrive/config/node';

const webRoot = resolve(import.meta.dirname, '../apps/web');
const config = loadWebConfig({ cwd: webRoot });
if (config.deploymentMode !== 'server') throw new Error('Standalone check requires server mode.');
const source = resolve(webRoot, config.distDir ?? 'dist', 'standalone');
await access(join(source, 'apps/web/server.js'));
// Outside the repository: missing traced dependencies cannot resolve through the
// developer's node_modules. Preserve the trace's relative symlinks on relocation.
const temporary = await mkdtemp(join(tmpdir(), 'clouddrive-runtime-'));
const runtime = join(temporary, 'runtime');
const resources = [];

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  return `http://127.0.0.1:${port}`;
}

async function backend(name) {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    if (request.url.startsWith('/api/stream')) {
      response.writeHead(206, {
        'Content-Type': 'application/octet-stream',
        'Content-Range': 'bytes 0-131071/131072',
      });
      for (let index = 0; index < 16; index++) response.write(Buffer.alloc(8192, index));
      response.end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': ['session=test; HttpOnly; SameSite=Lax; Path=/', 'csrf=test; Path=/'],
    });
    response.end(
      JSON.stringify({
        name,
        url: request.url,
        method: request.method,
        headers: request.headers,
        body,
      }),
    );
  });
  resources.push(async () => {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  });
  return listen(server);
}

async function start(upstream) {
  const reservation = createServer();
  const origin = await listen(reservation);
  await new Promise((done) => reservation.close(done));
  const child = spawn(process.execPath, ['apps/web/server.js'], {
    cwd: runtime,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: new URL(origin).port,
      CLOUDDRIVE_BACKEND_URL: upstream,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      logs = (logs + chunk).slice(-8000);
    });
  }
  const exited = once(child, 'exit');
  resources.push(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGTERM');
    const force = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      await exited;
    } finally {
      clearTimeout(force);
    }
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(logs);
    try {
      const response = await fetch(origin + '/login', { signal: AbortSignal.timeout(1000) });
      await response.arrayBuffer();
      if (response.ok) return origin;
    } catch {
      /* wait for the specific child started above */
    }
    await delay(100);
  }
  throw new Error(`Standalone startup timed out.\n${logs}`);
}

try {
  await cp(source, runtime, { recursive: true, verbatimSymlinks: true });
  const upstreamA = await backend('a');
  const upstreamB = await backend('b');
  const originA = await start(upstreamA);
  const originB = await start(upstreamB);
  for (const [origin, name] of [
    [originA, 'a'],
    [originB, 'b'],
  ]) {
    for (const path of [
      '/api/echo?name=a%2Fb',
      '/wopi/files/a?access_token=test',
      '/management/healthz',
    ]) {
      const response = await fetch(origin + path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Cookie: 'session=test',
          Origin: origin,
          'X-CSRF-Token': 'test',
        },
        body: 'streamed-body-' + 'x'.repeat(32 * 1024),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.getSetCookie().length, 2);
      const echo = await response.json();
      assert.equal(echo.name, name, 'upstream must come from the runtime environment');
      assert.equal(echo.url, path);
      assert.equal(echo.method, 'POST');
      assert.equal(echo.headers.cookie, 'session=test');
      assert.equal(echo.headers.origin, origin);
      assert.equal(echo.headers['x-csrf-token'], 'test');
      assert.equal(echo.body, 'streamed-body-' + 'x'.repeat(32 * 1024));
    }
    const streamed = await fetch(origin + '/api/stream', { headers: { Range: 'bytes=0-131071' } });
    assert.equal(streamed.status, 206);
    assert.equal(streamed.headers.get('content-range'), 'bytes 0-131071/131072');
    const bytes = Buffer.from(await streamed.arrayBuffer());
    assert.deepEqual(
      bytes,
      Buffer.concat(Array.from({ length: 16 }, (_, index) => Buffer.alloc(8192, index))),
    );
  }
  const html = await (await fetch(originA + '/login')).text();
  const assets = [...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(assets.length > 0, 'page must reference compiled assets');
  for (const asset of new Set(assets)) {
    const response = await fetch(new URL(asset, originA));
    assert.equal(response.status, 200, asset);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
  const pdfConfig = JSON.parse(
    await readFile(resolve(webRoot, 'src/files/pdf/assets.json'), 'utf8'),
  );
  const pdfPath = '/' + pdfConfig.publicPath.replace(/^\/+|\/+$/g, '') + '/';
  for (const asset of [
    'index.html',
    'protocol.js',
    'assets/pdf.min.mjs',
    'assets/pdf.worker.min.mjs',
  ]) {
    const response = await fetch(originA + pdfPath + asset);
    assert.equal(response.status, 200, asset);
    if (asset === 'index.html')
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    await response.arrayBuffer();
  }
  console.log(
    'Standalone passed: relocated runtime, two upstreams, cookies/CSRF, POST bodies, range bytes, page assets and local PDF worker.',
  );
} finally {
  for (const dispose of resources.reverse()) await dispose();
  await rm(temporary, { recursive: true, force: true });
}
