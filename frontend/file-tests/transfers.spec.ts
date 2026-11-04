import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

test.use({ actionTimeout: 15_000 });

test('大文件暂停、跨路由、刷新重选校验、断点接续和原生下载', async ({ page }) => {
  test.setTimeout(180_000);
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
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const name = `续传-${Date.now()}.bin`;
  const content = Buffer.alloc(33 * 1024 * 1024, 87);
  const source = { name, mimeType: 'application/octet-stream', buffer: content };
  let release = () => {};
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  let chunks = 0;
  let networkFailureInjected = false;
  await page.route('**/native/files/transfers/*/data', async (route) => {
    if (route.request().method() === 'PATCH') {
      if (!networkFailureInjected) {
        networkFailureInjected = true;
        await route.fulfill({ status: 503, body: 'temporary test outage' });
        return;
      }
      if (++chunks >= 2) await gate;
    }
    await route.continue();
  });
  try {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '新建', exact: true }).click();
    await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
    await (await chooser).setFiles(source);
    const row = page.locator('[data-transfer-id]').filter({ hasText: name });
    await expect.poll(() => chunks).toBeGreaterThanOrEqual(2);
    const globalTray = page.getByRole('dialog', { name: '上传队列', exact: true });
    await expect(globalTray).toBeVisible();
    await row.getByRole('button', { name: '暂停', exact: true }).click();
    await expect(row).toContainText('已暂停');
    await row.getByRole('button', { name: '继续', exact: true }).click();
    await globalTray.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('link', { name: '传输中心', exact: true }).first().click();
    await expect(page).toHaveURL(/\/home\/transfers$/);
    await expect(row).toContainText('上传中');
    await row.getByRole('button', { name: '暂停', exact: true }).click();
    await expect(row).toContainText('已暂停');
    release();
    await expect(row).toContainText('已暂停');
    await expect(row).toContainText('4.0 MiB');
    await page.reload();
    await expect(row).toContainText('需要重新选择源文件');
    await page.getByRole('button', { name: '全部记录 任务状态', exact: true }).click();
    await page.getByRole('option', { name: '等待处理', exact: true }).click();
    await expect(row).toContainText('需要重新选择源文件');
    const wrongSource = page.waitForEvent('filechooser');
    await row.getByRole('button', { name: '重新选择源文件', exact: true }).click();
    await (await wrongSource).setFiles({ ...source, buffer: Buffer.alloc(content.length, 88) });
    await expect(page.getByRole('alert').filter({ hasText: '源文件内容不一致' })).toBeVisible();
    const correctSource = page.waitForEvent('filechooser');
    await row.getByRole('button', { name: '重新选择源文件', exact: true }).click();
    await (await correctSource).setFiles(source);
    await page.getByRole('button', { name: '等待处理 任务状态', exact: true }).click();
    await page.getByRole('option', { name: '已完成', exact: true }).click();
    await expect(row).toContainText('上传完成', { timeout: 60_000 });
    await page.screenshot({ path: 'test-results/files/transfers-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(row).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/files/transfers-mobile.png', fullPage: true });
    await page.getByRole('button', { name: '文件导航', exact: true }).click();
    await page
      .getByRole('dialog', { name: '文件导航', exact: true })
      .getByRole('link', { name: '我的文件', exact: true })
      .click();
    await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: '下载', exact: true }).click();
    const download = await downloadEvent;
    const saved = await download.path();
    expect(saved).not.toBeNull();
    expect(
      createHash('sha256')
        .update(await readFile(saved))
        .digest('hex'),
    ).toBe(createHash('sha256').update(content).digest('hex'));
    expect(errors).toEqual([]);
  } finally {
    release();
    if (!page.isClosed()) await page.unroute('**/native/files/transfers/*/data');
  }
});
