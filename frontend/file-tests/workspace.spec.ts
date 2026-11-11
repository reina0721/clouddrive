import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
const accessPath = resolve(
  __dirname,
  process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
);
async function access() {
  return JSON.parse((await readFile(accessPath, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
  };
}
async function login(page: Page) {
  const a = await access();
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(a.username);
  await page.getByLabel('密码', { exact: true }).fill(a.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('button', { name: '新建', exact: true })).toBeEnabled();
}
async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const r = await fetch('/api/console/v1/native/files' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!r.ok) throw new Error('Fixture API ' + r.status);
      return (await r.json()) as Record<string, unknown>;
    },
    { path, body },
  );
}
async function start(page: Page, label: string) {
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog', { name: label, exact: true })).toBeVisible();
}
async function selectTarget(page: Page, name: string) {
  const d = page.getByRole('dialog');
  await d.getByRole('button', { name: '进入 ' + name, exact: true }).click();
  await expect(d.getByText(new RegExp(name))).toBeVisible();
  await expect(d.getByRole('button', { name: '使用此位置', exact: true })).toBeEnabled();
}
test.beforeEach(async ({ page }) => login(page));
test('F221–225：六页共用导航、分类、回收站和原生链接', async ({ page }) => {
  for (const [label, path] of [
    ['我的分享', 'shares'],
    ['连接与挂载', 'connections'],
    ['传输中心', 'transfers'],
    ['离线下载', 'downloads'],
    ['与我共享', 'shared'],
  ] as const) {
    await page
      .getByRole('navigation', { name: '我的文件', exact: true })
      .getByRole('link', { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp('/home/' + path + '$'));
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(
      page
        .getByRole('navigation', { name: '我的文件', exact: true })
        .getByRole('link', { name: label, exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: '新建', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '刷新存储空间', exact: true })).toBeVisible();
  }
  for (const [label, category] of [
    ['图片', 'image'],
    ['视频', 'video'],
    ['音乐', 'audio'],
    ['文档', 'document'],
  ] as const) {
    const link = page.getByRole('link', { name: label, exact: true });
    await expect(link).toHaveAttribute('href', '/home?category=' + category);
    await link.click();
    await expect(page).toHaveURL(new RegExp('category=' + category));
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('link', { name: '回收站', exact: true }).click();
  await expect(page.getByRole('button', { name: '新建', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '清空回收站', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '我的文件', exact: true }).click();
  const popup = page.context().waitForEvent('page');
  await page.getByRole('link', { name: '我的分享', exact: true }).click({ button: 'middle' });
  const tab = await popup;
  await expect(tab).toHaveURL(/\/home\/shares$/);
  await tab.close();
});
test('F226–227：折叠记忆、移动抽屉焦点与共享页布局', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('link', { name: '我的分享', exact: true }).click();
  await page.getByRole('button', { name: '收起文件导航', exact: true }).click();
  await expect(page.getByRole('button', { name: '展开文件导航', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '展开文件导航', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '展开文件导航', exact: true }).click();
  await page.screenshot({ path: info.outputPath('desktop-workspace.png'), fullPage: true });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '文件导航', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '文件导航', exact: true });
  await drawer.getByRole('link', { name: '图片', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page).toHaveURL(/category=image/);
  await expect(page.locator('section[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await page.screenshot({ path: info.outputPath('mobile-workspace.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('F228–230：其他页面向所选目录创建文件夹、文本和Markdown', async ({ page }) => {
  const suffix = randomUUID().slice(0, 8),
    target = '000131-' + suffix;
  const folder = await api(page, '/folders', { parentId: '', name: target });
  await page.getByRole('link', { name: '我的分享', exact: true }).click();
  await start(page, '创建文件夹');
  const d = page.getByRole('dialog');
  await d.getByRole('button', { name: '进入 ' + target, exact: true }).click();
  await d.getByLabel('名称', { exact: true }).fill('child-' + suffix);
  await d.getByRole('button', { name: '确认', exact: true }).click();
  await expect(d).toHaveCount(0);
  for (const [label, name, text] of [
    ['新建文本', 'plain-' + suffix, 'text content'],
    ['新建 Markdown', 'note-' + suffix, '# markdown'],
  ] as const) {
    await start(page, label);
    await selectTarget(page, target);
    await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
    await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(name);
    await page.getByRole('dialog').getByLabel('文件内容', { exact: true }).fill(text);
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  const listing = await api(page, '?parent=' + String(folder.id));
  const items = listing.items as { name: string }[];
  expect(items.map((item) => item.name)).toEqual(
    expect.arrayContaining([
      'child-' + suffix,
      'plain-' + suffix + '.txt',
      'note-' + suffix + '.md',
    ]),
  );
});
test('F231–232、239–240：跨页文件/目录上传与同一队列', async ({ page }, info) => {
  const suffix = randomUUID().slice(0, 8),
    target = '000131-upload-' + suffix;
  const folder = await api(page, '/folders', { parentId: '', name: target });
  await page.getByRole('link', { name: '连接与挂载', exact: true }).click();
  await start(page, '上传文件');
  await selectTarget(page, target);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await chooser
  ).setFiles([
    {
      name: 'upload-' + suffix + '.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('queue payload'),
    },
    {
      name: 'second-' + suffix + '.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('second payload'),
    },
  ]);
  const tray = page.getByRole('dialog', { name: /^上传队列/ });
  await expect(tray).toBeVisible();
  await expect(tray.getByText('upload-' + suffix + '.txt', { exact: true })).toBeVisible();
  await tray.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('link', { name: '我的分享', exact: true }).click();
  await page.getByRole('button', { name: /^上传队列/ }).click();
  await expect(page.getByRole('dialog', { name: /^上传队列/ })).toBeVisible();
  await expect
    .poll(async () => {
      const result = await api(page, '?parent=' + String(folder.id));
      return (result.items as { name: string }[]).map((item) => item.name);
    })
    .toEqual(expect.arrayContaining(['upload-' + suffix + '.txt', 'second-' + suffix + '.txt']));
  await page.screenshot({ path: info.outputPath('shared-queue.png'), fullPage: true });
  await page
    .getByRole('dialog', { name: /^上传队列/ })
    .getByRole('button', { name: '关闭', exact: true })
    .click();
  await page.getByRole('link', { name: '传输中心', exact: true }).click();
  await page.getByRole('button', { name: /^上传队列/ }).click();
  await expect(page.getByRole('dialog', { name: /^上传队列/ })).toHaveCount(0);
  await start(page, '上传目录');
  await selectTarget(page, target);
  const directory = info.outputPath('directory-' + suffix);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'nested.txt'), 'directory contents');
  const directoryChooser = page.waitForEvent('filechooser');
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (await directoryChooser).setFiles(directory);
  await expect
    .poll(async () => {
      const result = await api(page, '?parent=' + String(folder.id));
      return (result.items as { name: string }[]).map((item) => item.name);
    })
    .toContain('directory-' + suffix);
  const directoryListing = await api(page, '?parent=' + String(folder.id));
  const child = (directoryListing.items as { id: string; name: string }[]).find(
    (entry) => entry.name === 'directory-' + suffix,
  );
  if (!child) throw new Error('Uploaded directory not found');
  await expect
    .poll(async () => {
      const result = await api(page, '?parent=' + child.id);
      return (result.items as { name: string }[]).map((entry) => entry.name);
    })
    .toContain('nested.txt');
  const childListing = await api(page, '?parent=' + child.id);
  const nested = (childListing.items as { id: string; name: string }[]).find(
    (entry) => entry.name === 'nested.txt',
  );
  if (!nested) throw new Error('Uploaded directory child not found');
  await page.goto('/home?parent=' + child.id);
  await page.getByRole('button', { name: 'nested.txt 的操作', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: '下载', exact: true }).click();
  const download = await downloadEvent;
  const saved = await download.path();
  if (!saved) throw new Error('Downloaded directory file missing');
  expect((await readFile(saved)).toString()).toBe('directory contents');
});
test('F233–234：搜索按页面区分，保留文件目录条件与表单键盘', async ({ page }) => {
  const suffix = randomUUID().slice(0, 8);
  const root = await api(page, '/folders', { parentId: '', name: '000131-search-' + suffix });
  await api(page, '/text', {
    parentId: root.id,
    name: 'needle-' + suffix + '.txt',
    text: 'find me',
    key: randomUUID(),
  });
  await page.getByRole('link', { name: '我的分享', exact: true }).click();
  await expect(page).toHaveURL(/\/home\/shares$/);
  await expect(
    page.getByRole('searchbox', { name: '搜索标题或原文件名', exact: true }),
  ).toBeVisible();
  await page.getByRole('main').focus();
  await page.keyboard.press('/');
  await expect(
    page.getByRole('searchbox', { name: '搜索标题或原文件名', exact: true }),
  ).toBeFocused();
  await page.getByRole('link', { name: '选择文件分享', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('searchbox', { name: '搜索文件', exact: true })).toBeVisible();
  await page.getByRole('main').focus();
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox', { name: '搜索文件', exact: true })).toBeFocused();
  await page.getByRole('searchbox', { name: '搜索文件', exact: true }).fill('needle-' + suffix);
  await page.getByRole('searchbox', { name: '搜索文件', exact: true }).press('Enter');
  await expect(page).toHaveURL(new RegExp('search=needle-' + suffix));
  await expect(
    page.getByRole('button', { name: 'needle-' + suffix + '.txt', exact: true }),
  ).toBeVisible();
  await page.goto('/home?parent=' + String(root.id) + '&category=document');
  await page.getByRole('searchbox', { name: '搜索文件', exact: true }).fill('needle');
  await page.getByRole('searchbox', { name: '搜索文件', exact: true }).press('Enter');
  await expect(page).toHaveURL(new RegExp('parent=' + String(root.id)));
  await expect(page).toHaveURL(/category=document/);
  await page.getByRole('searchbox', { name: '搜索文件', exact: true }).press('/');
  await expect(page.getByRole('searchbox', { name: '搜索文件', exact: true })).toHaveValue(
    'needle/',
  );
});
test('F235：存储失败显示未知，重试恢复真实配额', async ({ page }) => {
  await page.route('**/api/console/v1/native/files?**', async (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get('pageSize') === '1')
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    else await route.continue();
  });
  await page.getByRole('link', { name: '我的分享', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '存储空间', exact: true }).getByRole('alert'),
  ).toContainText('存储空间未知');
  await page.unroute('**/api/console/v1/native/files?**');
  await page.getByRole('button', { name: '刷新存储空间', exact: true }).click();
  await expect(
    page.getByRole('region', { name: '存储空间', exact: true }).getByRole('progressbar'),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: '存储空间', exact: true }).getByRole('alert'),
  ).toHaveCount(0);
});
test('F236–238：文件页账户菜单、主题语言及客户端锁屏', async ({ page }, info) => {
  await page.getByRole('link', { name: '我的分享', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: info.outputPath('dark-english-workspace.png'), fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Current user', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Language English', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /个人账户/ })).toBeVisible();
  await page.getByRole('menuitem', { name: /锁定屏幕/ }).click();
  const lock = page.getByRole('dialog', { name: '锁屏', exact: true });
  await expect(lock).toBeVisible();
  const background = page.getByRole('navigation', { name: '我的文件', exact: true });
  await expect(background.locator('xpath=ancestor::*[@inert]')).toHaveCount(1);
  await background.getByRole('link', { name: '我的文件', exact: true }).focus();
  await expect(lock.getByLabel('账号密码', { exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('workspace-lock.png'), fullPage: true });
  await lock.getByLabel('账号密码', { exact: true }).fill('incorrect');
  await lock.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(lock.getByRole('alert')).toBeVisible();
  await lock.getByLabel('账号密码', { exact: true }).fill((await access()).password);
  await lock.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(lock).toHaveCount(0);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /锁定屏幕/ }).click();
  await lock.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /个人账户/ }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto('/home/shares');
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /个人偏好/ }).click();
  await expect(page).toHaveURL(/\/settings/);
  await page.goto('/home/shares');
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /退出登录/ }).click();
  await expect(page).toHaveURL(/\/login/);
});

// 已完成回执与空态都是全局面板的真实状态，不能依赖恰好在上传结束前打开。
test('F240：空队列明确呈现，上传结束后打开仍保留本标签完成回执', async ({ page }, info) => {
  await page.getByRole('button', { name: /^上传队列/ }).click();
  let tray = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(tray.getByText('本页没有匹配的传输记录', { exact: true })).toBeVisible();
  await expect(tray.getByRole('link', { name: '传输中心', exact: true })).toBeVisible();
  await tray.getByRole('button', { name: '关闭', exact: true }).click();
  const suffix = randomUUID().slice(0, 8),
    parent = await api(page, '/folders', { parentId: '', name: '000131-receipt-' + suffix }),
    name = 'receipt-' + suffix + '.txt';
  await page.goto('/home?parent=' + String(parent.id));
  await expect(page.getByRole('button', { name: '上传文件', exact: true })).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '上传文件', exact: true }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('publication receipt') });
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^上传队列/ }).click();
  tray = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(tray.locator('[data-transfer-id]').filter({ hasText: name })).toContainText(
    '上传完成',
  );
  await page.screenshot({ path: info.outputPath('completed-queue-receipt.png'), fullPage: true });
});
