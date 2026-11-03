import { saveEvidenceScreenshot } from './evidence-screenshot';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';

const evidence = 'docs/changes/109-ui-ux-optimization/evidence/scroll-items';

test('settings keeps its shell stable and enters semantic regions inside the nested Page', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '工作台', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '个人偏好', exact: true })
    .click();
  await expect(page).toHaveURL('/settings');
  const stack = page.locator('[data-route-content] > .surface-page-stack');
  await expect.poll(() => stack.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  await expect
    .poll(() =>
      stack
        .locator('[id^=settings-][data-reveal]')
        .first()
        .evaluate((e) => getComputedStyle(e).animationName),
    )
    .toContain('surface-item-enter');
  await expect
    .poll(() =>
      page.locator('main h1').evaluate((e) => getComputedStyle(e.closest('header')!).animationName),
    )
    .not.toContain('surface-enter-forward');
});

for (const width of [1440, 390, 320]) {
  test(`progressive settings remains usable through long, fast and reverse scrolling at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 360 });
    await page.addInitScript(() => {
      const Original = window.IntersectionObserver;
      let active = 0;
      let peak = 0;
      window.IntersectionObserver = class extends Original {
        private counted = false;
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          super(callback, options);
          if (options?.rootMargin === '0px' && options.threshold === 0) {
            this.counted = true;
            peak = Math.max(peak, ++active);
            document.documentElement.dataset.testObserverPeak = String(peak);
          }
        }
        override disconnect() {
          super.disconnect();
          if (this.counted) {
            --active;
            this.counted = false;
          }
        }
      };
    });
    await page.goto('/settings/actions');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    const regions = page.locator('[id^=settings-][data-reveal]');
    await expect(regions.first()).toBeAttached();
    expect(await regions.count()).toBeGreaterThan(10);
    await expect(regions.last()).toHaveAttribute('data-reveal', 'pending');
    await expect(regions.first()).toHaveCSS('opacity', '1');
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const regionHeight = (await regions.first().boundingBox())!.height;
    expect(regionHeight).toBeGreaterThan(0);
    await regions.first().scrollIntoViewIfNeeded();
    await expect(regions.first()).toHaveAttribute('data-reveal', 'revealed');
    await expect
      .poll(() =>
        regions.first().evaluate((e) => e.getAnimations().some((a) => a.playState === 'running')),
      )
      .toBe(false);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(regions.last()).toHaveAttribute('data-reveal', 'revealed');
    await page.evaluate(() => window.scrollTo(0, 0));
    await regions.first().scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        regions.first().evaluate((e) => e.getAnimations().some((a) => a.playState === 'running')),
      )
      .toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
    expect(Number(await page.locator('html').getAttribute('data-test-observer-peak'))).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await mkdir(evidence, { recursive: true });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await saveEvidenceScreenshot(page, {
      animations: 'disabled',
      path: `${evidence}/settings-actions-${width}.png`,
      fullPage: true,
    });
  });
}

for (const mode of ['missing', 'silent', 'reduced'] as const) {
  test(`content is immediately available with ${mode} motion observation`, async ({ page }) => {
    if (mode === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    else
      await page.addInitScript((variant) => {
        Object.defineProperty(window, 'IntersectionObserver', {
          configurable: true,
          value:
            variant === 'missing'
              ? undefined
              : class {
                  observe() {}
                  unobserve() {}
                  disconnect() {}
                },
        });
      }, mode);
    await page.goto('/settings/actions');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    const region = page.locator('#settings-actionPreferences-showSearchSuggestions');
    await expect(region).toHaveCSS('opacity', '1');
    await expect(region).toHaveCSS('transform', 'none');
    await region.getByRole('switch', { name: '显示搜索建议', exact: true }).focus();
    await expect(region).toHaveAttribute('data-reveal', 'revealed');
    await expect(region).toHaveAttribute('data-reveal-entry', 'false');
    await region.getByRole('switch', { name: '显示搜索建议', exact: true }).press('Space');
    await expect(
      region.getByRole('switch', { name: '显示搜索建议', exact: true }),
    ).not.toBeChecked();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.getByRole('switch', { name: '显示搜索建议', exact: true })).not.toBeChecked();
  });
}

test('anchor refresh and browser return never leave reading content hidden', async ({ page }) => {
  await page.goto('/settings/actions#settings-actionPreferences-showSearchSuggestions');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const region = page.locator('#settings-actionPreferences-showSearchSuggestions');
  const target = page.locator('#settings-actionPreferences-showSearchSuggestions');
  await expect(target).toBeInViewport();
  await expect(target.getByRole('switch')).toBeFocused();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(target).toBeInViewport();
  await expect(target.getByRole('switch')).toBeFocused();
  await expect(region).toHaveCSS('opacity', '1');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '工作台', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  await page.goBack();
  await expect(page).toHaveURL(/settings\/actions/);
  await expect(region).toHaveCSS('opacity', '1');
});

test('master detail swaps locally while preserving selection focus', async ({ page }) => {
  await page.goto('/page-archetypes/master-detail');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const action = page.getByRole('button', { name: '发布准备', exact: true });
  await action.click();
  await expect(action).toBeFocused();
  const detail = page.locator('.surface-split-detail');
  await expect(detail.getByRole('heading', { name: '发布准备', exact: true })).toBeVisible();
  await expect(detail.locator('[data-motion-recipe="content-swap"]')).toHaveCount(1);
  await page.getByRole('button', { name: '审计队列', exact: true }).click();
  await expect(detail.getByRole('heading', { name: '审计队列', exact: true })).toBeVisible();
  await expect(detail.getByRole('heading', { name: '发布准备', exact: true })).toHaveCount(0);
});

test('an invalid bookmark fragment cannot interrupt hydration or hide settings', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/settings/actions#%E0%A4%A');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('heading', { name: '操作偏好', exact: true })).toBeVisible();
  await expect(page.locator('[id^=settings-][data-reveal]').last()).toHaveCSS('opacity', '1');
  expect(errors).toEqual([]);
});

for (const width of [320, 2048]) {
  test(`dark English expanded text keeps progressive regions accessible at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.addInitScript(
      ({ preferences, version }) => {
        localStorage.setItem(
          'clouddrive.shell',
          JSON.stringify({
            version,
            state: {
              preferences: {
                ...preferences,
                appearance: { ...preferences.appearance, themeMode: 'dark', fontScale: 'large' },
                localeRegion: { ...preferences.localeRegion, language: 'en' },
              },
            },
          }),
        );
      },
      { preferences: defaultPreferences, version: PREFERENCES_VERSION },
    );
    await page.goto('/settings/actions');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await page.locator('[id^=settings-][data-reveal]').last().scrollIntoViewIfNeeded();
    await expect(page.locator('[id^=settings-][data-reveal]').last()).toHaveCSS('opacity', '1');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await mkdir(evidence, { recursive: true });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await saveEvidenceScreenshot(page, {
      animations: 'disabled',
      path: `${evidence}/settings-actions-dark-en-${width}.png`,
      fullPage: true,
    });
  });
}
