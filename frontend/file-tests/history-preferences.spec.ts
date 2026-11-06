import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

type Rule = { revision: number; enabled: boolean; extensions: string[]; maxVersions: number };
type Entry = { id: string; name: string; parentId: string; contentRevision: number };
type Versions = {
  total: number;
  contentRevision: number;
  historyRevision: number;
  ownerUsedBytes: number;
  historyApplies: boolean;
  items: { revision: number; current: boolean; sizeBytes: number }[];
};
test.use({ actionTimeout: 15000 });
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
async function rule(page: Page, change: Partial<Rule> = {}) {
  const current = await api<Rule>(page, '/preferences/history');
  return api<Rule>(page, '/preferences/history', 'PUT', {
    ...current,
    enabled: true,
    extensions: [],
    maxVersions: 0,
    ...change,
  });
}
async function fixture(page: Page) {
  const root = await api<Entry>(page, '/folders', 'POST', {
    parentId: '',
    name: '保留-' + randomUUID().slice(0, 8),
  });
  const file = await api<Entry>(page, '/text', 'POST', {
    parentId: root.id,
    name: 'history.txt',
    key: randomUUID(),
    text: 'first',
  });
  return { root, file };
}
async function replace(page: Page, file: Entry, text: string) {
  return api<Entry>(page, '/' + file.id + '/text', 'PUT', {
    expectedRevision: file.contentRevision,
    text,
  });
}
async function versions(page: Page, file: Entry) {
  return api<Versions>(page, '/' + file.id + '/versions');
}
async function settings(page: Page) {
  await page.getByRole('button', { name: '版本保留设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '版本保留设置', exact: true });
  await expect(dialog.getByRole('button', { name: '保存版本规则', exact: true })).toBeEnabled();
  return dialog;
}

test('F381–387：真实设置读取、规范化、非法阻止、持久化与保存不清理', async ({ page }) => {
  await login(page);
  await rule(page);
  const { file } = await fixture(page);
  let current = await replace(page, file, 'second');
  current = await replace(page, current, 'third');
  const before = await versions(page, current);
  const dialog = await settings(page);
  await dialog.getByLabel('启用的文件扩展名', { exact: true }).fill('.TXT, md');
  await dialog.getByLabel('最多保留旧版本数', { exact: true }).fill('1');
  await dialog.getByRole('button', { name: '保存版本规则', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await api<Rule>(page, '/preferences/history')).toMatchObject({
    extensions: ['txt', 'md'],
    maxVersions: 1,
  });
  expect((await versions(page, current)).total).toBe(before.total);
  await page.reload();
  const again = await settings(page);
  await expect(again.getByLabel('启用的文件扩展名', { exact: true })).toHaveValue('txt, md');
  await again.getByLabel('启用的文件扩展名', { exact: true }).fill('txt,TXT');
  let writes = 0;
  page.on('request', (r) => {
    if (r.method() === 'PUT' && new URL(r.url()).pathname.endsWith('/preferences/history'))
      writes++;
  });
  await again.getByRole('button', { name: '保存版本规则', exact: true }).click();
  await expect(again.getByRole('alert')).toContainText('请检查扩展名及数量');
  await expect(again.getByRole('alert')).toBeInViewport();
  expect(writes).toBe(0);
  await expect(again.getByLabel('启用的文件扩展名', { exact: true })).toHaveValue('txt,TXT');
});

test('F388–391/396/399：真实文本裁剪与配额、关闭/扩展排除、失败及恢复', async ({ page }) => {
  await login(page);
  await rule(page, { maxVersions: 2 });
  const { file } = await fixture(page);
  let current = file;
  for (const text of ['second', 'third', 'fourth']) current = await replace(page, current, text);
  let history = await versions(page, current);
  expect(history.items.map((v) => v.revision)).toEqual([4, 3, 2]);
  expect(history.historyApplies).toBe(true);
  expect(history.items.reduce((sum, v) => sum + v.sizeBytes, 0)).toBe(17);
  const before = history;
  const rejected = await request(page, '/' + current.id + '/text', 'PUT', {
    expectedRevision: 1,
    text: 'stale',
  });
  expect(rejected.status).toBe(409);
  expect(await versions(page, current)).toEqual(before);
  await rule(page, { enabled: false, maxVersions: 1 });
  current = await replace(page, current, 'fifth');
  history = await versions(page, current);
  expect(history.total).toBe(3);
  expect(history.historyRevision).toBe(before.historyRevision);
  expect(history.historyApplies).toBe(false);
  current = await api<Entry>(page, '/' + current.id + '/versions/2/restore', 'POST', {
    expectedContentRevision: current.contentRevision,
    expectedHistoryRevision: history.historyRevision,
  });
  expect((await versions(page, current)).total).toBe(3);
  await rule(page, { extensions: ['md'], maxVersions: 1 });
  current = await replace(page, current, 'excluded');
  expect((await versions(page, current)).total).toBe(3);
  await rule(page, { extensions: ['txt'], maxVersions: 1 });
  current = await replace(page, current, 'included');
  expect((await versions(page, current)).total).toBe(2);
});

test('F392/397：真实tus覆盖及上传期间规则变化在最终保存时执行', async ({ page }) => {
  await login(page);
  await rule(page, { maxVersions: 1 });
  const { root, file } = await fixture(page);
  await page.goto('/home?parent=' + root.id);
  for (let iteration = 0; iteration < 2; iteration++) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: file.name + ' 的操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '上传新版本', exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: 'source.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('uploaded-' + iteration),
    });
    const tray = page.getByRole('dialog', { name: '上传队列', exact: true });
    if (!(await tray.isVisible())) await page.getByRole('button', { name: /^上传队列/ }).click();
    await expect(page.getByText('上传完成', { exact: true })).toHaveCount(iteration + 1);
    await tray.getByRole('button', { name: '关闭', exact: true }).click();
  }
  expect((await versions(page, file)).items.map((v) => v.revision)).toEqual([3, 2]);
  // 在真实新会话admission之后改变规则；最终提交不能沿用创建时的保留开关。
  let pausedResolve: () => void = () => {};
  const reached = new Promise<void>((resolve) => {
    pausedResolve = resolve;
  });
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    '**/files/transfers/*/commit',
    async (route) => {
      pausedResolve();
      await gate;
      await route.continue();
    },
    { times: 1 },
  );
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: file.name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传新版本', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'source.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('final changed policy'),
  });
  await reached;
  await rule(page, { enabled: false });
  release();
  if (!(await page.getByRole('dialog', { name: '上传队列', exact: true }).isVisible()))
    await page.getByRole('button', { name: /^上传队列/ }).click();
  await expect(page.getByText('上传完成', { exact: true })).toHaveCount(3);
  const history = await versions(page, file);
  expect(history.items.map((v) => v.revision)).toEqual([4, 2]);
  expect(history.historyApplies).toBe(false);
});

