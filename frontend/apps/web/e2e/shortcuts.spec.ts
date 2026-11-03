import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/shortcuts');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('Alt+Shift+N：参考列表执行"新建参考资源"命令（同一 run/可用性）', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/reference-resources');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page.getByRole('heading', { level: 1, name: '参考资源', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Alt+Shift+n');
  await expect(page).toHaveURL(/\/reference-resources\/create/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('创建参考资源');
});

test('快捷键关闭后 Alt+Shift+N 不再执行', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 快捷键 → 启用快捷键 = 关。
  await page.goto('/settings/shortcuts');
  await page.getByRole('heading', { name: '快捷键' }).first().scrollIntoViewIfNeeded();
  const enabled = page.getByRole('switch', { name: '启用快捷键' });
  await enabled.focus();
  await page.keyboard.press('Space');
  await expect(enabled).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/reference-resources');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.keyboard.press('Alt+Shift+n');
  await page.waitForTimeout(400);
  await expect(page).not.toHaveURL(/\/reference-resources\/create/);
});
