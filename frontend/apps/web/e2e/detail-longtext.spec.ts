import { expect, test } from '@playwright/test';

test('详情展示模式默认简洁：详情页不显示附加信息', async ({ page }) => {
  await page.goto('/reference-resources/detail?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByText('资源标识', { exact: true })).not.toBeVisible();
});

test('详情展示模式=完整：详情页显示附加信息（真实联动）', async ({ page }) => {
  await page.goto('/settings/actions');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: /默认详情展示模式/ })
    .getByText('完整', { exact: true })
    .click();
  await page.waitForTimeout(300);
  await page.goto('/reference-resources/detail?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 完整模式：附加信息真实展示（资源标识 + 完整说明项）。
  await expect(page.getByText('资源标识', { exact: true })).toBeVisible();
  await expect(page.getByText('完整说明', { exact: true })).toBeVisible();
});

test('长文本默认截断：换行模式给文本换行类', async ({ page }) => {
  await page.goto('/settings/data-display');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '数据展示' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '长文本默认处理' })
    .getByText('换行', { exact: true })
    .click();
  await page.waitForTimeout(300);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 工作流列首个 rowheader 的名称 <p> 应有 break-words（非 truncate）。
  const firstCell = page.getByRole('rowheader').first();
  await expect(firstCell).toBeVisible();
  await expect(firstCell.locator('p').first()).toHaveClass(/break-words/);
});