test('F393/394：真实WebDAV PUT和COPY覆盖执行相同账号规则', async ({ page }) => {
  await login(page);
  await rule(page, { maxVersions: 1 });
  const { root, file } = await fixture(page);
  const connection = await api<{
    id: string;
    password: string;
    endpointOrigin: string;
    endpointPath: string;
  }>(page, '/connections', 'POST', {
    rootId: root.id,
    name: '保留验收',
    readOnly: false,
    blockSystemFiles: false,
  });
  const headers = {
    Authorization:
      'Basic ' + Buffer.from(connection.id + ':' + connection.password).toString('base64'),
  };
  const endpoint = new URL(connection.endpointPath, connection.endpointOrigin).href;
  for (const value of ['dav-second', 'dav-third'])
    expect(
      (await page.request.put(endpoint + 'history.txt', { headers, data: value })).status(),
    ).toBe(204);
  expect((await versions(page, file)).items.map((v) => v.revision)).toEqual([3, 2]);
  expect(
    (await page.request.put(endpoint + 'source.txt', { headers, data: 'copied bytes' })).status(),
  ).toBe(201);
  expect(
    (
      await page.request.fetch(endpoint + 'source.txt', {
        method: 'COPY',
        headers: { ...headers, Destination: endpoint + 'history.txt', Overwrite: 'T' },
      })
    ).status(),
  ).toBe(204);
  expect((await versions(page, file)).items.map((v) => v.revision)).toEqual([4, 3]);
  expect(await (await page.request.get(endpoint + 'history.txt', { headers })).text()).toBe(
    'copied bytes',
  );
  await rule(page, { enabled: false });
  expect(
    (await page.request.put(endpoint + 'history.txt', { headers, data: 'disabled' })).status(),
  ).toBe(204);
  expect((await versions(page, file)).items.map((v) => v.revision)).toEqual([5, 3]);
});

