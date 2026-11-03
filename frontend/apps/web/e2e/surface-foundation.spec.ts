import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const archetypes = [
  '/page-archetypes/overview',
  '/page-archetypes/resource-list',
  '/page-archetypes/detail',
  '/page-archetypes/create-edit',
  '/page-archetypes/settings',
  '/page-archetypes/master-detail',
  '/page-archetypes/operation',
] as const;

const viewports = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

test('Initial detail content stays readable; tab selection alone triggers content swap', async ({
  page,
}) => {
  await page.goto('/page-archetypes/resource-list');
  const detail = page.locator('.surface-split-detail');
  const content = detail.locator('[data-motion-recipe="content-swap"]');
  await expect(content).toHaveAttribute('data-swap-entry', 'false');
  await expect(content).toHaveCSS('animation-name', 'none');
  const tabs = detail.getByRole('tab');
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toBeFocused();
  await expect(content).toHaveAttribute('data-swap-entry', 'true');
  await expect(content).toHaveCSS('animation-name', 'content-fade-in');
  await tabs.first().click();
  await expect(content).toHaveAttribute('data-swap-entry', 'true');
});

test('七类 Page Archetype 在四级视口可直接验收', async ({ page }) => {
  test.setTimeout(120_000);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of archetypes) {
      await page.goto(route);
      await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // 页面实现按需加载：等内容入场/揭示动画结束后再扫描，避免把过渡中的混合色判为对比度问题。
      await page.waitForFunction(() =>
        document.getAnimations().every((animation) => animation.playState !== 'running'),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(0);

      if (viewport.width === 1440 || viewport.width === 390) {
        const accessibility = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(accessibility.violations, `${route} at ${viewport.width}px`).toEqual([]);
      }
    }
  }
});

test('Universal 与 Surface authority 视觉面保持分层', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // 页面实现按需加载：截图前等入场/揭示动画结束，否则稳定产物也会出现混合帧差异。
  const settle = async () => {
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== 'running'),
    );
    await page.waitForFunction(
      () => document.querySelectorAll('[data-reveal="pending"]').length === 0,
    );
  };
  await page.goto('/motion');
  await settle();
  await expect
    .soft(page)
    .toHaveScreenshot('universal-motion-desktop.png', { fullPage: true, animations: 'disabled' });

  await page.goto('/page-patterns/collections-data');
  await settle();
  await expect.soft(page).toHaveScreenshot('page-patterns-collections-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.goto('/page-archetypes/overview');
  await settle();
  await expect.soft(page).toHaveScreenshot('page-archetypes-overview-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });
});
