import { expect, test } from '@playwright/test';
import { waitForVisualReadiness } from './visual-readiness';

test('RangeSlider keeps track edges on the fill role through themes and keyboard bounds', async ({
  page,
}) => {
  await page.goto('/ui-elements/forms');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page
    .locator('#element-rangeslider')
    .evaluate((heading) => heading.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await waitForVisualReadiness(page);
  const slider = page.getByRole('slider').first();
  await expect(slider).toHaveValue('50');
  await slider.focus();
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('51');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await waitForVisualReadiness(page);
    const colors = await page
      .locator('[data-slot="slider-track"]')
      .first()
      .evaluate((track) => {
        const fill = track.querySelector('[data-slot="slider-fill"]')!;
        const style = getComputedStyle(track);
        return { edge: style.borderInlineStartColor, fill: getComputedStyle(fill).backgroundColor };
      });
    expect(colors.edge).toBe(colors.fill);
    const focus = await page
      .locator('[data-slot="slider-thumb"]')
      .first()
      .evaluate((thumb) => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--color-focus-ring)';
        thumb.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return { shadow: getComputedStyle(thumb).boxShadow, color };
      });
    expect(focus.shadow).toContain(focus.color);
  }
  await slider.press('Home');
  await expect(slider).toHaveValue('0');
  await slider.press('End');
  await expect(slider).toHaveValue('100');
  const endColors = await page
    .locator('[data-slot="slider-track"]')
    .first()
    .evaluate((track) => ({
      edge: getComputedStyle(track).borderInlineEndColor,
      fill: getComputedStyle(track.querySelector('[data-slot="slider-fill"]')!).backgroundColor,
    }));
  expect(endColors.edge).toBe(endColors.fill);
  const disabled = page.getByRole('slider').nth(1);
  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveValue('25');
});
