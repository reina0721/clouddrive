import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Mobile workbench detail preserves identity, selection and list focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/page-archetypes/resource-list');
  const rows = page.getByRole('grid').getByRole('row');
  await expect(rows).toHaveCount(21);
  const row = rows.nth(1);
  const recordId = await row.getAttribute('data-key');
  if (!recordId) throw new Error('The first workbench row must have a stable identity');
  await row.click();
  const detail = page.getByRole('dialog');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(recordId);
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await detail.getByRole('button', { name: '关闭详情', exact: true }).click();
  await expect(detail).toBeHidden();
  await expect(row).toHaveAttribute('data-selected', 'true');
  await expect
    .poll(() => row.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  await expect(row).toBeInViewport();

  const nextRow = rows.nth(2);
  const nextId = await nextRow.getAttribute('data-key');
  if (!nextId) throw new Error('The next workbench row must have a stable identity');
  await nextRow.click();
  await expect(detail).toContainText(nextId);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(detail).toBeHidden();
  await expect(page.getByRole('complementary').nth(1)).toContainText(nextId);
  await expect(nextRow).toHaveAttribute('data-selected', 'true');
});
