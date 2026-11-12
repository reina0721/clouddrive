import { expect, test } from '@playwright/test';

test('Motion Inspector 按模式、分类与慢速倍率统一控制 recipe', async ({ page }) => {
  await page.goto('/motion');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const inspector = page.getByTestId('motion-inspector');
  await expect(inspector).toBeVisible();
  await inspector.getByRole('radio', { name: 'off', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion-mode', 'off');
  await inspector.getByRole('radio', { name: '4×', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('html')
        .evaluate((element) => element.style.getPropertyValue('--motion-debug-scale')),
    )
    .toBe('4');
  await inspector.getByRole('button', { name: 'reveal', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion-reveal', 'off');
  await expect(page.getByRole('heading', { name: '独立阅读项 6' }).locator('..')).toHaveAttribute(
    'data-reveal',
    'revealed',
  );
});
