import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultFilePreferences, type FilePreferences } from '../surfaces/src/files/preferences';

async function login(page: Page, admin = false) {
  const path = admin
    ? (process.env.CLOUDDRIVE_FILE_TEST_ADMIN_ACCESS ?? '../../.data/135-isolated-access.json')
    : (process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/136-isolated-access.json');
  const access = JSON.parse(
    (await readFile(resolve(__dirname, path), 'utf8')).replace(/^\uFEFF/, ''),
  ) as { url: string; username: string; password: string };
  await page.goto(new URL('/login?returnTo=%2Fhome', access.url).href);
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function api<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (method !== 'GET') {
        const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
        headers['X-CSRF-Token'] = csrf.token;
      }
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw Error('Preference fixture request failed: ' + response.status);
      return (await response.json()) as T;
    },
    { path, method, body },
  );
}
const read = (page: Page) => api<FilePreferences>(page, '/preferences');
async function write(page: Page, document: FilePreferences) {
  const remote = await read(page);
  return api<FilePreferences>(page, '/preferences', 'PUT', {
    ...document,
    revision: remote.revision,
  });
}
async function options(page: Page) {
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '视图选项', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '视图选项', exact: true })).toBeVisible();
}
async function save(page: Page) {
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '保存', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: '视图选项', exact: true })).toHaveCount(0);
}
async function view(page: Page, label: string) {
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await expect(page.getByText('文件偏好已保存', { exact: true })).toBeVisible();
}
async function currentView(page: Page) {
  return page
    .locator('[data-file-item]')
    .first()
    .evaluate((element) => (element.getAttribute('role') === 'row' ? 'list' : 'grid'));
}
let fixture: { root: string; first: string; second: string };
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await login(page);
    const root = await api<{ id: string }>(page, '/folders', 'POST', {
      parentId: '',
      name: '偏好验收-' + randomUUID().slice(0, 8),
    });
    const first = await api<{ id: string }>(page, '/folders', 'POST', {
      parentId: root.id,
      name: '偏好目录甲',
    });
    const second = await api<{ id: string }>(page, '/folders', 'POST', {
      parentId: root.id,
      name: '偏好目录乙',
    });
    for (const parentId of [first.id, second.id])
      await api(page, '/text', 'POST', {
        parentId,
        name: '偏好样本.txt',
        text: '真实偏好验收',
        key: randomUUID(),
      });
    fixture = { root: root.id, first: first.id, second: second.id };
  } finally {
    await page.close();
  }
});
test.beforeEach(async ({ page }) => {
  await login(page);
  await write(page, defaultFilePreferences());
  await page.goto('/home?parent=' + fixture.root);
  await expect(page.locator('[data-file-item]')).toHaveCount(2);
});
test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await login(page);
    await write(page, defaultFilePreferences());
    await api(page, '/' + fixture.root + '/trash', 'POST');
  } finally {
    await page.close();
  }
});

test('F321/F322/F333：服务器发布、完整视图保存与关闭同步', async ({ page }) => {
  await view(page, '列表');
  await options(page);
  const dialog = page.getByRole('dialog', { name: '视图选项', exact: true });
  await dialog.getByLabel('同步到服务器', { exact: true }).press('Space');
  await dialog.getByLabel('目录优先', { exact: true }).press('Space');
  await dialog.getByLabel('类型', { exact: true }).press('Space');
  await dialog.getByRole('button', { name: /每页条目/ }).click();
  await page.getByRole('option', { name: '100', exact: true }).click();
  await save(page);
  const remote = await read(page);
  expect(remote.defaults).toMatchObject({
    view: 'list',
    foldersFirst: true,
    pageSize: 100,
    columns: ['size', 'updated', 'kind'],
  });
  await options(page);
  await dialog.getByLabel('同步到服务器', { exact: true }).press('Space');
  await save(page);
  await view(page, '网格');
  expect((await read(page)).revision).toBe(remote.revision);
  expect((await read(page)).defaults.view).toBe('list');
});

