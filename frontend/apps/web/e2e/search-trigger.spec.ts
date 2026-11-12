import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

for (const width of [320, 390])
  for (const language of ['zh-CN', 'en'] as const)
    test(`Narrow search retains a usable typing area at ${width}px in ${language}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/page-archetypes/resource-list');
      await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
      if (language === 'en') {
        await page.getByRole('button', { name: '当前用户', exact: true }).click();
        await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
        await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      }
      const search = page.getByRole('searchbox', {
        name: language === 'en' ? 'Search reference data' : '搜索 Reference 数据',
      });
      await search.fill('Lin Chen');
      // 保留至少六个字号单位的实际输入宽度；清除按钮出现后也不能挤成单字符。
      expect(
        await search.evaluate(
          (input) =>
            input.getBoundingClientRect().width / parseFloat(getComputedStyle(input).fontSize),
        ),
      ).toBeGreaterThanOrEqual(6);
      await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
      await search.press('Enter');
      await expect(page.getByRole('grid').getByRole('row')).toHaveCount(13);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    });

test('搜索时机默认 Enter：键入不立即过滤，回车后过滤（48 记录中 Lin Chen 约 12 条）', async ({
  page,
}) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const search = page.getByRole('searchbox', { name: '搜索 Reference 数据' });
  await search.fill('Lin Chen');
  // 未按 Enter：仍 20 行/页（21 行含表头）。
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  // 回车应用过滤 → 行数下降。
  await page.keyboard.press('Enter');
  await expect(page.getByRole('grid').getByRole('row').first()).toBeVisible();
  const rowsAfter = await page.getByRole('grid').getByRole('row').count();
  expect(rowsAfter).toBeLessThan(21);
});

test('搜索时机=输入后自动搜索：键入立即过滤', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 搜索时机 = 输入后自动搜索。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '搜索时机' })
    .getByText('输入后自动搜索', { exact: true })
    .click();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('searchbox', { name: '搜索 Reference 数据' }).fill('Lin Chen');
  // 无需回车即过滤。
  await expect(page.getByRole('grid').getByRole('row').first()).toBeVisible();
  const rows = await page.getByRole('grid').getByRole('row').count();
  expect(rows).toBeLessThan(21);
});
