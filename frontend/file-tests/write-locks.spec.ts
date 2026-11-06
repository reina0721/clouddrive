import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

type Entry = { id: string; name: string; contentRevision: number };
type Connection = { id: string; password: string; endpointPath: string; endpointOrigin: string };
type Lock = { id: string; path: string; connectionId: string; revision: number };
const lockXML =
  '<lockinfo xmlns="DAV:"><lockscope><exclusive/></lockscope><locktype><write/></locktype><owner><href>browser-fixture</href></owner></lockinfo>';

async function login(page: Page) {
  if (!process.env.CLOUDDRIVE_FILE_TEST_ACCESS) throw Error('必须使用隔离文件账号');
  const access = JSON.parse(
    (await readFile(process.env.CLOUDDRIVE_FILE_TEST_ACCESS, 'utf8')).replace(/^\uFEFF/, ''),
  ) as { url: string; username: string; password: string };
  if (new URL(access.url).origin !== 'http://127.0.0.1:4194') throw Error('只允许隔离QA');
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}

async function request(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const result = await fetch('/api/console/v1/native/files' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: result.status, value: (await result.json()) as unknown };
    },
    { path, method, body },
  );
}
async function api<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  const result = await request(page, path, method, body);
  expect(result.status, method + ' ' + path.split('?')[0]).toBe(200);
  return result.value as T;
}
async function dav(
  page: Page,
  connection: Connection,
  method: string,
  name: string,
  data?: string,
  headers: Record<string, string> = {},
) {
  if (connection.endpointOrigin !== 'http://127.0.0.1:8131') throw Error('只允许隔离WebDAV');
  return page.request.fetch(connection.endpointOrigin + connection.endpointPath + name, {
    method,
    headers: {
      Authorization:
        'Basic ' + Buffer.from(connection.id + ':' + connection.password).toString('base64'),
      ...(data === undefined ? {} : { 'Content-Type': 'application/xml' }),
      ...headers,
    },
    ...(data === undefined ? {} : { data }),
  });
}
async function fixture(page: Page) {
  const root = await api<Entry>(page, '/folders', 'POST', {
    name: '锁-' + randomUUID().slice(0, 8),
    parentId: '',
  });
  const file = await api<Entry>(page, '/text', 'POST', {
    name: 'note.txt',
    parentId: root.id,
    text: 'original',
    key: randomUUID(),
  });
  const connection = await api<Connection>(page, '/connections', 'POST', {
    name: '外部编辑器-' + root.name,
    rootId: root.id,
    readOnly: false,
    blockSystemFiles: true,
  });
  const response = await dav(page, connection, 'LOCK', file.name, lockXML, { Depth: '0' });
  expect(response.status()).toBe(200);
  const token = response.headers()['lock-token'];
  expect(typeof token).toBe('string');
  return { root, file, connection, token };
}

test('F418–419：真实占用列表、续期CAS冲突、刷新后解除并恢复保存', async ({ page }) => {
  await login(page);
  const { file, connection, token } = await fixture(page);
  await page.goto('/home/connections');
  await page.getByRole('button', { name: '文件锁', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '文件锁', exact: true });
  // 只选择本次连接，避免其他串行场景尚未到期的合法锁影响结果。
  const ownLock = (await api<{ items: Lock[] }>(page, '/write-locks')).items.find(
    (lock) => lock.connectionId === connection.id,
  )!;
  const ownRow = panel.getByRole('listitem').filter({ hasText: ownLock.path });
  await expect(ownRow).toBeVisible();
  const blocked = await request(page, '/' + file.id + '/text', 'PUT', {
    expectedRevision: 1,
    text: 'blocked',
  });
  expect(blocked.status).toBe(423);
  expect(JSON.stringify(blocked.value)).toContain('files_write_locked');
  expect(
    (
      await dav(page, connection, 'LOCK', file.name, undefined, {
        If: '(' + token + ')',
        Timeout: 'Second-600',
      })
    ).status(),
  ).toBe(200);
  await ownRow.getByRole('button', { name: /^解除占用/ }).click();
  const confirm = page.getByRole('dialog', { name: '解除文件锁', exact: true });
  await confirm.getByRole('button', { name: '解除占用', exact: true }).click();
  await expect(confirm.getByRole('alert')).toContainText('占用已经续期或改变');
  await expect(confirm.getByRole('alert')).toBeInViewport();
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  await panel.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(panel.getByText('正在读取文件锁…', { exact: true })).toHaveCount(0);
  await ownRow.getByRole('button', { name: /^解除占用/ }).click();
  await page
    .getByRole('dialog', { name: '解除文件锁', exact: true })
    .getByRole('button', { name: '解除占用', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: '解除文件锁', exact: true })).toHaveCount(0);
  await expect(ownRow).toHaveCount(0);
  expect(
    (
      await request(page, '/' + file.id + '/text', 'PUT', {
        expectedRevision: 1,
        text: 'after release',
      })
    ).status,
  ).toBe(200);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
});

test('F418：读取失败保留明确重试动作，不用空列表伪装成功', async ({ page }) => {
  await login(page);
  const { root } = await fixture(page);
  await page.goto('/home/connections');
  await page.route('**/api/console/v1/native/files/write-locks', async (route) =>
    route.abort('failed'),
  );
  await page.getByRole('button', { name: '文件锁', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '文件锁', exact: true });
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByText('当前没有有效的文件锁', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/console/v1/native/files/write-locks');
  await panel.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(panel.getByText('外部编辑器-' + root.name, { exact: true })).toBeVisible();
});

test('F420：320px英文深色与解除失败提示无溢出、键盘和读屏可访问', async ({ page }, info) => {
  await login(page);
  const { connection } = await fixture(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.goto('/settings/locale');
  await page
    .getByRole('radiogroup', { name: '界面语言', exact: true })
    .getByText('English', { exact: true })
    .click();
  await page.goto('/home/connections');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'File locks', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'File locks', exact: true });
  const ownLock = (await api<{ items: Lock[] }>(page, '/write-locks')).items.find(
    (lock) => lock.connectionId === connection.id,
  )!;
  const ownRow = panel.getByRole('listitem').filter({ hasText: ownLock.path });
  await expect(ownRow).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('write-locks-mobile-dark-english.png') });
  await page.route('**/api/console/v1/native/files/write-locks/*/release', async (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: JSON.stringify({ code: 'files_unavailable' }),
    }),
  );
  await ownRow.getByRole('button', { name: /^Release lock/ }).click();
  const confirm = page.getByRole('dialog', { name: 'Release file lock', exact: true });
  await confirm.getByRole('button', { name: 'Release lock', exact: true }).click();
  await expect(confirm.getByRole('alert')).toBeInViewport();
  await expect(confirm.getByRole('alert')).toContainText('service is unavailable');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('write-locks-error-mobile-dark-english.png') });
  await page.keyboard.press('Escape');
  await expect(confirm).toHaveCount(0);
});