test('F323/F324：另一设备读取服务器设置，账号之间隔离', async ({ page, browser }) => {
  const document = defaultFilePreferences();
  document.defaults.view = 'list';
  document.rememberFolders = true;
  document.folders = [{ parentId: fixture.first, view: document.defaults }];
  await write(page, document);
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '读取并使用服务器设置', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: '视图选项', exact: true })).toHaveCount(0);
  await expect.poll(() => currentView(page)).toBe('list');
  const admin = await browser.newPage();
  try {
    await login(admin, true);
    expect((await read(admin)).folders.some((folder) => folder.parentId === fixture.first)).toBe(
      false,
    );
    await expect.poll(() => read(page)).toMatchObject({ rememberFolders: true });
  } finally {
    await admin.close();
  }
});

test('F325–F329：目录、根、全局回退及关闭再开启记忆', async ({ page }) => {
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByLabel('记住各目录的视图设置', { exact: true })
    .press('Space');
  await save(page);
  await page.goto('/home?parent=' + fixture.first);
  await view(page, '列表');
  await page.goto('/home?parent=' + fixture.second);
  await expect.poll(() => currentView(page)).toBe('grid');
  await page.goto('/home?parent=' + fixture.first);
  await expect.poll(() => currentView(page)).toBe('list');
  await page.goto('/home');
  await view(page, '列表');
  await page.goto('/home?parent=' + fixture.second);
  await expect.poll(() => currentView(page)).toBe('grid');
  await page.goto('/home');
  await expect.poll(() => currentView(page)).toBe('list');
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByLabel('记住各目录的视图设置', { exact: true })
    .press('Space');
  await save(page);
  await page.goto('/home?parent=' + fixture.second);
  await expect.poll(() => currentView(page)).toBe('list');
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByLabel('记住各目录的视图设置', { exact: true })
    .press('Space');
  await save(page);
  await page.goto('/home?parent=' + fixture.first);
  await expect.poll(() => currentView(page)).toBe('list');
});

test('F330–F332：设全局默认、重置单目录、清除全部覆盖', async ({ page }) => {
  const document = defaultFilePreferences();
  document.rememberFolders = true;
  document.folders = [fixture.first, fixture.second].map((parentId) => ({
    parentId,
    view: { ...document.defaults, view: 'list' },
  }));
  await write(page, document);
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '读取并使用服务器设置', exact: true })
    .click();
  await page.goto('/home?parent=' + fixture.first);
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '重置当前目录视图', exact: true })
    .click();
  await save(page);
  expect((await read(page)).folders.map((folder) => folder.parentId)).toEqual([fixture.second]);
  await expect.poll(() => currentView(page)).toBe('grid');
  await page.goto('/home?parent=' + fixture.second);
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '将当前视图设为全局默认', exact: true })
    .click();
  await save(page);
  expect((await read(page)).defaults.view).toBe('list');
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '清除全部目录视图覆盖', exact: true })
    .click();
  await save(page);
  expect((await read(page)).folders).toEqual([]);
  expect((await read(page)).defaults.view).toBe('list');
});

test('F334：旧本机设置保留并迁移', async ({ page }) => {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('clouddrive.files.view.v2.')) {
        const account = key.slice('clouddrive.files.view.v2.'.length);
        const value = JSON.parse(localStorage.getItem(key)!) as { configuration: FilePreferences };
        localStorage.setItem(
          'clouddrive.files.view.v1.' + account,
          JSON.stringify({ ...value.configuration.defaults, view: 'list', pageSize: 100 }),
        );
        localStorage.removeItem(key);
      }
  });
  await page.reload();
  await expect.poll(() => currentView(page)).toBe('list');
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => key.startsWith('clouddrive.files.view.v1.')),
    ),
  ).toBe(false);
});

test('F335–F338：单击选中、双击、键盘及单击打开', async ({ page }) => {
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: /文件夹单击操作/ })
    .click();
  await page.getByRole('option', { name: '选中文件夹（双击打开）', exact: true }).click();
  await save(page);
  const first = page.getByRole('button', { name: '偏好目录甲', exact: true });
  await first.click();
  await expect(page).toHaveURL(new RegExp(fixture.root));
  await expect(page.getByText('已选择 1 项', { exact: true })).toBeVisible();
  await first.dblclick();
  await expect(page).toHaveURL(new RegExp(fixture.first));
  await page.goto('/home?parent=' + fixture.root);
  await page.getByRole('button', { name: '偏好目录甲', exact: true }).press('Enter');
  await expect(page).toHaveURL(new RegExp(fixture.first));
  await page.goto('/home?parent=' + fixture.root);
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: /文件夹单击操作/ })
    .click();
  await page.getByRole('option', { name: '打开文件夹', exact: true }).click();
  await save(page);
  await page.getByRole('button', { name: '偏好目录甲', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(fixture.first));
});

