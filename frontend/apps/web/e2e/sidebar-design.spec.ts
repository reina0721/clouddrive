import { saveEvidenceScreenshot } from './evidence-screenshot';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const navigation = (page: Page) => page.getByRole('navigation', { name: '主导航' });
async function collapse(page: Page) {
  await page.goto('/ui-elements/navigation');
  // 页面实现按需加载：先等 shell hydration，避免冷编译时在按钮出现前就到超时。
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '收起侧栏' }).click();
  await expect(page.locator('aside').first()).toHaveCSS('width', '80px');
}

test('Compact rail uses coherent geometry, current route, named groups and focus/hover hints', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await collapse(page);
  const nav = navigation(page);
  const targets = nav.locator('a,button');
  for (const item of await targets.all()) {
    const box = await item.boundingBox();
    expect(box?.width).toBe(48);
    expect(box?.height).toBe(48);
    expect(box!.x + box!.width / 2).toBe(40);
    await expect(item.locator('svg').first()).toHaveCSS('width', '24px');
    await expect(item.locator('svg').first()).toHaveAttribute('aria-hidden', 'true');
  }
  await expect(nav.getByRole('list', { name: '个人', exact: true })).toBeVisible();
  const branch = nav.getByRole('button', { name: 'UI Elements', exact: true });
  await expect(branch).toHaveAttribute('data-active', 'true');
  const settings = nav.getByRole('link', { name: '个人偏好', exact: true });
  await settings.hover();
  await expect(page.getByRole('tooltip', { name: '个人偏好', exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, {
    path: `${evidence}/compact-tooltip.png`,
    animations: 'disabled',
  });
  await page.mouse.move(700, 200);
  await page.keyboard.press('Tab');
  await settings.focus();
  await expect(page.getByRole('tooltip', { name: '个人偏好', exact: true })).toBeVisible();
  await expect(settings).toBeFocused();
  await expect(settings).toHaveCSS('outline-style', 'solid');
  await expect(settings).toHaveCSS('outline-width', '2px');
  await page.evaluate(() => {
    document.documentElement.dataset.enhanceFocus = 'on';
  });
  await expect(settings).toHaveCSS('outline-width', '4px');
  await saveEvidenceScreenshot(page, {
    path: `${evidence}/compact-focus-enhanced.png`,
    animations: 'disabled',
  });
  await settings.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await settings.press('Enter');
  await expect(page).toHaveURL(/\/settings$/);
  await expect(settings).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(page.locator('aside').first()).toHaveCSS('width', '80px');
});

test('Hover bridge, click pin, second click close and keyboard focus survive pointer departure', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await collapse(page);
  const trigger = navigation(page).getByRole('button', { name: 'UI Elements', exact: true });
  const flyout = page.getByRole('dialog', { name: 'UI Elements', exact: true });
  await trigger.hover();
  await expect(flyout).toBeVisible();
  await expect(flyout.getByText('UI Elements', { exact: true })).toBeVisible();
  await flyout.getByRole('link', { name: '导航', exact: true }).hover();
  await expect(flyout.getByRole('link', { name: '导航', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(flyout).toBeVisible();
  await trigger.click();
  await page.mouse.move(700, 200);
  // Wait past the close corridor to prove press-open is durable.
  await page.waitForTimeout(400);
  await expect(flyout).toBeVisible();
  await trigger.click();
  await expect(flyout).toBeHidden();
  await page.mouse.move(700, 200);
  await trigger.focus();
  await trigger.press('Enter');
  await expect(flyout).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(flyout.getByRole('link').first()).toBeFocused();
  await page.mouse.move(700, 200);
  await page.waitForTimeout(400);
  await expect(flyout).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .include('nav')
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
  await saveEvidenceScreenshot(page, {
    path: `${evidence}/compact-flyout.png`,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(flyout).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Mode round trip retains exploration and closes old portal; expanded layout remains intact', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await page.goto('/');
  const nav = navigation(page);
  await nav.getByRole('button', { name: '展开或收起Page Patterns' }).click();
  await page.getByRole('button', { name: '收起侧栏' }).click();
  await nav.getByRole('button', { name: 'UI Elements', exact: true }).hover();
  await expect(page.getByRole('dialog', { name: 'UI Elements' })).toBeVisible();
  await page.getByRole('button', { name: '展开侧栏' }).click();
  await expect(page.getByRole('dialog', { name: 'UI Elements' })).toBeHidden();
  await expect(nav.getByRole('button', { name: '展开或收起Page Patterns' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(page.locator('aside').first()).toHaveCSS('width', '264px');
  await expect(nav.getByRole('link', { name: '工作台', exact: true }).locator('svg')).toHaveCSS(
    'width',
    '16px',
  );
  await saveEvidenceScreenshot(page, { path: `${evidence}/expanded.png`, animations: 'disabled' });
});

test('Compact rail stays usable at 1024/1440/2560, dark English, short height and text zoom', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await collapse(page);
  await page.getByRole('button', { name: '切换语言', exact: true }).click();
  await page.getByRole('button', { name: 'Switch theme', exact: true }).click();
  for (const width of [1024, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('aside').first()).toHaveCSS('width', '80px');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await saveEvidenceScreenshot(page, {
      path: `${evidence}/dark-en-${width}.png`,
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 1440, height: 480 });
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  const bottom = nav.getByRole('button', { name: 'UI Elements', exact: true });
  await bottom.focus();
  await expect(bottom).toBeInViewport();
  await bottom.press('Enter');
  const popup = page.getByRole('dialog', { name: 'UI Elements', exact: true });
  await expect(popup).toBeVisible();
  const bounds = await popup.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(480);
  await saveEvidenceScreenshot(page, {
    path: `${evidence}/short-dark-flyout.png`,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  // The shell's rem geometry follows the user's typography scale proportionally.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '125%';
  });
  await expect(page.locator('aside').first()).toHaveCSS('width', '100px');
  await expect(bottom).toHaveCSS('width', '60px');
  await expect(bottom.locator('svg').first()).toHaveCSS('width', '30px');
  await saveEvidenceScreenshot(page, {
    path: `${evidence}/text-scale-125.png`,
    animations: 'disabled',
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  // Exercise the same density/assistive token attributes applied by Host preferences.
  for (const [density, enhanceTarget, targetSize] of [
    ['compact', 'off', 40],
    ['comfortable', 'off', 56],
    ['compact', 'on', 56],
  ] as const) {
    await page.evaluate(
      ({ density, enhanceTarget }) => {
        document.documentElement.dataset.density = density;
        document.documentElement.dataset.enhanceTarget = enhanceTarget;
      },
      { density, enhanceTarget },
    );
    await expect(page.locator('aside').first()).toHaveCSS('width', `${targetSize + 32}px`);
    await expect(bottom).toHaveCSS('width', `${targetSize}px`);
    const icon = await bottom.locator('svg').first().boundingBox();
    expect(icon!.x + icon!.width / 2).toBe((targetSize + 32) / 2);
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await expect(page.locator('aside').first()).toHaveCSS('width', '264px');
    const expandedIcon = await nav
      .getByRole('link', { name: 'Workbench', exact: true })
      .locator('svg')
      .boundingBox();
    expect(expandedIcon!.x + expandedIcon!.width / 2).toBe((targetSize + 32) / 2);
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await expect(page.locator('aside').first()).toHaveCSS('width', `${targetSize + 32}px`);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (density === 'comfortable')
      await saveEvidenceScreenshot(page, {
        path: `${evidence}/comfortable-density.png`,
        animations: 'disabled',
      });
  }
});

test('Mobile Drawer remains expanded, traps focus and restores desktop collapse preference', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await collapse(page);
  for (const width of [320, 390, 768, 1023]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: '打开导航', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '主导航', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '展开或收起UI Elements' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(dialog.getByRole('link', { name: '导航', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(
      dialog.getByRole('link', { name: '工作台', exact: true }).locator('svg'),
    ).toHaveCSS('width', '16px');
    await saveEvidenceScreenshot(page, {
      path: `${evidence}/mobile-${width}.png`,
      animations: 'disabled',
    });
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      );
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: '打开导航', exact: true })).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('button', { name: '展开侧栏', exact: true })).toBeVisible();
  await expect(page.locator('aside').first()).toHaveCSS('width', '80px');
});

test.describe('Touch desktop rail', () => {
  test.use({ hasTouch: true });
  test('Tap opens a full submenu and selecting a child navigates and dismisses it', async ({
    page,
  }) => {
    await collapse(page);
    await navigation(page).getByRole('button', { name: 'UI Elements', exact: true }).tap();
    const flyout = page.getByRole('dialog', { name: 'UI Elements', exact: true });
    await expect(flyout).toBeVisible();
    await flyout.getByRole('link', { name: '反馈', exact: true }).tap();
    await expect(page).toHaveURL(/\/ui-elements\/feedback$/);
    await expect(flyout).toBeHidden();
  });
});

test('Reduced motion and repeated mode changes keep header and content in their grid column', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: '收起侧栏', exact: true }).click();
    await expect(page.locator('aside').first()).toHaveCSS('width', '80px');
    await page.getByRole('button', { name: '展开侧栏', exact: true }).click();
    await expect(page.locator('aside').first()).toHaveCSS('width', '264px');
  }
  const duration = await page
    .locator('.surface-shell-grid')
    .evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration));
  expect(duration).toBeLessThan(0.001);
  const scan = await new AxeBuilder({ page })
    .include('nav')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test('Icon navigation hint and flyout use the same primitives in the Overlay authority', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await page.goto('/ui-elements/overlays');
  const hint = page.getByRole('link', { name: '组合提示', exact: true });
  await page.keyboard.press('Tab');
  await hint.focus();
  await expect(page.getByRole('tooltip', { name: '组合提示', exact: true })).toBeVisible();
  await hint.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  const trigger = page.getByRole('button', { name: 'Overlay 与 Floating Layer', exact: true });
  await trigger.press('Enter');
  const flyout = page.getByRole('dialog', { name: 'Overlay 与 Floating Layer', exact: true });
  await expect(flyout).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
  await saveEvidenceScreenshot(page, {
    path: `${evidence}/overlay-authority.png`,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('Compact tooltip link preserves the Host leave confirmation before navigation', async ({
  page,
}) => {
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await page.getByLabel('名称').fill('Sidebar dirty navigation check');
  await page.getByRole('button', { name: '收起侧栏', exact: true }).click();
  const settings = navigation(page).getByRole('link', { name: '个人偏好', exact: true });
  await settings.hover();
  await expect(page.getByRole('tooltip', { name: '个人偏好', exact: true })).toBeVisible();
  await settings.click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page).toHaveURL(/\/reference-resources\/edit/);
  await settings.press('Enter');
  await confirmation.getByRole('button', { name: '离开', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('Standard motion changes width monotonically and keeps header/content naturally aligned', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '收起侧栏', exact: true })).toBeVisible();
  await expect(navigation(page).getByRole('link', { name: '工作台', exact: true })).toBeVisible();
  const sampleFrames = () =>
    page.evaluate(async () => {
      const shell = document.querySelector('.surface-shell-grid');
      const sidebar = shell?.querySelector('aside');
      const header = shell?.querySelector('header');
      const main = document.querySelector('main');
      if (!sidebar || !header || !main) throw new Error('Shell geometry missing');
      const frames = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(requestAnimationFrame);
        const icon = sidebar.querySelector('nav a svg')?.getBoundingClientRect();
        if (!icon) throw new Error('Navigation icon missing during mode transition');
        frames.push({
          rail: sidebar.getBoundingClientRect().width,
          header: header.getBoundingClientRect().x,
          main: main.getBoundingClientRect().x,
          iconCenter: icon.x + icon.width / 2,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        });
      }
      return frames;
    });
  for (const [label, finalWidth] of [
    ['收起侧栏', 80],
    ['展开侧栏', 264],
  ] as const) {
    const samples = sampleFrames();
    await page.getByRole('button', { name: label, exact: true }).click();
    const frames = await samples;
    expect(frames.at(-1)?.rail).toBe(finalWidth);
    expect(frames.some((frame) => frame.rail > 80 && frame.rail < 264)).toBe(true);
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]!;
      expect(frame.overflow).toBe(false);
      expect(Math.abs(frame.header - frame.rail)).toBeLessThan(1);
      expect(frame.main).toBeGreaterThanOrEqual(frame.rail);
      expect(frame.iconCenter).toBe(40);
      if (i > 0) {
        if (finalWidth === 80) expect(frame.rail).toBeLessThanOrEqual(frames[i - 1]!.rail + 0.5);
        else expect(frame.rail).toBeGreaterThanOrEqual(frames[i - 1]!.rail - 0.5);
      }
    }
  }
});
