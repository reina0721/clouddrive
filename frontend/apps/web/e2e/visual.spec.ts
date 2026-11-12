import { expect, test, type Page } from '@playwright/test';
import { waitForVisualReadiness } from './visual-readiness';

async function expectHydrated(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await waitForVisualReadiness(page);
}

async function expectReferenceReady(page: Page) {
  await expectHydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('高密度数据工作台');
  // 默认每页 20 → 首页 20 数据行 + 1 表头。
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
}

test('桌面与超宽屏 Reference 布局保持稳定', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/page-archetypes/resource-list');
  await expectReferenceReady(page);
  await expect.soft(page).toHaveScreenshot('reference-desktop.png', { fullPage: true });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  await expectReferenceReady(page);
  await expect.soft(page).toHaveScreenshot('reference-ultrawide.png', { fullPage: true });
});

test('桌面 UI Elements Family 保持基础组件权威面稳定', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/ui-elements/actions-selection');
  await expectHydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: '操作与选择' })).toBeVisible();
  await expect(page.getByText('公开 Element 46 / 46')).toBeVisible();
  await waitForVisualReadiness(page);
  await expect.soft(page).toHaveScreenshot('ui-elements-desktop.png', { fullPage: true });
  expect(consoleErrors).toEqual([]);
});

for (const family of [
  'actions-selection',
  'feedback',
  'status-async',
  'identity-display',
  'navigation',
  'data',
  'surfaces',
  'forms',
  'overlays',
] as const)
  test(`UI Element Family ${family} 保持独立视觉基线`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/ui-elements/${family}`);
    await expectHydrated(page);
    const sectionId = family === 'actions-selection' ? 'actions' : family;
    const section = page.locator(`#${sectionId}`);
    // HTML 水合完成后，身份恢复与业务区域仍可能尚未就绪。
    await section.waitFor({ state: 'visible' });
    await expect(page.getByText('公开 Element 46 / 46')).toBeVisible();
    // 按实际阅读顺序走过各示例，让屏外 Reveal 完成；不把半截入场帧当作基线。
    for (const item of await section.locator('[data-reveal-item]').all()) {
      await item.scrollIntoViewIfNeeded();
      await waitForVisualReadiness(page);
    }
    if (family === 'identity-display') {
      // 此场景验证真实图片；占位和 Avatar 回退不能代替 Image 的解码完成态。
      const images = section.locator('img[src="/avatar-demo.svg"]');
      await expect(images).toHaveCount(3);
      await images.evaluateAll((images) =>
        Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
      );
      await expect(section.locator('.ui-ready-image')).toHaveAttribute('data-state', 'ready');
    }
    // 区域截图保持桌面宽度，采集高度容纳整个区域与滚动留白；固定视口另有布局回归。
    const captureHeight = await section.evaluate((element) =>
      Math.ceil(
        element.getBoundingClientRect().height +
          2 * parseFloat(getComputedStyle(element).scrollMarginTop),
      ),
    );
    await page.setViewportSize({ width: 1440, height: Math.max(1000, captureHeight) });
    // 返回顶部后再由截图器定位区域，避免把停在页面中段的 sticky Header 截入长区域。
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await waitForVisualReadiness(page);
    await expect.soft(section).toHaveScreenshot(`ui-elements-family-${family}.png`);
  });

test('移动窗口、Dark Mode 与英文扩张保持无溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ui-elements/forms');
  await expectHydrated(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect.soft(page).toHaveScreenshot('ui-elements-mobile-dark-en.png', { fullPage: true });
});

test('移动侧栏打开状态纳入视觉回归', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/page-archetypes/resource-list');
  await expectHydrated(page);
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await expect.soft(page).toHaveScreenshot('mobile-navigation-open.png');
});

test('状态体系页面保持 Loading 与异常状态视觉基线', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/states');
  await expectHydrated(page);
  await expect(page.getByRole('heading', { name: '加载未完成' })).toBeVisible();
  await expect(page.getByRole('region', { name: '正在同步界面能力' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect.soft(page).toHaveScreenshot('states-desktop.png', { fullPage: true });
});

test('Overview、Reference Form 与 Settings 真实页面进入视觉矩阵', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/');
  await expectHydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.soft(page).toHaveScreenshot('overview-desktop.png', { fullPage: true });

  await page.goto('/page-archetypes/create-edit');
  await expectHydrated(page);
  await expect(page.getByRole('heading', { name: '复杂设置与审批表单' })).toBeVisible();
  await expect.soft(page).toHaveScreenshot('reference-form-desktop.png', { fullPage: true });

  await page.goto('/settings');
  await expectHydrated(page);
  // 根 /settings 即默认外观分类页（无索引主页）。
  await expect(page.getByRole('heading', { level: 1, name: '外观' })).toBeVisible();
  await expect.soft(page).toHaveScreenshot('settings-desktop.png', { fullPage: true });
});

test('Toast、Destructive Confirm 与 Compact Density 开启态进入视觉矩阵', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/ui-elements/feedback?overlay=toast&density=compact');
  await expectHydrated(page);
  await expect(page.getByText('项目反馈已入队')).toBeVisible();
  await expect.soft(page).toHaveScreenshot('ui-elements-toast-compact.png');

  await page.goto('/ui-elements/overlays?overlay=confirm');
  await expectHydrated(page);
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect.soft(page).toHaveScreenshot('ui-elements-destructive-confirm.png');
});

test('Reference 多选与分页的真实联动状态进入视觉矩阵', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/page-archetypes/resource-list');
  await expectReferenceReady(page);
  const rows = page.getByRole('grid').getByRole('row');
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveAttribute('data-selected', 'true');
  await rows.nth(2).focus();
  await rows.nth(2).press('Enter');
  await expect(page.getByText('已选 2 条')).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    for (const container of document.querySelectorAll<HTMLElement>(
      '[data-table-scroll-container]',
    )) {
      container.scrollLeft = 0;
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await expect.soft(page).toHaveScreenshot('reference-multi-select.png', { fullPage: true });
});
