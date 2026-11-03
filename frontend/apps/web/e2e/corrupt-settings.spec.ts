import { expect, test } from '@playwright/test';

test('损坏的设置记录：显示原因与恢复动作，恢复后回到默认', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 预置非法 JSON → 重载。
  await page.evaluate(() => {
    window.localStorage.setItem('clouddrive.shell', '{not-valid-json');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const bannerText = page.getByText('本地设置记录无法读取');
  await expect(bannerText).toBeVisible();
  const banner = page.locator('[role="alert"]').filter({ hasText: '本地设置记录无法读取' });
  await banner.getByRole('button', { name: '恢复默认设置' }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByText('本地设置记录无法读取')).not.toBeVisible();
  const shell = await page.evaluate(() => window.localStorage.getItem('clouddrive.shell'));
  expect(shell).not.toBeNull();
  expect(() => {
    const parsed: unknown = JSON.parse(shell!);
    return parsed;
  }).not.toThrow();
});
