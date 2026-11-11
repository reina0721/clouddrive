import { shareMenuAction } from './share-actions';
import { readPreviewAccess } from './reading-fixture';
import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';

test.use({ actionTimeout: 15_000 });
type Entry = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  trashedAt?: string;
  contentRevision: number;
};
let source: Server;
let sourceOrigin = '';
test.beforeAll(async () => {
  source = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    response.end('real timezone download');
  });
  await new Promise<void>((ready) => source.listen(0, '127.0.0.1', ready));
  const address = source.address();
  if (!address || typeof address === 'string') throw new Error('时间验收来源未启动');
  sourceOrigin = 'http://127.0.0.1:' + address.port;
});
test.afterAll(async () => {
  source.closeAllConnections();
  await new Promise<void>((done, reject) =>
    source.close((error) => (error ? reject(error) : done())),
  );
});
async function login(page: Page) {
  if (!process.env.CLOUDDRIVE_FILE_TEST_ACCESS) throw new Error('需要隔离账号文件');
  const access = JSON.parse(
    (await readFile(process.env.CLOUDDRIVE_FILE_TEST_ACCESS, 'utf8')).replace(/^\uFEFF/, ''),
  ) as { username: string; password: string };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function api<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, value: (await response.json()) as unknown };
    },
    { path, method, body },
  );
  expect(result.status, method + ' ' + path.split('?')[0]).toBe(200);
  return result.value as T;
}
async function fixture(page: Page) {
  const suffix = randomUUID().slice(0, 8);
  const root = await api<Entry>(page, '/folders', 'POST', { parentId: '', name: '时区-' + suffix });
  const file = await api<Entry>(page, '/text', 'POST', {
    parentId: root.id,
    name: '日期-' + suffix + '.txt',
    text: 'original instant',
    key: randomUUID(),
  });
  return { root, file };
}
async function select(page: Page, label: string, option: string, scope: Page | Locator = page) {
  await scope.getByRole('button', { name: new RegExp(label + '$') }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function zone(page: Page, value: string, dateFormat = 'YYYY-MM-DD') {
  await page.goto('/settings/locale');
  const field = page.getByRole('combobox', { name: '时区', exact: true });
  await field.fill(value === 'auto' ? '自动' : value);
  await page
    .getByRole('option', { name: value === 'auto' ? '自动（跟随系统）' : value, exact: true })
    .click();
  await select(page, '日期格式', dateFormat);
  await page
    .getByRole('radiogroup', { name: '时间格式', exact: true })
    .getByText('24 小时制', { exact: true })
    .click();
  const seconds = page.getByRole('switch', { name: '显示秒', exact: true });
  if (!(await seconds.isChecked())) await seconds.press('Space');
}
// 此夹具只比较三个无DST的固定偏移区，用独立算术验证数据流，不调用生产格式化器。
const fixtureOffsetMinutes: Readonly<Record<string, number>> = {
  'Pacific/Kiritimati': 14 * 60,
  'Pacific/Honolulu': -10 * 60,
  'Asia/Kathmandu': 5 * 60 + 45,
};
function fixtureLocalISO(value: string, timeZone: string) {
  const minutes = fixtureOffsetMinutes[timeZone];
  if (minutes === undefined) throw new Error('该测试区没有独立固定偏移基准');
  return new Date(Date.parse(value) + minutes * 60 * 1000).toISOString();
}
function date(value: string, timeZone: string) {
  return fixtureLocalISO(value, timeZone).slice(0, 10);
}
function full(value: string, timeZone: string) {
  return date(value, timeZone) + ' · ' + fixtureLocalISO(value, timeZone).slice(11, 19);
}
async function action(page: Page, name: string, label: string) {
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
async function customShare(page: Page, file: Entry) {
  await action(page, file.name, '分享');
  const dialog = page.getByRole('dialog', { name: '分享', exact: true });
  await select(page, '有效期', '指定到期时间', dialog);
  return dialog;
}
async function calendarDate(dialog: Locator, day: string) {
  const [year, month, date] = day.split('-');
  for (const [name, value] of [
    [/^(年|year),/i, year],
    [/^(月|month),/i, month],
    [/^(日|day),/i, date],
  ] as const) {
    const segment = dialog.getByRole('spinbutton', { name });
    await segment.press('ControlOrMeta+a');
    await segment.pressSequentially(value!);
    await segment.press('Tab');
    await expect(segment).toHaveAttribute('aria-valuenow', String(Number(value)));
  }
}
const permissions = {
  browse: true,
  preview: true,
  download: true,
  create: false,
  upload: false,
  modify: false,
  rename: false,
  move: false,
  copy: false,
  delete: false,
};
const audience = { anonymous: null, authenticated: null, accounts: [], roles: [] };

test('F361–367：真实文件时间随区域设置变化、列表列与属性一致，回收日期正确', async ({
  page,
}, info) => {
  await login(page);
  const { root, file } = await fixture(page);
  const changed = await api<Entry>(page, '/' + file.id + '/text', 'PUT', {
    expectedRevision: 1,
    text: 'changed instant',
  });
  await zone(page, 'Pacific/Kiritimati');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '时区', exact: true })).toHaveValue(
    'Pacific/Kiritimati',
  );
  await page.goto('/home?parent=' + root.id);
  const row = page.locator('[data-file-item="' + file.id + '"]');
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '列表', exact: true }).click();
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '视图选项', exact: true }).click();
  const options = page.getByRole('dialog', { name: '视图选项', exact: true });
  for (const name of ['创建日期', '修改日期']) {
    const field = options.getByRole('checkbox', { name, exact: true });
    if (!(await field.isChecked())) await field.press('Space');
  }
  await options.getByRole('button', { name: '保存', exact: true }).click();
  await expect(options).toHaveCount(0);
  await expect(row).toHaveAttribute('role', 'row');
  await expect(
    row.getByRole('cell').filter({ hasText: date(file.createdAt, 'Pacific/Kiritimati') }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '网格', exact: true }).click();
  await expect(row.locator('p[title]')).toHaveAttribute(
    'title',
    full(changed.updatedAt, 'Pacific/Kiritimati'),
  );
  await action(page, file.name, '属性');
  const details = page.getByRole('dialog', { name: file.name, exact: true });
  await expect(details).toContainText(full(file.createdAt, 'Pacific/Kiritimati'));
  await expect(details).toContainText(full(changed.updatedAt, 'Pacific/Kiritimati'));
  await details.getByRole('button', { name: '关闭', exact: true }).click();
  await zone(page, 'Pacific/Honolulu');
  await page.goto('/home?parent=' + root.id);
  await expect(row.locator('p[title]')).toHaveText(date(changed.updatedAt, 'Pacific/Honolulu'));
  const trashed = await api<Entry>(page, '/' + file.id + '/trash', 'POST');
  if (!trashed.trashedAt) throw new Error('真实回收时间缺失');
  await page.goto('/home?trash=true');
  await expect(row.locator('p[title]')).toHaveAttribute(
    'title',
    full(trashed.trashedAt, 'Pacific/Honolulu'),
  );
  await page.screenshot({ path: info.outputPath('file-dates.png') });
});

