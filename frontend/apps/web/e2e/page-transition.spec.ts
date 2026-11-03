import { expect, test, type Page } from '@playwright/test';

/**
 * 117：页面切换动画偏好（Vben 对标）。
 *
 * 断言基于 CSS recipe 的 computed animation-name（动画结束后 `both` 仍保留属性值），
 * 避免依赖动画帧时序；默认值必须保持项目现行方向进入。
 */

const RECIPE = {
  fade: 'surface-screen-fade',
  'fade-slide': 'surface-screen-fade-slide',
  'fade-up': 'surface-screen-fade-up',
  'fade-down': 'surface-screen-fade-down',
} as const;

const OPTIONS = [
  { value: 'fade', label: '淡入' },
  { value: 'fade-slide', label: '淡入滑动' },
  { value: 'fade-up', label: '淡入上滑' },
  { value: 'fade-down', label: '淡入下滑' },
] as const;

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function resetPreferences(page: Page) {
  await ready(page, '/settings');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function pickTransition(page: Page, value: string) {
  await ready(page, '/settings');
  const field = page.locator('.ui-field').filter({ hasText: '页面切换动画' });
  await field.getByRole('button').click();
  await page.locator(`[id$="-option-${value}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-page-transition', value);
}

/** 从首页点击侧栏「基座能力」，产生一次 SPA 导航。 */
async function navigateToFoundations(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const openNav = page.getByRole('button', { name: '打开导航' });
  if (await openNav.isVisible()) await openNav.click();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '基座能力' })
    .click();
  await expect(page).toHaveURL(/\/foundations$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function animationName(page: Page, selector: string): Promise<string> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    return element ? getComputedStyle(element).animationName : 'missing';
  }, selector);
}

async function animationDuration(page: Page, selector: string): Promise<string> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    return element ? getComputedStyle(element).animationDuration : 'missing';
  }, selector);
}

async function waitForAnimation(page: Page, expected: string) {
  await expect
    .poll(async () => animationName(page, '.surface-route-content > .surface-page-stack'))
    .toBe(expected);
}

test.describe('page transition preference', () => {
  test('默认值保留项目现行方向进入（标题轻量过渡，整页不重放）', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetPreferences(page);
    await expect(page.locator('html')).toHaveAttribute('data-page-transition', 'default');

    await navigateToFoundations(page);
    await page.waitForTimeout(400);
    expect(await animationName(page, '.surface-route-content > .surface-page-stack')).toBe('none');
    expect(
      await animationName(
        page,
        '.surface-route-content > .surface-page-stack:not(:has([data-route-content])) > header',
      ),
    ).toMatch(/^(content-rise-in|surface-enter-forward)$/);
  });

  test('旧存储记录（无 pageTransition 字段）仍落在默认动画', async ({ page }) => {
    await ready(page, '/settings');
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('clouddrive.shell');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { state?: { preferences?: { appearance?: unknown } } };
      if (parsed.state?.preferences?.appearance) {
        delete (parsed.state.preferences.appearance as Record<string, unknown>).pageTransition;
      }
      window.localStorage.setItem('clouddrive.shell', JSON.stringify(parsed));
    });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-page-transition', 'default');
  });

  for (const option of OPTIONS) {
    test(`选择「${option.label}」后 SPA 导航播放 ${RECIPE[option.value]}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await resetPreferences(page);
      await pickTransition(page, option.value);
      await expect(page.locator('html')).toHaveAttribute('data-page-transition', option.value);

      await navigateToFoundations(page);
      await waitForAnimation(page, RECIPE[option.value]);
      // 标题动画让位，避免与整页 recipe 叠加。
      expect(
        await animationName(
          page,
          '.surface-route-content > .surface-page-stack:not(:has([data-route-content])) > header',
        ),
      ).toBe('none');

      // 刷新后偏好保持。
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-page-transition', option.value);
    });
  }

  test('「关闭」停用页面切换动画但保留其他动效偏好', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetPreferences(page);
    await pickTransition(page, 'none');
    await expect(page.locator('html')).toHaveAttribute('data-page-transition', 'none');

    await navigateToFoundations(page);
    await page.waitForTimeout(300);
    expect(await animationName(page, '.surface-route-content > .surface-page-stack')).toBe('none');
    expect(
      await animationName(
        page,
        '.surface-route-content > .surface-page-stack:not(:has([data-route-content])) > header',
      ),
    ).toBe('none');
  });

  test('减少动效时页面切换动画时长接近零', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await resetPreferences(page);
    await pickTransition(page, 'fade-slide');
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await navigateToFoundations(page);
    await page.waitForTimeout(400);
    const duration = await animationDuration(page, '.surface-route-content > .surface-page-stack');
    expect(parseFloat(duration)).toBeLessThan(0.05);
  });

  test('窄屏滑动切换不产生横向滚动', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await resetPreferences(page);
    await pickTransition(page, 'fade-slide');

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await page.getByRole('button', { name: '打开导航' }).click();
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '分析' })
      .click();
    await expect(page).toHaveURL(/\/analytics$/);
    await waitForAnimation(page, RECIPE['fade-slide']);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test('首次直接加载不重放页面切换动画', async ({ page }) => {
    await ready(page, '/foundations');
    await expect(page.locator('.surface-route-content')).toHaveAttribute(
      'data-route-enter',
      'false',
    );
    expect(await animationName(page, '.surface-route-content > .surface-page-stack')).toBe('none');
  });
});
