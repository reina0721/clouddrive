import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test.use({ actionTimeout: 15_000 });
async function login(page: Page) {
  const access = JSON.parse(
    (
      await readFile(
        resolve(
          __dirname,
          process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
        ),
        'utf8',
      )
    ).replace(/^\uFEFF/, ''),
  ) as { username: string; password: string };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function api(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (
        await fetch('/api/console/v1/auth/csrf', { credentials: 'include', cache: 'no-store' })
      ).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, value: (await response.json()) as Record<string, unknown> };
    },
    { path, method, body },
  );
  expect(response.status, method + ' ' + path).toBe(200);
  return response.value;
}

async function fixture(page: Page) {
  const suffix = randomUUID().slice(0, 8),
    root = await api(page, '/folders', 'POST', { name: '浏览-' + suffix, parentId: '' }),
    from = await api(page, '/folders', 'POST', { name: '源-' + suffix, parentId: root.id }),
    dest = await api(page, '/folders', 'POST', { name: '目标-' + suffix, parentId: root.id });
  const file = await api(page, '/text', 'POST', {
    name: 'a-' + suffix + '.txt',
    parentId: from.id,
    text: 'hello',
    key: randomUUID(),
  });
  return { suffix, root, from, dest, file };
}
const row = (page: Page, id: unknown) => page.locator('[data-file-item="' + String(id) + '"]');
async function up(page: Page) {
  await page.getByRole('button', { name: '上级目录', exact: true }).click();
  await expect(page.locator('section[aria-busy]')).toHaveAttribute('aria-busy', 'false');
}
async function open(page: Page, name: unknown) {
  await page.getByRole('button', { name: String(name), exact: true }).click();
  await expect(page.getByRole('region', { name: String(name), exact: true })).toHaveAttribute(
    'aria-busy',
    'false',
  );
}
async function menu(page: Page, label: string, action: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}
async function choose(page: Page, name: unknown) {
  await page
    .getByRole('button', { name: String(name), exact: true })
    .click({ modifiers: ['Control'] });
}

