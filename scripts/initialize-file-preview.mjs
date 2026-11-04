import { readFile, writeFile, access as fileAccess } from 'node:fs/promises';
import { join } from 'node:path';

// 隔离预览的初始化与验证共用浏览器协议，不输出请求体、Cookie 或令牌。
try {
  const configuration = JSON.parse((await readFile(process.argv[2], 'utf8')).replace(/^\uFEFF/, ''));
  const base = configuration.apiUrl + '/api/console/v1';
  const requestTimeoutMs = 15_000;
  const csrf = await fetch(base + '/auth/csrf', { signal: AbortSignal.timeout(requestTimeoutMs) });
  if (!csrf.ok) throw new Error('Preview CSRF request failed');
  const token = (await csrf.json()).token;
  const cookies = csrf.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
  const headers = { Origin: configuration.apiUrl, Cookie: cookies, 'Content-Type': 'application/json', 'X-CSRF-Token': token };
  const marker = join(configuration.dataDirectory, 'initialized');
  let initialized = true;
  try { await fileAccess(marker); } catch (error) { if (error.code === 'ENOENT') initialized = false; else throw error; }
  const login = { email: configuration.username, password: configuration.password };
  if (!initialized) {
    const setup = await fetch(base + '/auth/setup', { method: 'POST', headers, body: JSON.stringify({ ...login, name: '预览管理员', setupToken: configuration.setupToken }), signal: AbortSignal.timeout(requestTimeoutMs) });
    await setup.arrayBuffer();
    if (!setup.ok && setup.status !== 409) throw new Error('Preview initialization failed: ' + setup.status);
  }
  const response = await fetch(base + '/auth/login', { method: 'POST', headers, body: JSON.stringify(login), signal: AbortSignal.timeout(requestTimeoutMs) });
  if (!response.ok) throw new Error('Preview login verification failed: ' + response.status);
  const session = await response.json();
  configuration.apiSession = {
    cookieHeader: [cookies, ...response.headers.getSetCookie().map((cookie) => cookie.split(';')[0])].filter(Boolean).join('; '),
    csrfToken: token,
    expiresAt: session.expiresAt,
  };
  configuration.updatedAt = new Date().toISOString();
  await writeFile(process.argv[2], JSON.stringify(configuration, null, 2) + '\n');
  await writeFile(marker, new Date().toISOString());
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith('Preview ') ? error.message : 'Preview initialization could not finish');
  process.exitCode = 1;
}
