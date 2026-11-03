import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetAll(page: Page) {
  await page.goto('/settings/notifications');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.notifications');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('通知中心：保存成功事件入铃铛 → 未读角标 → Drawer 列表 → 全部已读清角标', async ({ page }) => {
  await resetAll(page);
  // 编辑页保存（stay 默认）publish 真实 success 通知。
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '保存' }).click();
  // 铃铛（通知 aria）出现未读角标。
  const bell = page.getByRole('button', { name: /通知/ });
  await expect(bell).toContainText('1');
  // 打开通知中心。
  await bell.click();
  const center = page.getByRole('heading', { name: '通知中心' });
  await expect(center).toBeVisible();
  await expect(page.getByText('参考资源已保存')).toBeVisible();
  // 全部标为已读 → 关闭后角标消失（铃铛 aria 回到纯"通知"）。
  await page.getByRole('button', { name: '全部标为已读' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '通知', exact: true })).toBeVisible();
});

test('关闭 应用内通知：铃铛入口隐藏', async ({ page }) => {
  await resetAll(page);
  // 设置 → 通知 → 应用内通知 = 关。
  await page.goto('/settings/notifications');
  await page.getByRole('heading', { name: '通知' }).first().scrollIntoViewIfNeeded();
  const inApp = page.getByRole('switch', { name: '应用内通知' });
  await inApp.focus();
  await page.keyboard.press('Space');
  await expect(inApp).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('button', { name: /通知/ })).not.toBeVisible();
});
