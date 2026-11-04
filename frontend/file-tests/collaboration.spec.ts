import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

test.use({ actionTimeout: 15_000 });
const editor = {
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
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, value: (await response.json()) as Record<string, unknown> };
    },
    { path, method, body },
  );
  expect(result.status, method + ' ' + path).toBe(200);
  return result.value;
}
async function fixture(page: Page, permissions = editor) {
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  const root = await api(page, '/folders', 'POST', { parentId: '', name: '协作-' + suffix });
  const file = await api(page, '/text', 'POST', {
    parentId: root.id,
    name: 'notes.md',
    text: '初始内容 <script>未执行</script>',
    key: randomUUID(),
  });
  const folder = await api(page, '/folders', 'POST', { parentId: root.id, name: '目标目录' });
  const share = await api(page, '/shares', 'POST', {
    rootId: root.id,
    title: '协作预览-' + suffix,
    password: '',
    permissions,
  });
  const url = new URL('/share#token=' + String(share.token), page.url()).href;
  return { root, file, folder, share, url, suffix };
}
const row = (page: Page, name: string) =>
  page.locator('[data-shared-entry-id]').filter({ has: page.getByText(name, { exact: true }) });
async function confirm(dialog: Locator, label = '确定') {
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('拥有者创建预设、修改标题密码有效期、详情、暂停恢复和检索', async ({ page }) => {
  const f = await fixture(page);
  await page.goto('/home');
  await page.getByRole('button', { name: String(f.root.name) + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '分享', exact: true }).click();
  const create = page.getByRole('dialog', { name: '分享', exact: true });
  await create.getByLabel('分享标题（可选）', { exact: true }).fill('UI创建-' + f.suffix);
  await create.getByRole('button', { name: /分享权限/ }).click();
  await page.getByRole('option', { name: '仅上传', exact: true }).click();
  await create.getByRole('button', { name: '创建分享链接', exact: true }).click();
  await expect(create.getByRole('link')).toBeVisible();
  await create.getByRole('button', { name: '关闭', exact: true }).click();
  await page.goto('/home/shares');
  const owned = page.locator('[data-share-id="' + String(f.share.id) + '"]');
  await expect(owned).toBeVisible();
  await owned.getByRole('button', { name: '修改分享设置', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '修改分享设置', exact: true });
  await settings.getByLabel('分享标题（可选）', { exact: true }).fill('设置已保存-' + f.suffix);
  await settings.getByRole('button', { name: /有效期/ }).click();
  await page.getByRole('option', { name: '1 小时', exact: true }).click();
  await settings.getByRole('button', { name: /访问密码操作/ }).click();
  await page.getByRole('option', { name: '设置或更换密码', exact: true }).click();
  const password = randomUUID();
  await settings.getByLabel('访问密码（可选）', { exact: true }).fill(password);
  await confirm(settings, '保存设置');
  await expect(owned).toContainText('设置已保存-');
  await owned.getByRole('button', { name: '分享详情', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('修改文字内容');
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await owned.getByRole('button', { name: '暂停分享', exact: true }).click();
  await confirm(page.getByRole('dialog', { name: '暂停分享', exact: true }));
  await expect(owned).toContainText('已暂停');
  await owned.getByRole('button', { name: '恢复分享', exact: true }).click();
  await confirm(page.getByRole('dialog', { name: '恢复分享', exact: true }));
  await page.getByLabel('搜索标题或原文件名', { exact: true }).fill('设置已保存-' + f.suffix);
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('[data-share-id]')).toHaveCount(1);
  await expect(owned.getByRole('link', { name: '以访客身份预览', exact: true })).toHaveAttribute(
    'href',
    f.url,
  );
});

test('匿名访客文字预览、CAS冲突保留草稿、创建与目录整理', async ({ page, browser }) => {
  const f = await fixture(page),
    context = await browser.newContext(),
    visitor = await context.newPage();
  await visitor.goto(f.url);
  await expect(row(visitor, 'notes.md')).toBeVisible();
  await row(visitor, 'notes.md').getByRole('button', { name: '预览', exact: true }).click();
  await expect(visitor.getByRole('dialog').locator('pre')).toContainText('<script>未执行</script>');
  await visitor.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await row(visitor, 'notes.md').getByRole('button', { name: '编辑文字', exact: true }).click();
  const edit = visitor.getByRole('dialog', { name: '编辑文字', exact: true });
  await expect(edit.getByLabel('文字内容', { exact: true })).toHaveValue(/初始内容/);
  await edit.getByLabel('文字内容', { exact: true }).fill('保留的草稿');
  await api(page, '/' + String(f.file.id) + '/text', 'PUT', {
    expectedRevision: 1,
    text: '另一访客已修改',
  });
  await edit.getByRole('button', { name: '保存', exact: true }).click();
  await expect(edit.getByRole('alert').first()).toBeVisible();
  await expect(edit.getByLabel('文字内容', { exact: true })).toHaveValue('保留的草稿');
  await edit.getByRole('button', { name: '读取最新内容，保留草稿', exact: true }).click();
  await expect(edit.locator('pre')).toHaveText('另一访客已修改');
  await confirm(edit, '保存');
  await visitor.getByRole('button', { name: '新建 Markdown', exact: true }).click();
  const create = visitor.getByRole('dialog', { name: '新建 Markdown', exact: true });
  await create.getByLabel('名称', { exact: true }).fill('new.md');
  await create.getByLabel('文字内容', { exact: true }).fill('# 新内容');
  await confirm(create, '保存');
  await expect(row(visitor, 'new.md')).toBeVisible();
  await row(visitor, 'new.md').getByRole('button', { name: '重命名', exact: true }).click();
  const rename = visitor.getByRole('dialog', { name: '重命名', exact: true });
  await rename.getByLabel('新名称', { exact: true }).fill('renamed.md');
  await confirm(rename);
  await expect(row(visitor, 'renamed.md')).toBeVisible();
  await row(visitor, 'renamed.md').getByRole('button', { name: '复制', exact: true }).click();
  const copy = visitor.getByRole('dialog', { name: '复制', exact: true });
  await copy.getByLabel('新名称', { exact: true }).fill('copy.md');
  await confirm(copy);
  await expect(row(visitor, 'copy.md')).toBeVisible();
  await row(visitor, 'renamed.md').getByRole('button', { name: '移动', exact: true }).click();
  const move = visitor.getByRole('dialog', { name: '移动', exact: true });
  await move.getByRole('button', { name: '目标目录', exact: true }).click();
  await confirm(move);
  await expect(row(visitor, 'renamed.md')).toHaveCount(0);
  await row(visitor, '目标目录').getByRole('button', { name: '打开目录', exact: true }).click();
  await expect(row(visitor, 'renamed.md')).toBeVisible();
  await row(visitor, 'renamed.md').getByRole('button', { name: '移入回收站', exact: true }).click();
  await confirm(visitor.getByRole('dialog', { name: '移入回收站', exact: true }));
  await expect(row(visitor, 'renamed.md')).toHaveCount(0);
  await context.close();
});

test('访客真实分块上传与批量ZIP、逐项失败后保留选择', async ({ page, browser }) => {
  const f = await fixture(page),
    context = await browser.newContext(),
    visitor = await context.newPage();
  await visitor.goto(f.url);
  await visitor.getByRole('button', { name: '上传文件', exact: true }).click();
  const upload = visitor.getByRole('dialog', { name: '上传文件', exact: true });
  const chooser = visitor.waitForEvent('filechooser');
  await upload.getByRole('button', { name: '继续选择文件', exact: true }).click();
  await (
    await chooser
  ).setFiles([
    { name: 'real-upload.txt', mimeType: 'text/plain', buffer: Buffer.alloc(5 << 20, 'a') },
    {
      name: 'safe.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',
        'base64',
      ),
    },
  ]);
  await upload.getByRole('button', { name: '开始上传', exact: true }).click();
  await expect(upload.getByText('文件已保存。', { exact: true })).toHaveCount(2);
  await upload.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(row(visitor, 'real-upload.txt')).toBeVisible();
  await row(visitor, 'safe.png').getByRole('button', { name: '预览', exact: true }).click();
  await expect(
    visitor.getByRole('dialog').getByRole('img', { name: 'safe.png', exact: true }),
  ).toBeVisible();
  await visitor.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await row(visitor, 'notes.md').getByRole('checkbox').press('Space');
  await row(visitor, 'real-upload.txt').getByRole('checkbox').press('Space');
  const download = visitor.waitForEvent('download');
  await visitor.getByRole('button', { name: '打包下载所选', exact: true }).click();
  const zip = await download;
  const path = await zip.path();
  if (!path) throw new Error('没有ZIP');
  expect((await readFile(path)).subarray(0, 2).toString()).toBe('PK');
  await api(page, '/' + String(f.file.id) + '/text', 'PUT', {
    expectedRevision: 1,
    text: '并发变更',
  });
  await visitor.getByRole('button', { name: '移动所选', exact: true }).click();
  const move = visitor.getByRole('dialog', { name: '移动', exact: true });
  await move.getByRole('button', { name: '目标目录', exact: true }).click();
  await confirm(move);
  await expect(
    visitor.getByText('部分项目未成功，失败项仍保留选择。', { exact: true }),
  ).toBeVisible();
  await expect(row(visitor, 'notes.md').getByRole('checkbox')).toBeChecked();
  await expect(row(visitor, 'real-upload.txt')).toHaveCount(0);
  await context.close();
});

test('仅上传不枚举目录、只读无写入动作和窄屏键盘无障碍', async ({ page, browser }) => {
  const f = await fixture(page, {
    ...editor,
    browse: false,
    preview: false,
    download: false,
    modify: false,
    rename: false,
    move: false,
    copy: false,
    delete: false,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    visitor = await context.newPage();
  const requests: string[] = [];
  visitor.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/entries')) requests.push('entries');
  });
  await visitor.goto(f.url);
  await expect(
    visitor.getByText('此分享仅允许提交内容，不展示已有文件。', { exact: true }),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await expect(visitor.getByText('notes.md', { exact: true })).toHaveCount(0);
  await visitor.getByRole('button', { name: '新建目录', exact: true }).click();
  const create = visitor.getByRole('dialog', { name: '新建目录', exact: true });
  await create.getByLabel('名称', { exact: true }).fill('仅上传创建');
  await confirm(create, '保存');
  const readonly = await api(page, '/shares', 'POST', {
    rootId: f.root.id,
    password: '',
    title: '只读预览',
  });
  await visitor.goto(new URL('/share#token=' + String(readonly.token), f.url).href);
  await expect(row(visitor, 'notes.md')).toBeVisible();
  await expect(visitor.getByRole('button', { name: '上传文件', exact: true })).toHaveCount(0);
  await expect(visitor.getByRole('button', { name: '编辑文字', exact: true })).toHaveCount(0);
  expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await visitor.getByRole('button', { name: '刷新', exact: true }).focus();
  await visitor.keyboard.press('Enter');
  await expect(row(visitor, 'notes.md')).toBeVisible(); // React Aria的临时播报会引用刚关闭的浮层；等待其自然清除后检查稳定页面，不排除任何规则。
  await expect(visitor.locator('[role=log] [role=img]')).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page: visitor }).analyze();
  expect(
    accessibility.violations.filter(
      (issue) => issue.impact === 'serious' || issue.impact === 'critical',
    ),
  ).toEqual([]);
  await visitor.screenshot({ path: 'test-results/130-public-mobile.png', fullPage: true });
  await writeFile(
    resolve(__dirname, '../../.data/130-browser-preview.json'),
    JSON.stringify(
      {
        url: f.url,
        readonlyUrl: new URL('/share#token=' + String(readonly.token), f.url).href,
        rootID: f.root.id,
      },
      null,
      2,
    ),
  );
  await context.close();
});

test('分享页深色英文、减少动态、窄屏浮层和WCAG检查', async ({ page }) => {
  const f = await fixture(page),
    failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.name));
  await page.goto('/workspace');
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(f.url);
  await expect(row(page, 'notes.md')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await row(page, 'notes.md').getByRole('button', { name: 'Edit text', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit text', exact: true });
  await expect(editor.getByLabel('Text content', { exact: true })).toHaveValue(/初始内容/);
  await expect(page.locator('[role=log] [role=img]')).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/130-public-dark-english-dialog.png' });
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).focus();
  await page.screenshot({
    path: 'test-results/130-public-dark-english-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: 'test-results/130-public-desktop.png', fullPage: true });
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Current user', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Language English', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '浅色', exact: true }).click();
  expect(failures).toEqual([]);
});
