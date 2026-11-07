import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('存储策略显示真实用量并在窄屏保存和恢复分片上限', async ({ page }, info) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!accessPath, '存储策略写入测试只使用隔离 QA。');
  const account = JSON.parse(
    (await readFile(resolve(__dirname, accessPath!), 'utf8')).replace(/^\uFEFF/, ''),
  ) as { url: string; username: string; password: string };
  const origin = new URL(account.url).origin;
  expect(origin).toBe('http://127.0.0.1:4194');
  await page.goto(origin + '/login?returnTo=%2Fsystem-tools%2Fstorage');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '存储策略', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '存储策略', exact: true })).toHaveCount(1);
  await expect(page.getByText('本机存储', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '加载统计数据', exact: true }).click();
  for (const field of ['已引用 Blob', '历史版本引用', '登记待回收大小', '统计时间']) {
    await expect(page.getByText(field, { exact: true })).toBeVisible();
  }
  await page.screenshot({
    path: info.outputPath('storage-policy-desktop.png'),
    animations: 'disabled',
  });
  const edit = page.getByRole('region', { name: '存储与上传', exact: true });
  const chunk = edit.getByLabel('上传分片上限（字节）', { exact: true });
  const original = await chunk.inputValue();
  const pending = '已保存的限额将在服务重启后生效。';
  await page.setViewportSize({ width: 320, height: 760 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  const save = async (takeScreenshot: boolean) => {
    await edit.getByRole('button', { name: '保存上传限额', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '确认上传限额', exact: true });
    await expect(dialog.getByText('上传分片上限（字节）', { exact: false })).toBeVisible();
    if (takeScreenshot) {
      await page.screenshot({
        path: info.outputPath('storage-policy-mobile.png'),
        animations: 'disabled',
      });
    }
    await dialog.getByRole('button', { name: '保存上传限额', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  };
  await chunk.fill('0');
  await expect(edit.getByRole('button', { name: '保存上传限额', exact: true })).toBeDisabled();
  await chunk.fill(original === '1024' ? '2048' : '1024');
  try {
    await save(true);
    await expect(edit.getByText(pending, { exact: true })).toBeVisible();
  } finally {
    await chunk.fill(original);
    const submit = edit.getByRole('button', { name: '保存上传限额', exact: true });
    if (await submit.isEnabled()) await save(false);
  }
});
