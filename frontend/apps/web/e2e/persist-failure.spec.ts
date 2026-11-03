import { expect, test } from '@playwright/test';

test('持久化失败：显示"未保存到此浏览器"且会话效果保留，允许重试', async ({ page }) => {
  await page.goto('/settings/navigation');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 模拟存储拒绝（quota）：令 localStorage.setItem 抛 QuotaExceededError。
  await page.evaluate(() => {
    const original: unknown = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')?.value;
    if (typeof original !== 'function') throw new Error('Storage setItem unavailable');
    (window as unknown as { __origSetItem: typeof original }).__origSetItem = original;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'clouddrive.shell') {
        const error = new DOMException('quota', 'QuotaExceededError');
        throw error;
      }
      Reflect.apply(original, this, [key, value]);
    };
  });
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  const sw = page.getByRole('switch', { name: '记住展开的侧栏菜单' });
  await sw.focus();
  await page.keyboard.press('Space');
  // 会话效果保留 + 失败横幅出现。
  await expect(sw).toBeChecked();
  await expect(page.getByText('未保存到此浏览器')).toBeVisible();
  // 恢复存储后重试 → 横幅消失且值持久化。
  await page.evaluate(() => {
    const orig = (window as unknown as { __origSetItem: typeof Storage.prototype.setItem })
      .__origSetItem;
    Storage.prototype.setItem = orig;
  });
  await page.getByRole('button', { name: '重试' }).click();
  await expect(page.getByText('未保存到此浏览器')).not.toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('switch', { name: '记住展开的侧栏菜单' })).toBeChecked();
});
