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

test('ViewportReveal 首次进入后保持 revealed，不因再次滚入而重播', async ({ page }) => {
  await page.goto('/motion');
  const reveal = page.getByRole('heading', { name: '独立阅读项 6' }).locator('..');
  await reveal.scrollIntoViewIfNeeded();
  await expect(reveal).toHaveAttribute('data-reveal', 'revealed');
  await page.evaluate(() => window.scrollTo(0, 0));
  await reveal.scrollIntoViewIfNeeded();
  await expect(reveal).toHaveAttribute('data-reveal', 'revealed');
});

test('ReadyImage 慢加载完成后不改变预留尺寸', async ({ page }) => {
  await page.goto('/ui-elements/identity-display');
  const readyImage = page.locator('[data-motion-recipe="media"]');
  const before = await readyImage.boundingBox();
  await expect(readyImage).toHaveAttribute('data-state', 'ready');
  const after = await readyImage.boundingBox();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
});