test('F395：真实分享文字写入使用拥有者策略，匿名不能访问私有设置', async ({ page, browser }) => {
  await login(page);
  await rule(page, { maxVersions: 1 });
  const { root, file } = await fixture(page);
  const permissions = {
    browse: true,
    preview: true,
    download: true,
    create: true,
    upload: true,
    modify: true,
    rename: true,
    move: true,
    copy: true,
    delete: true,
  };
  const share = await api<{ token: string }>(page, '/shares', 'POST', {
    rootId: root.id,
    title: '保留分享',
    password: '',
    permissions,
    audience: { anonymous: null, authenticated: null, accounts: [], roles: [] },
  });
  const context = await browser.newContext();
  try {
    const visitor = await context.newPage();
    await visitor.goto(new URL('/share/' + share.token, page.url()).href);
    for (let revision = 1; revision <= 3; revision++) {
      const response = await visitor.request.put(
        new URL('/api/v1/file-shares/' + share.token + '/text/' + file.id, page.url()).href,
        {
          data: { revision, text: 'visitor-' + revision },
          headers: { Origin: new URL(page.url()).origin },
        },
      );
      expect(response.status()).toBe(200);
    }
    expect((await versions(page, file)).items.map((v) => v.revision)).toEqual([4, 3]);
    expect(
      (
        await visitor.request.get(
          new URL('/api/console/v1/native/files/preferences/history', page.url()).href,
        )
      ).status(),
    ).toBe(401);
  } finally {
    await context.close();
  }
});

test('F398：真实CAS冲突和读取/保存失败保留草稿并明确恢复', async ({ page }) => {
  await login(page);
  await rule(page);
  let dialog = await settings(page);
  await dialog.getByLabel('最多保留旧版本数', { exact: true }).fill('2');
  await rule(page, { maxVersions: 3 });
  await dialog.getByRole('button', { name: '保存版本规则', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('设置已被另一处修改');
  await expect(dialog.getByRole('alert')).toBeInViewport();
  await expect(dialog.getByLabel('最多保留旧版本数', { exact: true })).toHaveValue('2');
  await dialog.getByRole('button', { name: '读取最新设置', exact: true }).click();
  await expect(dialog.getByLabel('最多保留旧版本数', { exact: true })).toHaveValue('3');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.route('**/native/files/preferences/history', (route) => route.abort(), { times: 1 });
  await page.getByRole('button', { name: '版本保留设置', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '版本保留设置', exact: true });
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '保存版本规则', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '重新读取', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '保存版本规则', exact: true })).toBeEnabled();
  await dialog.getByLabel('最多保留旧版本数', { exact: true }).fill('4');
  await page.route('**/native/files/preferences/history', (route) => route.abort(), { times: 1 });
  await dialog.getByRole('button', { name: '保存版本规则', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('最多保留旧版本数', { exact: true })).toHaveValue('4');
  expect((await api<Rule>(page, '/preferences/history')).maxVersions).toBe(3);
});

test('F400：英文深色320px设置与版本解释无溢出、可访问', async ({ page }, info) => {
  await login(page);
  await rule(page, { maxVersions: 2 });
  const { root, file } = await fixture(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.goto('/settings/locale');
  await page
    .getByRole('radiogroup', { name: '界面语言', exact: true })
    .getByText('English', { exact: true })
    .click();
  await page.goto('/home?parent=' + root.id);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Version retention settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Version retention settings', exact: true });
  await expect(
    dialog.getByRole('button', { name: 'Save version rules', exact: true }),
  ).toBeEnabled();
  await expect(dialog).toContainText('future successful replacements remove the oldest');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('history-settings-mobile-dark-english.png') });
  await dialog.getByLabel('Maximum old versions', { exact: true }).fill('21');
  await dialog.getByRole('button', { name: 'Save version rules', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeInViewport();
  await expect(dialog.getByRole('alert')).toContainText('Check extensions and count');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('history-error-mobile-dark-english.png') });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for ' + file.name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Version history', exact: true }).click();
  await expect(
    page.getByText('Future replacements of this file keep history.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Keep the latest 2 old versions on successful replacement.', { exact: true }),
  ).toBeVisible();
});