test('F339：真实revision冲突显示失败且可重载', async ({ page }) => {
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByLabel('同步到服务器', { exact: true })
    .press('Space');
  await save(page);
  await write(page, { ...(await read(page)), folderClick: 'select' });
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByLabel('目录优先', { exact: true })
    .press('Space');
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '保存', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '视图选项', exact: true }).getByRole('alert'),
  ).toContainText('失败');
  expect((await read(page)).folderClick).toBe('select');
  expect((await read(page)).defaults.foldersFirst).toBe(false);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '读取并使用服务器设置', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: '视图选项', exact: true })).toHaveCount(0);
  await options(page);
  await expect(
    page
      .getByRole('dialog', { name: '视图选项', exact: true })
      .getByRole('button', { name: /文件夹单击操作/ }),
  ).toContainText('选中');
});

test('F340：服务器失败恢复、本机无网络及窄屏可访问性', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/native/files/preferences', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '读取并使用服务器设置', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '视图选项', exact: true }).getByRole('alert'),
  ).toContainText('失败');
  await page.unroute('**/native/files/preferences');
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByRole('button', { name: '读取并使用服务器设置', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: '视图选项', exact: true })).toHaveCount(0);
  await options(page);
  await page
    .getByRole('dialog', { name: '视图选项', exact: true })
    .getByLabel('同步到服务器', { exact: true })
    .press('Space');
  await save(page);
  await page.route('**/native/files/preferences', (route) => route.abort());
  await view(page, '列表');
  await options(page);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  // React Aria短时播报引用刚关闭的保存按钮；等待呈现稳定再扫描，不排除节点或规则。
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="img"]')).every((element) => {
          if (element.getAttribute('aria-label')?.trim() || element.getAttribute('title')?.trim())
            return true;
          return (element.getAttribute('aria-labelledby') ?? '')
            .split(/\s+/)
            .some((id) => document.getElementById(id)?.textContent?.trim());
        }),
      ),
    )
    .toBe(true);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath('preferences-mobile.png'), fullPage: true });
});

test('偏好接口拒绝伪造字段、缺失CSRF和并发覆盖', async ({ page }) => {
  const document = await read(page);
  const result = await page.evaluate(async (document) => {
    const endpoint = '/api/console/v1/native/files/preferences';
    const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
    const write = (body: unknown, authorized = true) =>
      fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authorized ? { 'X-CSRF-Token': csrf.token } : {}),
        },
        body: JSON.stringify(body),
      }).then((response) => response.status);
    const noCSRF = await write(document, false);
    const unknownField = await write({ ...document, ownerId: 'someone-else' });
    const duplicateFolder = { parentId: '', view: document.defaults };
    const duplicate = await write({
      ...document,
      folders: [duplicateFolder, duplicateFolder],
    });
    const tooMany = await write({ ...document, folders: Array(201).fill(duplicateFolder) });
    const concurrent = await Promise.all([
      write({ ...document, folderClick: 'select' }),
      write({ ...document, rememberFolders: true }),
    ]);
    return { noCSRF, unknownField, duplicate, tooMany, concurrent };
  }, document);
  expect(result.noCSRF).toBe(403);
  expect(result.unknownField).toBe(400);
  expect(result.duplicate).toBe(422);
  expect(result.tooMany).toBe(400);
  expect(result.concurrent.sort()).toEqual([200, 409]);
  expect((await read(page)).revision).toBe(document.revision + 1);
});

test('英文深色320px与桌面偏好弹窗保持可读可访问', async ({ page }, info) => {
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'View options', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'View options', exact: true });
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('preferences-english-dark-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('preferences-english-dark-desktop.png') });
});
