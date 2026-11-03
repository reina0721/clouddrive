import { expect, test } from '@playwright/test';

test('界面密度=紧凑：data-density 写入且控件间距 Token 收缩', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '外观' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '界面密度' })
    .getByText('紧凑', { exact: true })
    .click();
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  const spacing = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--spacing-control').trim(),
  );
  expect(spacing).toBe('2.25rem');
});

test('界面字号=大：data-font-scale 写入且根字号放大', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '外观' }).first().scrollIntoViewIfNeeded();
  await page.getByRole('radiogroup', { name: '界面字号' }).getByText('大', { exact: true }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-font-scale', 'large');
  const fontSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  // 112.5% of 16px = 18px。
  expect(fontSize).toBe('18px');
});

test('内容宽度=标准：主内容区 max-width 生效', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '外观' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '内容宽度' })
    .getByText('标准', { exact: true })
    .click();
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-content-width', 'standard');
});

test('高对比度=高：data-contrast 写入且焦点环 Token 加强', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '外观' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: /^高对比度/ })
    .getByText('高对比度', { exact: true })
    .last()
    .click();
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  const ring = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--spacing-focus-ring-width')
      .trim(),
  );
  expect(ring).toBe('.1875rem');
});
