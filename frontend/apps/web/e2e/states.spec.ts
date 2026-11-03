import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/states');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '正常结果之外，状态也是产品的一部分',
  );
});

test('Loading、Skeleton 与恢复动作保持完整状态语义', async ({ page }) => {
  const loadingRegion = page.getByRole('region', { name: '正在同步界面能力' });
  await expect(loadingRegion).toHaveAttribute('aria-busy', 'true');

  const skeletons = loadingRegion.locator('[data-slot="skeleton"]');
  await expect(skeletons).toHaveCount(3);
  for (const skeleton of await skeletons.all()) {
    await expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  }

  await page.getByRole('button', { name: '重新尝试' }).click();
  const recovery = page.getByRole('status').filter({ hasText: '能力已经恢复' });
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText('当前成功结果替代了先前失败状态');
  await expect(page.getByRole('button', { name: '重新尝试' })).toBeHidden();

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});
