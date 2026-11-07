import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('存储策略可在窄屏试测、保存和恢复上传名称规则', async ({ page }, info) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!accessPath, '名称规则写入只在隔离 QA 验收。');
  const account = JSON.parse(
    (await readFile(resolve(__dirname, accessPath!), 'utf8')).replace(/^\uFEFF/, ''),
  ) as { url: string; username: string; password: string };
  const origin = new URL(account.url).origin;
  expect(origin).toBe('http://127.0.0.1:4194');
  await page.goto(origin + '/login?returnTo=%2Fsystem-tools%2Fstorage');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const panel = page.getByRole('region', { name: '上传名称规则', exact: true });
  const extensions = panel.getByLabel('文件扩展名', { exact: true });
  const original = await extensions.inputValue();
  const candidate = panel.getByLabel('试测文件名', { exact: true });
  const submit = panel.getByRole('button', { name: '保存名称规则', exact: true });
  const save = async (screenshot = false) => {
    await submit.click();
    const dialog = page.getByRole('dialog', { name: '确认名称规则', exact: true });
    await expect(dialog.getByText('文件扩展名', { exact: true })).toBeVisible();
    if (screenshot) {
      await page.screenshot({
        path: info.outputPath('name-rules-mobile.png'),
        animations: 'disabled',
      });
    }
    await dialog.getByRole('button', { name: '保存名称规则', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  };
  const proposed = original === 'txt' ? 'md' : 'txt';
  await extensions.fill(proposed);
  await candidate.fill('blocked.bin');
  await panel.getByRole('button', { name: '测试名称', exact: true }).click();
  await expect(panel.getByText('被扩展名规则拒绝', { exact: true })).toBeVisible();
  await candidate.fill('accepted.' + proposed.toUpperCase());
  await panel.getByRole('button', { name: '测试名称', exact: true }).click();
  await expect(panel.getByText('通过规则', { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('name-rules-desktop.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 320, height: 760 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  try {
    await save(true);
    await expect(
      panel.getByText('保存的名称规则将在服务重启后生效。', { exact: true }),
    ).toBeVisible();
  } finally {
    await extensions.fill(original);
    if (await submit.isEnabled()) await save();
  }
});
