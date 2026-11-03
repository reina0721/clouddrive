import { expect, test } from '@playwright/test';

test('真实前端事件入通知中心：编辑保存 → notifications store 收纳成功通知', async ({ page }) => {
  // 清空偏好（默认 editSuccessDestination=stay）与 notifications store。
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.notifications');
    window.localStorage.removeItem('clouddrive.shell');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  // 编辑页保存（真实本地成功事件；默认去向=留在当前页 → 仍在 edit）。
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page).toHaveURL(/\/reference-resources\/edit\?id=resource-alpha$/);

  // notifications localStorage：收纳 success 通知（标题/描述，可序列化无函数）。
  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem('clouddrive.notifications');
    return raw ? (JSON.parse(raw) as { state?: { items?: unknown[] } }) : null;
  });
  const items = stored?.state?.items ?? [];
  expect(items.length).toBeGreaterThan(0);
  const item = items[0] as {
    category?: string;
    title?: string;
    description?: string;
    read?: boolean;
  };
  expect(item.category).toBe('success');
  expect(item.title).toBe('参考资源已保存');
  expect(item.read).toBe(false);
});