test('F368–372：真实版本、分享列表/详情和WebDAV连接采用同一时区', async ({ page }) => {
  await login(page);
  const { root, file } = await fixture(page);
  await api(page, '/' + file.id + '/text', 'PUT', { expectedRevision: 1, text: 'version two' });
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const share = await api<{ id: string; createdAt: string; expiresAt: string }>(
    page,
    '/shares',
    'POST',
    {
      rootId: root.id,
      title: '时区分享-' + root.id,
      password: '',
      permissions,
      audience,
      expiresAt,
    },
  );
  const connection = await api<{ id: string; createdAt: string; expiresAt: string }>(
    page,
    '/connections',
    'POST',
    { name: '时区连接-' + root.id, rootId: root.id, readOnly: true, blockSystemFiles: true },
  );
  await zone(page, 'Asia/Katmandu');
  await page.goto('/home?parent=' + root.id);
  await action(page, file.name, '版本历史');
  await expect(page.locator('[data-file-version="1"]')).toContainText(
    full(file.updatedAt, 'Asia/Kathmandu'),
  );
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await page.goto('/home/shares');
  const item = page.locator('[data-share-id="' + share.id + '"]');
  await expect(item).toContainText(full(share.expiresAt, 'Asia/Kathmandu'));
  await item.getByRole('button', { name: /^查看 .* 的分享详情$/ }).click();
  await expect(page.getByRole('dialog')).toContainText(full(share.createdAt, 'Asia/Kathmandu'));
  await expect(page.getByRole('dialog')).toContainText(full(share.expiresAt, 'Asia/Kathmandu'));
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await page.goto('/home/connections');
  await expect(page.locator('body')).toContainText(full(connection.createdAt, 'Asia/Kathmandu'));
  await expect(page.locator('body')).toContainText(full(connection.expiresAt, 'Asia/Kathmandu'));
});

