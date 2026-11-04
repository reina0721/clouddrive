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
async function mutate(page: Page, path: string, body: unknown) {
  const response = await page.evaluate(
    async ({ path, body }) => {
      const csrf = (await (
        await fetch('/api/console/v1/auth/csrf', { credentials: 'include', cache: 'no-store' })
      ).json()) as { token: string };
      const result = await fetch('/api/console/v1/native/files' + path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        body: JSON.stringify(body),
      });
      return { status: result.status, value: (await result.json()) as { id: string } };
    },
    { path, body },
  );
  expect(response.status).toBe(200);
  return response.value;
}
async function addTag(page: Page, label: string, value: string) {
  const input = page.getByRole('dialog').getByLabel(label, { exact: true });
  await input.fill(value);
  await input.press('Enter');
}
async function apply(page: Page, label: string) {
  await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
const entries = (page: Page) => page.locator('[data-file-item]');

test('高级条件可取消、组合、移除、刷新恢复及拒绝无效链接', async ({ page }, info) => {
  test.setTimeout(180_000);
  await login(page);
  const folder = await mutate(page, '/folders', {
    parentId: '',
    name: '条件验收-' + randomUUID().slice(0, 8),
  });
  const child = await mutate(page, '/folders', { parentId: folder.id, name: '后代' });
  for (const [parentId, name, text] of [
    [folder.id, 'Alpha,报告.txt', 'abcd'],
    [folder.id, 'alpha-other.md', ''],
    [child.id, 'Alpha,报告-child.txt', 'abcde'],
  ]) {
    await mutate(page, '/text', { parentId, name, text, key: randomUUID() });
  }
  await page.goto('/home?parent=' + folder.id);
  await expect(entries(page)).toHaveCount(3);
  await page.getByRole('button', { name: '高级搜索', exact: true }).click();
  await addTag(page, '文件名关键词', '不会保存');
  await apply(page, '取消');
  await expect(page).not.toHaveURL(/filter=/);
  await page.getByRole('button', { name: '高级搜索', exact: true }).click();
  await addTag(page, '文件名关键词', 'Alpha,');
  await addTag(page, '文件名关键词', '报告');
  await addTag(page, '扩展名', '.TXT');
  await page.getByRole('dialog').getByLabel('普通文件', { exact: true }).press('Space');
  await page.getByRole('dialog').getByLabel('忽略大小写', { exact: true }).press('Space');
  await page.getByRole('dialog').getByLabel('最小文件大小', { exact: true }).fill('4');
  await page.getByRole('dialog').getByLabel('最大文件大小', { exact: true }).fill('5');
  await apply(page, '搜索');
  await expect(entries(page)).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Alpha,报告-child.txt', exact: true }),
  ).toBeVisible();
  const address = page.url();
  await page.reload();
  await expect(entries(page)).toHaveCount(2);
  await expect(page).toHaveURL(address);
  await page.getByRole('button', { name: '移除 文件名关键词: 报告', exact: true }).click();
  await expect(page).not.toHaveURL(/%E6%8A%A5%E5%91%8A/);
  await page.goBack();
  await expect(page).toHaveURL(address);
  await expect(entries(page)).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('advanced-search-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('advanced-search-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '清除全部条件', exact: true }).click();
  await expect(entries(page)).toHaveCount(3);
  await page.goto('/home?filter=%7Bbad');
  await expect(
    page.getByText('链接中的搜索条件或页码无效。请清除条件后重新搜索。', { exact: true }),
  ).toBeVisible();
  await expect(entries(page)).toHaveCount(0);
  await page.getByRole('button', { name: '清除全部条件', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test('分页、列表列偏好、目录优先及当前页键盘范围选择', async ({ page }, info) => {
  test.setTimeout(240_000);
  await login(page);
  const folder = await mutate(page, '/folders', {
    parentId: '',
    name: '分页验收-' + randomUUID().slice(0, 8),
  });
  await mutate(page, '/folders', { parentId: folder.id, name: 'zzz-folder' });
  for (let index = 0; index < 54; index++)
    await mutate(page, '/text', {
      parentId: folder.id,
      name: 'item-' + String(index).padStart(2, '0') + '.txt',
      text: '正文',
      key: randomUUID(),
    });
  await page.goto('/home?parent=' + folder.id);
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await expect(entries(page)).toHaveCount(50);
  await page.getByRole('checkbox', { name: '选择本页全部项目', exact: true }).press('Space');
  await expect(page.getByText('已选择 50 项', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(entries(page)).toHaveCount(5);
  await expect(page.getByText('已选择 50 项', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '视图选项', exact: true }).click();
  await page.getByRole('dialog').getByLabel('目录优先', { exact: true }).press('Space');
  await page.getByRole('dialog').getByLabel('类型', { exact: true }).press('Space');
  await page.getByRole('dialog').getByLabel('创建日期', { exact: true }).press('Space');
  await page.getByRole('dialog').getByLabel('显示缩略图', { exact: true }).press('Space');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /每页条目/ })
    .click();
  await page.getByRole('option', { name: '100', exact: true }).click();
  await apply(page, '保存');
  await expect(entries(page)).toHaveCount(55);
  await expect(entries(page).first()).toContainText('zzz-folder');
  await expect(page.getByRole('columnheader', { name: '类型', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '创建日期', exact: true })).toBeVisible();
  await page.reload();
  await expect(entries(page)).toHaveCount(55);
  await page
    .getByRole('button', { name: 'item-00.txt', exact: true })
    .click({ modifiers: ['Control'] });
  await page
    .getByRole('button', { name: 'item-03.txt', exact: true })
    .click({ modifiers: ['Shift'] });
  await expect(page.getByText('已选择 4 项', { exact: true })).toBeVisible();
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.getByRole('button', { name: 'item-04.txt', exact: true })).toBeFocused();
  await expect(page.getByText('已选择 5 项', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'item-10.txt', exact: true })
    .click({ modifiers: ['Control'] });
  await page
    .getByRole('button', { name: 'item-14.txt', exact: true })
    .click({ modifiers: ['Control', 'Shift'] });
  await expect(page.getByText('已选择 10 项', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'item-14.txt', exact: true })
    .click({ modifiers: ['Control'] });
  await expect(page.getByText('已选择 9 项', { exact: true })).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.getByRole('button', { name: 'item-53.txt', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('button', { name: 'zzz-folder', exact: true })).toBeFocused();
  await page.screenshot({ path: info.outputPath('file-columns-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('file-columns-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'item-00.txt', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('正文');
});

test('真实图片缩略图数量与开关、UTC日期还原和过长条件保留', async ({ page }, info) => {
  test.setTimeout(180_000);
  await login(page);
  const folder = await mutate(page, '/folders', {
    parentId: '',
    name: '图片验收-' + randomUUID().slice(0, 8),
  });
  await page.goto('/home?parent=' + folder.id);
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context) throw Error('Canvas unavailable');
    context.fillStyle = '#1689cc';
    context.fillRect(0, 0, 32, 32);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  // 顺序准备图片，避免把本场景变成共享传输准入压力测试；并发/重试由transfers流程覆盖。
  for (let index = 0; index < 13; index++) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '新建', exact: true }).click();
    await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: 'image-' + index + '.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
    await expect(entries(page)).toHaveCount(index + 1);
  }
  await expect(entries(page)).toHaveCount(13);
  await expect(entries(page).locator('img')).toHaveCount(12);
  await page.getByRole('button', { name: '视图选项', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('checkbox', { name: '显示缩略图', exact: true })
    .press('Space');
  await apply(page, '保存');
  await expect(entries(page).locator('img')).toHaveCount(0);
  await page.reload();
  await expect(entries(page)).toHaveCount(13);
  await expect(entries(page).locator('img')).toHaveCount(0);
  const day = new Date().toISOString().slice(0, 10),
    midnight = day + 'T00:00:00.000Z';
  const tomorrow = new Date(Date.parse(midnight) + 86_400_000).toISOString();
  const filter = {
    scope: 'folder',
    createdFrom: midnight,
    createdTo: tomorrow,
    modifiedFrom: midnight,
    modifiedTo: tomorrow,
  };
  await page.goto(
    '/home?parent=' + folder.id + '&filter=' + encodeURIComponent(JSON.stringify(filter)),
  );
  await expect(entries(page)).toHaveCount(13);
  await page.getByRole('button', { name: '高级搜索', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('spinbutton')).toHaveCount(12);
  await page.screenshot({ path: info.outputPath('advanced-dates-desktop.png'), fullPage: true });
  await apply(page, '搜索');
  await expect(entries(page)).toHaveCount(13);
  await page.getByRole('button', { name: '高级搜索', exact: true }).click();
  for (let index = 0; index < 3; index++)
    await addTag(page, '文件名关键词', '中文'.repeat(100) + String(index));
  await page.getByRole('dialog').getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('条件过长');
  await expect(page.getByRole('dialog').getByRole('button', { name: /移除 中文/ })).toHaveCount(3);
  await apply(page, '取消');
  await expect(entries(page)).toHaveCount(13);
});
