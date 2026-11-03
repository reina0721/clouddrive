import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('DataTable 暴露单选、键盘与空集合契约', async ({ page }) => {
  await page.goto('/ui-elements/data');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  const table = page.getByRole('grid', { name: 'UI Element 治理状态' });
  await expect(table).toBeVisible();
  await expect(page.getByRole('rowheader', { name: /Semantic Tokens/ })).toBeVisible();

  const rows = table.getByRole('row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1)).toHaveAttribute('data-selected', 'true');

  await rows.nth(1).press('ArrowDown');
  await expect(rows.nth(2)).toHaveAttribute('data-selected', 'true');

  await page.getByRole('button', { name: '查看空集合' }).click();
  await expect(page.getByText('当前筛选条件下没有 UI Element。')).toBeVisible();
  await expect(table).toBeVisible();
  await expect(table).toHaveScreenshot('ui-elements-data-table-empty.png');

  await page.getByRole('button', { name: '恢复数据行' }).click();
  await expect(page.getByRole('rowheader', { name: /Form Control/ })).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Charts showcase uses the same accessible primitives as the analytics page', async ({
  page,
}) => {
  await page.goto('/ui-elements/data');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.locator('#charts')).toBeVisible();

  const charts = page.locator('#charts svg[role="img"]');
  expect(await charts.count()).toBeGreaterThanOrEqual(4);
  for (let index = 0; index < (await charts.count()); index += 1) {
    const label = await charts.nth(index).getAttribute('aria-label');
    expect(label && label.trim().length, `chart ${index} aria-label`).toBeTruthy();
  }

  const point = page.locator('#charts [data-chart-point][tabindex="0"]').first();
  await point.focus();
  await page.keyboard.press('ArrowRight');
  expect(
    await page.evaluate(() => document.activeElement?.hasAttribute('data-chart-point') ?? false),
  ).toBe(true);

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
