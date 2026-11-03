import { expect, test } from '@playwright/test';

test('相对时间=近似：通知条目显示"N 分钟前"（真实联动）', async ({ page }) => {
  // 设置 相对时间 = 近似。
  await page.goto('/settings/locale');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '语言与地区' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '相对时间' })
    .getByText('近似（如“5 分钟前”）', { exact: true })
    .click();
  await page.waitForTimeout(300);
  // 触发真实通知 → 打开中心。
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: /保存/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /通知/ }).first().click();
  const drawer = page.locator('[role="dialog"], [role="alertdialog"]');
  await expect(drawer).toBeVisible();
  const itemText = await drawer.locator('li').first().innerText();
  expect(itemText).toMatch(/分钟前|小时前|天前|刚刚|此刻/);
});

test('自动聚焦首个字段默认关：创建页不自动聚焦', async ({ page }) => {
  await page.goto('/reference-resources/create');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(400);
  const active = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(active).not.toBe('INPUT');
});

test('自动聚焦首个字段：开启后创建页聚焦名称输入', async ({ page }) => {
  // 设置 自动聚焦第一个可编辑字段 = 开。
  await page.goto('/settings/actions');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const sw = page.getByRole('switch', { name: '自动聚焦第一个可编辑字段' });
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toBeChecked();
  await page.waitForTimeout(300);
  await page.goto('/reference-resources/create');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 页面实现按需加载：等表单真正挂载后再断言焦点（固定等待在 dev 冷编译下不稳定）。
  await expect(page.locator('#create-form input').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? '')).toBe('INPUT');
  const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
  const inForm = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('#create-form')),
  );
  expect(activeTag).toBe('INPUT');
  expect(inForm).toBe(true);
});
