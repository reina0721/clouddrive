import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

type IconState = { revision: number; inherit: boolean; items: unknown[] };
const iconSource = 'https://icons.example.test/fixture.svg';

async function api<T>(page: Page, path: string, method = 'GET', payload?: unknown) {
  const result = await page.evaluate(
    async ({ path, method, payload }) => {
      const root = '/api/console/v1';
      const headers = new Headers();
      if (method !== 'GET') {
        const { token } = (await (await fetch(root + '/auth/csrf')).json()) as { token: string };
        headers.set('X-CSRF-Token', token);
        headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(root + '/native/files' + path, {
        method,
        headers,
        cache: 'no-store',
        ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
      });
      if (!response.ok) throw new Error('Fixture HTTP ' + response.status);
      return (await response.json()) as unknown;
    },
    { path, method, payload },
  );
  return result as T;
}

test('扩展名图标保存、主题渲染、外部图片失败回退与恢复内置', async ({ page }, info) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!accessPath, '文件图标配置只使用隔离预览。');
  const account = JSON.parse((await readFile(accessPath!, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
    url: string;
  };
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const initial = await api<IconState>(page, '/icon-rules');
  const folder = await api<{ id: string }>(page, '/folders', 'POST', {
    parentId: '',
    name: '图标验收-' + randomUUID().slice(0, 8),
  });
  async function textFile(name: string) {
    return api<{ id: string }>(page, '/text', 'POST', {
      parentId: folder.id,
      name,
      key: randomUUID(),
      text: 'icon fixture',
    });
  }
  const existing = await textFile('existing.RULE164');
  const remote = await textFile('external.remote164');
  const broken = await textFile('broken.remote164fail');
  const nested = await api<{ id: string }>(page, '/folders', 'POST', {
    parentId: folder.id,
    name: 'nested.rule164',
  });
  await api(page, '/' + nested.id + '/annotations', 'PUT', {
    expectedRevision: 0,
    tags: [],
    properties: [],
    emoji: '',
    folderColor: '#445566',
  });
  let receivedImage = false;
  await page.route('https://icons.example.test/**', async (route) => {
    receivedImage = true;
    const headers = route.request().headers();
    expect(headers.cookie).toBeUndefined();
    expect(headers.referer).toBeUndefined();
    if (route.request().url().endsWith('/broken.svg')) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'image/svg+xml' },
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
    });
  });
  async function openRules() {
    await page.goto('/system-tools/filesystem');
    await page.getByRole('tab', { name: '文件图标', exact: true }).click();
    await expect(page.getByRole('heading', { name: '文件图标', exact: true })).toBeVisible();
  }
  async function shape(name: string) {
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /图标类型/ })
      .click();
    await page.getByRole('option', { name, exact: true }).click();
  }
  const add = page.getByRole('button', { name: '添加图标', exact: true });
  const save = page.getByRole('button', { name: '保存图标规则', exact: true });
  const dialog = page.getByRole('dialog');
  const apply = dialog.getByRole('button', { name: '应用到草稿', exact: true });
  const extensions = dialog.getByLabel('扩展名列表', { exact: true });
  try {
    await openRules();
    await expect(page.getByRole('list', { name: '文件图标' })).toBeVisible();
    await add.click();
    await shape('压缩包');
    await extensions.fill('a/b');
    await expect(dialog.getByText('扩展名无效或超过数量上限。')).toBeVisible();
    await extensions.fill('rule164, .RULE164');
    await expect(dialog.getByText('扩展名已在本行或其他规则中使用。')).toBeVisible();
    await expect(apply).toBeDisabled();
    await extensions.fill('.RULE164, extra164');
    const light = dialog.getByLabel('浅色图标颜色', { exact: true });
    await light.fill('red');
    await expect(dialog.getByText('请输入六位十六进制颜色。')).toBeVisible();
    await light.fill('#112233');
    await dialog.getByLabel('深色图标颜色', { exact: true }).fill('#abcdee');
    await apply.click();
    await expect(dialog).toHaveCount(0);
    await add.click();
    await shape('图像 URL');
    await extensions.fill('remote164');
    const image = dialog.getByRole('textbox', { name: '图像 URL', exact: true });
    await image.fill('http://icons.example.test/fixture.svg');
    await expect(apply).toBeDisabled();
    await image.fill(iconSource);
    await apply.click();
    await add.click();
    await shape('图像 URL');
    await extensions.fill('remote164fail');
    await image.fill('https://icons.example.test/broken.svg');
    await apply.click();
    await save.click();
    await expect(page.getByText('文件图标规则已保存。')).toBeVisible();
    await openRules();
    const archiveRow = page.getByRole('listitem').filter({ hasText: 'rule164, extra164' });
    await expect(archiveRow).toContainText('#112233 / #abcdee');
    await archiveRow.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('icons-admin.png') });

    const location = '/home?parent=' + folder.id;
    await page.goto(location);
    const archiveFile = page.locator('[data-file-item="' + existing.id + '"]');
    const glyph = archiveFile.locator('[data-file-icon="archive"]');
    await expect(glyph).toHaveCSS('color', 'rgb(17, 34, 51)');
    const folderGlyph = page.locator('[data-file-item="' + nested.id + '"] svg.lucide-folder');
    await expect(folderGlyph).toHaveCSS('color', 'rgb(68, 85, 102)');
    const remoteFile = page.locator('[data-file-item="' + remote.id + '"]');
    const remoteGlyph = remoteFile.locator('img[data-file-icon="image-url"]');
    await expect
      .poll(() => remoteGlyph.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    expect(receivedImage).toBe(true);
    const brokenFile = page.locator('[data-file-item="' + broken.id + '"]');
    await expect(brokenFile.locator('svg.lucide-file-text, svg.lucide-file')).toBeVisible();
    await expect(brokenFile.locator('img[data-file-icon="image-url"]')).toHaveCount(0);
    await page.getByRole('button', { name: '视图', exact: true }).click();
    await page.getByRole('menuitem', { name: '列表', exact: true }).click();
    await expect(archiveFile).toHaveAttribute('role', 'row');
    await expect(glyph).toBeVisible();
    await page.getByRole('button', { name: '当前用户', exact: true }).click();
    await page.getByRole('menuitem', { name: /^主题 / }).click();
    await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
    await expect(glyph).toHaveCSS('color', 'rgb(171, 205, 238)');
    await page.getByRole('button', { name: '视图', exact: true }).click();
    await page.getByRole('menuitem', { name: '网格', exact: true }).click();
    await expect(glyph).toBeVisible();
    await page.screenshot({ path: info.outputPath('icons-dark-grid.png') });
    await api(page, '/' + existing.id + '/annotations', 'PUT', {
      expectedRevision: 0,
      tags: [],
      properties: [],
      emoji: '🚀',
      folderColor: '',
    });
    await page.reload();
    await expect(archiveFile.getByText('🚀', { exact: true })).toBeVisible();
    await expect(glyph).toHaveCount(0);

    await openRules();
    await archiveRow.getByRole('button', { name: '编辑图标', exact: true }).click();
    await dialog.getByLabel('浅色图标颜色', { exact: true }).fill('#123456');
    await apply.click();
    await archiveRow.getByRole('button', { name: '移除', exact: true }).click();
    const stored = await api<IconState>(page, '/icon-rules');
    await api(page, '/icon-rules', 'PUT', {
      revision: stored.revision,
      inherit: stored.inherit,
      items: stored.items,
    });
    await save.click();
    await expect(
      page.getByRole('alert').filter({ hasText: '其他管理员已更新图标规则' }),
    ).toBeVisible();
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(archiveRow).toBeVisible();
    await archiveRow.getByRole('button', { name: '移除', exact: true }).click();
    await save.click();
    await expect(archiveRow).toHaveCount(0);
    await page.getByRole('button', { name: '恢复内置规则', exact: true }).click();
    await save.click();
    await expect.poll(async () => (await api<IconState>(page, '/icon-rules')).inherit).toBe(true);
    await page.setViewportSize({ width: 320, height: 740 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  } finally {
    const final = await api<IconState>(page, '/icon-rules');
    if (final.revision !== initial.revision)
      await api(page, '/icon-rules', 'PUT', {
        revision: final.revision,
        inherit: initial.inherit,
        items: initial.items,
      });
    await api(page, '/' + folder.id + '/trash', 'POST');
  }
});
