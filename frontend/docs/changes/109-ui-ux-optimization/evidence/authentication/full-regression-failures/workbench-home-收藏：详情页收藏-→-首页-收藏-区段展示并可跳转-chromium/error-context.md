# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workbench-home.spec.ts >> 收藏：详情页收藏 → 首页"收藏"区段展示并可跳转
- Location: apps\web\e2e\workbench-home.spec.ts:14:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/settings
Call log:
  - navigating to "http://127.0.0.1:4173/settings", waiting until "load"

```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | import { expect, test } from '@playwright/test';
  3  |
  4  | async function resetAll(page: Page) {
> 5  |   await page.goto('/settings');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/settings
  6  |   await page.evaluate(() => {
  7  |     window.localStorage.removeItem('clouddrive.shell');
  8  |     window.localStorage.removeItem('clouddrive.workbench');
  9  |   });
  10 |   await page.reload();
  11 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  12 | }
  13 |
  14 | test('收藏：详情页收藏 → 首页"收藏"区段展示并可跳转', async ({ page }) => {
  15 |   await resetAll(page);
  16 |   await page.goto('/reference-resources/detail?id=resource-alpha');
  17 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  18 |   await page.getByRole('button', { name: '收藏此页' }).click();
  19 |   // 已收藏态。
  20 |   await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible();
  21 |   // 首页显示收藏区段。
  22 |   await page.goto('/');
  23 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  24 |   await expect(page.getByRole('heading', { name: '收藏' })).toBeVisible();
  25 |   await expect(page.getByRole('link', { name: '参考资源详情' })).toBeVisible();
  26 | });
  27 |
  28 | test('最近访问：访问参考列表后首页"最近访问"区段展示（默认开）', async ({ page }) => {
  29 |   await resetAll(page);
  30 |   await page.goto('/reference-resources');
  31 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  32 |   await page.waitForTimeout(400);
  33 |   await page.goto('/');
  34 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  35 |   await expect(page.getByRole('heading', { name: '最近访问' })).toBeVisible();
  36 | });
  37 |
```