test('F373/374：真实下载详情和持久传输会话的到期时间', async ({ page }) => {
  if (process.env.CLOUDDRIVE_FILE_TEST_OFFLINE_SOURCE_ALLOWED !== '1')
    throw new Error('需要隔离QA的本地来源授权');
  await login(page);
  const { root } = await fixture(page);
  const created = await api<{ items: { task?: { id: string }; id?: string }[] }>(
    page,
    '/downloads/batch-create',
    'POST',
    {
      items: [
        {
          uri: sourceOrigin + '/time.txt',
          name: '时区下载-' + root.id + '.txt',
          parentId: root.id,
          clientKey: randomUUID(),
        },
      ],
    },
  );
  const id = created.items[0]!.task?.id ?? created.items[0]!.id;
  if (!id) throw new Error('下载夹具没有返回任务');
  let task: {
    state: string;
    createdAt: string;
    startedAt: string;
    finishedAt: string;
    expiresAt: string;
  };
  await expect
    .poll(async () => {
      task = await api(page, '/downloads/' + id);
      return task.state;
    })
    .toBe('completed');
  const content = Buffer.from('pending time upload');
  const transfer = await api<{ id: string; expiresAt: string }>(page, '/transfers', 'POST', {
    parentId: root.id,
    name: '时区待传-' + root.id + '.txt',
    sizeBytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
    key: randomUUID(),
  });
  await zone(page, 'Asia/Katmandu');
  await page.goto('/home/downloads');
  await page
    .locator('[data-download-id="' + id + '"]')
    .getByRole('button', { name: '任务详情', exact: true })
    .click();
  const details = page.getByRole('dialog');
  for (const value of [task!.createdAt, task!.startedAt, task!.finishedAt, task!.expiresAt])
    await expect(details).toContainText(full(value, 'Asia/Kathmandu'));
  await details.getByRole('button', { name: '关闭', exact: true }).click();
  await page.goto('/home/transfers');
  await expect(
    page.locator('[data-transfer-id]').filter({ hasText: '时区待传-' + root.id }),
  ).toContainText(full(transfer.expiresAt, 'Asia/Kathmandu'));
  await page
    .locator('[data-transfer-id]')
    .filter({ hasText: '时区待传-' + root.id })
    .getByRole('button', { name: '取消', exact: true })
    .click();
});

test('F375/376：自定义分享真实保存转换后的时刻，编辑保持原秒精度', async ({ page }, info) => {
  await login(page);
  const { root, file } = await fixture(page);
  await zone(page, 'Asia/Katmandu');
  await page.goto('/home?parent=' + root.id);
  const dialog = await customShare(page, file);
  const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await calendarDate(dialog, tomorrow);
  await dialog.getByLabel('到期时间', { exact: true }).fill('18:30');
  await expect(dialog).toContainText('输入时区：Asia/Katmandu');
  const expected = tomorrow + 'T12:45:00.000Z';
  await expect(dialog.getByRole('status')).toContainText(expected);
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname.endsWith('/files/shares') && r.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: '创建分享链接', exact: true }).click();
  const savedResponse = await response;
  expect(savedResponse.status()).toBe(200);
  const saved = (await savedResponse.json()) as { id: string; expiresAt: string };
  expect(Date.parse(saved.expiresAt)).toBe(Date.parse(expected));
  await expect(dialog).toContainText(full(saved.expiresAt, 'Asia/Kathmandu'));
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  const precise = await api<{ id: string; expiresAt: string }>(page, '/shares', 'POST', {
    rootId: root.id,
    title: '精确到期-' + root.id,
    password: '',
    permissions,
    audience,
    expiresAt: expected.replace(':00.000Z', ':42.123Z'),
  });
  await page.goto('/home/shares');
  const item = page.locator('[data-share-id="' + precise.id + '"]');
  await shareMenuAction(page, item, '修改分享设置');
  const edit = page.getByRole('dialog', { name: '修改分享设置', exact: true });
  await edit.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(edit).toHaveCount(0);
  const listing = await api<{ items: { id: string; expiresAt: string }[] }>(page, '/shares');
  expect(listing.items.find((value) => value.id === precise.id)?.expiresAt).toBe(precise.expiresAt);
  await zone(page, 'America/New_York');
  await page.goto('/home/shares');
  await shareMenuAction(page, item, '修改分享设置');
  await select(page, '有效期', '指定到期时间', edit);
  await calendarDate(edit, '2027-03-14');
  await edit.getByLabel('到期时间', { exact: true }).fill('02:30');
  let updates = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      new URL(request.url()).pathname.endsWith('/files/shares/' + precise.id)
    )
      updates++;
  });
  await edit.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel('到期时间', { exact: true })).toHaveValue('02:30');
  expect(updates).toBe(0);
  await edit.getByRole('button', { name: '取消', exact: true }).click();
  await page.screenshot({ path: info.outputPath('share-expiry.png') });
});