test('紧凑导航、路径、搜索及选择菜单真实可用', async ({ page, context }, info) => {
  await login(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const f = await fixture(page);
  await page.goto('/home?parent=' + String(f.from.id));
  await expect(row(page, f.file.id)).toBeVisible();
  await menu(page, '视图', '列表');
  await expect(page.getByRole('table')).toBeVisible();
  await menu(page, '排序方式', '大小');
  await menu(page, '排序方式', '降序');
  await expect(page.getByRole('columnheader', { name: '大小 ↓', exact: true })).toBeVisible();
  await menu(page, '当前目录操作', '复制当前路径');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    '/' + String(f.root.name) + '/' + String(f.from.name),
  );
  await page.getByRole('button', { name: '完整目录路径', exact: true }).click();
  await page.getByRole('menuitem', { name: '/' + String(f.root.name), exact: true }).click();
  await expect(row(page, f.from.id)).toBeVisible();
  await menu(page, '当前目录操作', '全选');
  await expect(page.getByText('已选择 2 项', { exact: true })).toBeVisible();
  await menu(page, '当前目录操作', '反选本页');
  await expect(page.getByText('已选择 2 项', { exact: true })).toHaveCount(0);
  await choose(page, f.from.name);
  await menu(page, '当前目录操作', '反选本页');
  await expect(row(page, f.dest.id).getByRole('checkbox')).toBeChecked();
  await expect(row(page, f.from.id).getByRole('checkbox')).not.toBeChecked();
  await menu(page, '当前目录操作', '取消选择');
  await open(page, f.from.name);
  await choose(page, f.file.name);
  await expect(page.getByText('所选文件共 5 B（不含目录内容）', { exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: '搜索文件', exact: true });
  await search.fill('未提交草稿');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page.locator('#main-content')).toBeFocused();
  await search.fill(String(f.file.name));
  await search.press('Enter');
  await expect(page).toHaveURL(/search=/);
  await expect(page.getByText(/全部自有文件 · 共 1 项/)).toBeVisible();
  await page.getByRole('button', { name: '清空搜索', exact: true }).click();
  await expect(page).not.toHaveURL(/search=/);
  await page.locator('#main-content').focus();
  await expect(page.getByRole('button', { name: '上级目录', exact: true })).toBeEnabled();
  await page.keyboard.press('Alt+ArrowUp');
  await expect(row(page, f.dest.id)).toBeVisible();
  await page.screenshot({ path: info.outputPath('explorer-desktop.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '文件导航', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '回收站', exact: true })).toHaveCount(0);
  expect(
    await page.locator('#main-content').evaluate((e) => e.getBoundingClientRect().top),
  ).toBeLessThan(100);
  await page.screenshot({ path: info.outputPath('explorer-mobile.png'), fullPage: false });
  await page.getByRole('button', { name: '文件导航', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '文件导航', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '图片', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/category=image/);
  await expect(page.locator('#main-content')).toBeFocused();
  await page.getByRole('button', { name: '文件导航', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#main-content')).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('复制待处理跨目录使用新名称，冲突不覆盖且可取消', async ({ page }, info) => {
  await login(page);
  const f = await fixture(page);
  await page.goto('/home?parent=' + String(f.from.id));
  await expect(row(page, f.file.id)).toBeVisible();
  await row(page, f.file.id).click({ button: 'right' });
  await page.getByRole('menuitem', { name: '加入复制待处理', exact: true }).click();
  await expect(page.getByRole('region', { name: '待复制 1 项', exact: true })).toBeVisible();
  await api(page, '/' + String(f.file.id), 'PATCH', { name: 'renamed-' + f.suffix + '.txt' });
  await up(page);
  await open(page, f.dest.name);
  await page.getByRole('button', { name: '粘贴到当前目录', exact: true }).click();
  await expect(page.getByText('已完成 1 项', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'renamed-' + f.suffix + '.txt', exact: true }),
  ).toBeVisible();
  const files = (await api(page, '?parent=' + String(f.dest.id))).items as {
    id: string;
    name: string;
  }[];
  expect(files).toHaveLength(1);
  expect(files[0]?.id).not.toBe(f.file.id);
  expect((await api(page, '/' + String(f.file.id))).entry).toMatchObject({ parentId: f.from.id });
  await up(page);
  await open(page, f.from.name);
  await choose(page, 'renamed-' + f.suffix + '.txt');
  await page.locator('#main-content').focus();
  await page.keyboard.press('Control+c');
  await up(page);
  await open(page, f.dest.name);
  await page.locator('#main-content').focus();
  await page.keyboard.press('Control+v');
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(
    'renamed-' + f.suffix + '.txt',
  );
  expect((await api(page, '?parent=' + String(f.dest.id))).items as unknown[]).toHaveLength(1);
  await page.screenshot({ path: info.outputPath('clipboard-conflict.png'), fullPage: false });
  await page.getByRole('button', { name: '取消待处理操作', exact: true }).click();
  await expect(page.getByRole('region', { name: '待复制 1 项', exact: true })).toHaveCount(0);
});

test('批量剪切部分成功保留失败项，刷新清空与输入快捷键隔离', async ({ page }, info) => {
  await login(page);
  const f = await fixture(page),
    second = await api(page, '/text', 'POST', {
      name: 'b-' + f.suffix + '.txt',
      parentId: f.from.id,
      text: 'second',
      key: randomUUID(),
    });
  await api(page, '/text', 'POST', {
    name: second.name,
    parentId: f.dest.id,
    text: 'conflict-original',
    key: randomUUID(),
  });
  await page.goto('/home?parent=' + String(f.from.id));
  await expect(row(page, second.id)).toBeVisible();
  await choose(page, f.file.name);
  await choose(page, second.name);
  await page.locator('#main-content').focus();
  await page.keyboard.press('Control+x');
  await expect(row(page, f.file.id)).toHaveAttribute('data-file-cut', 'true');
  await expect(page.getByRole('region', { name: '待移动 2 项', exact: true })).toBeVisible();
  await up(page);
  await open(page, f.dest.name);
  await page.getByRole('button', { name: '粘贴到当前目录', exact: true }).click();
  await expect(page.locator('#main-content').getByRole('alert')).toContainText(String(second.name));
  await expect(page.getByText('已完成 1 项', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '待移动 1 项', exact: true })).toBeVisible();
  expect((await api(page, '/' + String(f.file.id))).entry).toMatchObject({ parentId: f.dest.id });
  expect((await api(page, '/' + String(second.id))).entry).toMatchObject({ parentId: f.from.id });
  await page.screenshot({ path: info.outputPath('clipboard-partial.png'), fullPage: false });
  const search = page.getByRole('searchbox', { name: '搜索文件', exact: true });
  await search.fill('草稿');
  await search.press('Control+x');
  await expect(page.getByRole('region', { name: '待移动 1 项', exact: true })).toBeVisible();
  await search.press('Escape');
  await page.reload();
  await expect(page.getByRole('region', { name: /待移动/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: String(f.file.name), exact: true })).toBeVisible();
  await choose(page, f.file.name);
  await page.getByRole('button', { name: '加入复制待处理', exact: true }).click();
  await page.getByRole('button', { name: '高级搜索', exact: true }).click();
  await page.keyboard.press('Control+v');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('region', { name: '待复制 1 项', exact: true })).toBeVisible();
  await api(page, '/' + String(f.file.id) + '/trash', 'POST');
  await page.getByRole('button', { name: '粘贴到当前目录', exact: true }).click();
  await expect(page.getByText('文件或目录不存在，或已移入回收站。', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '待复制 1 项', exact: true })).toBeVisible();
});

test('空目录直接上传复用真实队列，筛选空结果不伪装为空目录', async ({ page, context }) => {
  await login(page);
  const f = await fixture(page);
  await page.goto('/home?parent=' + String(f.dest.id));
  await expect(
    page.getByRole('region', { name: String(f.dest.name), exact: true }),
  ).toHaveAttribute('aria-busy', 'false');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () => {
    await navigator.clipboard.writeText('native clipboard remains available');
    document.addEventListener(
      'paste',
      () => {
        document.documentElement.dataset.nativePasteObserved = 'true';
      },
      { once: true },
    );
  });
  await page.locator('#main-content').focus();
  await page.keyboard.press('Control+v');
  await expect(page.locator('html')).toHaveAttribute('data-native-paste-observed', 'true');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '上传文件', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'empty-action-' + f.suffix + '.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('real uploaded content'),
  });
  await expect(
    page.getByRole('button', { name: 'empty-action-' + f.suffix + '.txt', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('上传完成', { exact: true })).toHaveCount(1);
  const search = page.getByRole('searchbox', { name: '搜索文件', exact: true });
  await search.fill('no-match-' + f.suffix);
  await search.press('Enter');
  await expect(page.getByText('没有找到文件', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '上传文件', exact: true })).toHaveCount(0);
});
