import { expect, test } from '@playwright/test';
import { waitForVisualReadiness } from './visual-readiness';

test('ViewportReveal 首次进入后保持 revealed，不因再次滚入而重播', async ({ page }) => {
  await page.goto('/motion');
  const reveal = page.getByRole('heading', { name: '独立阅读项 6' }).locator('..');
  await reveal.scrollIntoViewIfNeeded();
  await expect(reveal).toHaveAttribute('data-reveal', 'revealed');
  await expect(page.getByTestId('motion-inspector')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await reveal.scrollIntoViewIfNeeded();
  await expect(reveal).toHaveAttribute('data-reveal', 'revealed');
});

test('ReadyImage 慢加载完成后不改变预留尺寸', async ({ page }) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/avatar-demo.svg', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/ui-elements/identity-display', { waitUntil: 'domcontentloaded' });
    const readyImage = page.locator('[data-motion-recipe="media"]');
    await readyImage.scrollIntoViewIfNeeded();
    await expect(readyImage).toHaveAttribute('data-state', 'loading');
    await waitForVisualReadiness(page);
    const before = await readyImage.boundingBox();
    release();
    await expect(readyImage).toHaveAttribute('data-state', 'ready');
    await waitForVisualReadiness(page);
    const after = await readyImage.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
  } finally {
    release();
  }
});