test('F377/378：DST不存在时刻不发送请求，重复时刻明确选次且保留失败输入', async ({
  page,
}, info) => {
  await login(page);
  const { root, file } = await fixture(page);
  await zone(page, 'America/New_York');
  await page.goto('/home?parent=' + root.id);
  const dialog = await customShare(page, file);
  let requests = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/files/shares')) requests++;
  });
  await calendarDate(dialog, '2027-03-14');
  await dialog.getByLabel('到期时间', { exact: true }).fill('02:30');
  await expect(dialog).toContainText('该时刻因夏令时跳转而不存在');
  await dialog.getByRole('button', { name: '创建分享链接', exact: true }).click();
  expect(requests).toBe(0);
  await expect(dialog.getByLabel('到期时间', { exact: true })).toHaveValue('02:30');
  await calendarDate(dialog, '2027-11-07');
  await dialog.getByLabel('到期时间', { exact: true }).fill('01:30');
  await expect(dialog).toContainText('该时刻出现两次');
  await dialog.getByRole('button', { name: '创建分享链接', exact: true }).click();
  expect(requests).toBe(0);
  await select(page, '重复时刻', '第二次（2027-11-07T06:30:00.000Z）', dialog);
  await expect(dialog.getByRole('status')).toContainText('2027-11-07T06:30:00.000Z');
  const sent = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/files/shares'),
  );
  const rejected = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/files/shares'),
  );
  await dialog.getByRole('button', { name: '创建分享链接', exact: true }).click();
  const submitted: unknown = (await sent).postDataJSON();
  expect(submitted).toMatchObject({ expiresAt: '2027-11-07T06:30:00.000Z' });
  // 真实服务仍执行30天上限；该远期DST场景只验证输入和发送，不冒称已持久化。
  expect((await rejected).status()).toBe(422);
  await expect(dialog.getByRole('alert')).toContainText('名称、内容或有效期不符合要求');
  await expect(dialog.getByRole('alert')).toBeInViewport();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('到期时间', { exact: true })).toHaveValue('01:30');
  await page.screenshot({ path: info.outputPath('dst-overlap.png') });
});

test('F379/380：系统跟随和固定时区跨浏览器环境，英文深色320px可访问', async ({
  page,
  browser,
}, info) => {
  await login(page);
  const { root, file } = await fixture(page);
  const secondContext = await browser.newContext({
    baseURL: readPreviewAccess().origin,
    timezoneId: 'Pacific/Honolulu',
    locale: 'zh-CN',
  });
  try {
    const other = await secondContext.newPage();
    await login(other);
    await zone(other, 'auto');
    await other.goto('/home?parent=' + root.id);
    await expect(other.locator('[data-file-item="' + file.id + '"] p[title]')).toHaveAttribute(
      'title',
      full(file.updatedAt, 'Pacific/Honolulu'),
    );
    await zone(page, 'Pacific/Kiritimati');
    await page.goto('/home?parent=' + root.id);
    await expect(page.locator('[data-file-item="' + file.id + '"] p[title]')).toHaveAttribute(
      'title',
      full(file.updatedAt, 'Pacific/Kiritimati'),
    );
    await page.getByRole('button', { name: '当前用户', exact: true }).click();
    await page.getByRole('menuitem', { name: /^主题 / }).click();
    await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
    await page.goto('/settings/locale');
    await page
      .getByRole('radiogroup', { name: '界面语言', exact: true })
      .getByText('English', { exact: true })
      .click();
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(page.getByRole('combobox', { name: 'Time zone', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath('region-mobile-dark-english.png') });
    await page.goto('/home?parent=' + root.id);
    await page.getByRole('button', { name: 'Actions for ' + file.name, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share', exact: true });
    await select(page, 'Validity', 'Choose expiration time', dialog);
    await expect(dialog.getByText(/Input time zone: Pacific\/Kiritimati/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await page.screenshot({ path: info.outputPath('expiry-mobile-dark-english.png') });
  } finally {
    await secondContext.close();
  }
});
