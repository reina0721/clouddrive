import { test, expect } from '@playwright/test';
import { e2eBaseUrl } from './base-url';
import AxeBuilder from '@axe-core/playwright';

for (const width of [1440, 320]) {
  test(`Comparison choices adapt to their container and retain long labels at ${width}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: e2eBaseUrl,
      viewport: { width, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto('/ui-elements/forms');
      const longText = page.getByRole('switch', { name: '扩展文本', exact: true }).first();
      await longText.press('Space');
      await expect(longText).toBeChecked();
      const group = page.getByRole('radiogroup', { name: '比较预览', exact: true });
      const cards = await group.locator('label').evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            width: bounds.width,
            height: bounds.height,
            flow: getComputedStyle(element).flexDirection,
          };
        }),
      );
      expect(cards).toHaveLength(3);
      for (const card of cards) {
        expect(card.width).toBeGreaterThanOrEqual(44);
        expect(card.height).toBeGreaterThanOrEqual(44);
        expect(card.flow).toBe(width === 320 ? 'row' : 'column');
      }
      await group.getByRole('radio', { name: /^引导执行/ }).press('ArrowRight');
      await expect(group.getByRole('radio', { name: /^仅观察/ })).toBeChecked();
      await expect(group.getByRole('radio', { name: /^自动执行/ })).toBeDisabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });
}

test('System contrast responds independently of the assistive-settings toggle', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: e2eBaseUrl, contrast: 'more' });
  try {
    const page = await context.newPage();
    await page.goto('/settings/accessibility');
    const followSystem = page.getByRole('switch', {
      name: '跟随操作系统辅助功能设置',
      exact: true,
    });
    await followSystem.press('Space');
    await expect(followSystem).not.toBeChecked();
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-system-contrast', 'more');
    const group = page.getByRole('radiogroup', { name: '高对比度', exact: true });
    await expect(group.getByRole('radio', { name: '跟随系统', exact: true })).toBeChecked();
    const example = page.getByText('辅助文字与边界示例', { exact: true });
    const systemColor = await example.evaluate((element) => getComputedStyle(element).color);
    await group
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: '标准', exact: true }) })
      .click();
    await expect
      .poll(() => example.evaluate((element) => getComputedStyle(element).color))
      .not.toBe(systemColor);
    const result = await new AxeBuilder({ page })
      .include('#main-content')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  } finally {
    await context.close();
  }
});

test('Mobile category navigation honors scroll preference after drawer focus restoration', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: e2eBaseUrl,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const choose = async (name: string) => {
      await page.getByRole('button', { name: /切换分类与搜索/ }).click();
      const drawer = page.getByRole('dialog', { name: '设置分类' });
      await drawer.getByRole('link', { name, exact: true }).click();
      await expect(drawer).not.toBeVisible();
    };
    await page.goto('/settings');
    await page.getByRole('button', { name: '切换预览内容', exact: true }).click();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
    await choose('通知');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const title = await page.getByRole('heading', { level: 1 }).boundingBox();
    const header = await page.getByRole('banner').boundingBox();
    if (!title || !header) throw new Error('Missing navigation geometry');
    expect(title.y).toBeGreaterThanOrEqual(header.y + header.height);
    await choose('导航');
    const scrollPreference = page.getByRole('switch', {
      name: '跳转后自动滚动到顶部',
      exact: true,
    });
    await scrollPreference.press('Space');
    await expect(scrollPreference).not.toBeChecked();
    await page.getByRole('button', { name: '恢复全部默认', exact: true }).press('End');
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await choose('外观');
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

for (const width of [1440, 390, 320]) {
  test(`Semantic appearance choices preserve preview, selection and persistence at ${width}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: e2eBaseUrl,
      locale: 'zh-CN',
      viewport: { width, height: 900 },
      hasTouch: width < 500,
    });
    try {
      const page = await context.newPage();
      await page.goto('/settings');
      await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
      const accent = page.getByRole('radiogroup', { name: '强调色', exact: true });
      await expect(accent.locator('[data-accent-preview]')).toHaveCount(4);
      const swatches = await accent
        .locator('[data-accent-preview]')
        .evaluateAll((elements) =>
          elements.map((element) => getComputedStyle(element).backgroundColor),
        );
      expect(new Set(swatches).size).toBe(4);
      const blue = accent
        .locator('label')
        .filter({ has: page.getByRole('radio', { name: '蓝色', exact: true }) });
      if (width < 500) await blue.tap();
      else await blue.click();
      await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
      await page.reload();
      await expect(accent.getByRole('radio', { name: '蓝色', exact: true })).toBeChecked();
      const density = page.getByRole('radiogroup', { name: '界面密度', exact: true });
      await density
        .locator('label')
        .filter({ has: page.getByRole('radio', { name: '紧凑', exact: true }) })
        .click();
      await density.getByRole('radio', { name: '紧凑', exact: true }).press('ArrowRight');
      await expect(density.getByRole('radio', { name: '标准', exact: true })).toBeChecked();
      const motion = page.getByRole('radiogroup', { name: '动效偏好', exact: true });
      await motion
        .locator('label')
        .filter({ has: page.getByRole('radio', { name: '减少动效', exact: true }) })
        .click();
      await page.getByRole('button', { name: '切换预览内容', exact: true }).click();
      const preview = page.locator('[data-motion-recipe="content-swap"]');
      await expect(preview).toContainText('内容已切换');
      expect(
        await preview.evaluate((element) =>
          parseFloat(getComputedStyle(element).animationDuration),
        ),
      ).toBeLessThan(0.001);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      const accessibility = await new AxeBuilder({ page })
        .include('#main-content')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(accessibility.violations).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
