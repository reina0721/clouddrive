import { saveEvidenceScreenshot } from './evidence-screenshot';
import { test, expect, type Page } from '@playwright/test';
import { e2eBaseUrl } from './base-url';
import AxeBuilder from '@axe-core/playwright';
import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';
async function expectHydrated(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

const evidence = 'account-menu';

async function openAccount(page: Page) {
  const trigger = page.getByRole('button', { name: /^(当前用户|Current user)$/ });
  await trigger.click();
  await expect(page.getByRole('menu', { name: /^(当前用户|Current user)$/ })).toBeVisible();
  return trigger;
}

async function expectWithinViewport(page: Page) {
  await test.info().attach('menu-geometry', {
    body: JSON.stringify(
      await page.evaluate(() => ({
        scroll: window.scrollY,
        menus: [...document.querySelectorAll('[role="menu"]')].map((e) => ({
          box: {
            x: e.getBoundingClientRect().x,
            y: e.getBoundingClientRect().y,
            width: e.getBoundingClientRect().width,
            height: e.getBoundingClientRect().height,
          },
          parent: e.parentElement?.getAttribute('style'),
        })),
      })),
    ),
    contentType: 'application/json',
  });
  for (const menu of await page.getByRole('menu').all()) {
    await expect
      .poll(async () => {
        const box = await menu.boundingBox();
        const viewport = page.viewportSize();
        return Boolean(
          box &&
          viewport &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width &&
          box.y + box.height <= viewport.height,
        );
      })
      .toBe(true);
  }
}

for (const width of [320, 390, 1440, 2048]) {
  test(`Account menu keeps identity, groups and language selection usable at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expectHydrated(page);
    await openAccount(page);
    await expect(page.getByText('demo@community.test', { exact: true })).toBeVisible();
    await expect(page.getByText('偏好设置', { exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
    await expect(
      page.getByRole('menuitemradio', { name: '简体中文', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    await expectWithinViewport(page);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await saveEvidenceScreenshot(page, { path: `${evidence}/language-${width}.png` });
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.reload();
    await expectHydrated(page);
    await openAccount(page);
    const restoredScroll = await page.evaluate(() => scrollY);
    await page.getByRole('menuitem', { name: 'Language English', exact: true }).click();
    await expect(page.getByRole('menuitemradio', { name: 'English', exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expectWithinViewport(page);
    expect(await page.evaluate(() => scrollY)).toBe(restoredScroll);
    await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).click();
  });
}

test('Account submenu keyboard returns focus; theme supports system and persisted choices', async ({
  page,
}) => {
  await page.goto('/');
  await expectHydrated(page);
  const trigger = await openAccount(page);
  const theme = page.getByRole('menuitem', { name: /^主题 / });
  await theme.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitemradio', { name: '跟随系统', exact: true })).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByRole('menuitemradio', { name: '浅色', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: '深色', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(trigger).toBeFocused();
  await openAccount(page);
  await theme.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitemradio', { name: '深色', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(theme).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await openAccount(page);
  await theme.click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expectHydrated(page);
  await openAccount(page);
  await expect(theme).toContainText('深色');
  await theme.click();
  await expect(page.getByRole('menuitemradio', { name: '深色', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('menuitemradio', { name: '跟随系统', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openAccount(page);
  await page.getByRole('menuitem', { name: '个人偏好', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('Dark English expanded text and Reduced Motion keep preference overlays accessible', async ({
  page,
}) => {
  await page.addInitScript(
    ({ preferences, version }) => {
      localStorage.setItem(
        'clouddrive.shell',
        JSON.stringify({
          version,
          state: {
            preferences: {
              ...preferences,
              appearance: {
                ...preferences.appearance,
                themeMode: 'dark',
                fontScale: 'large',
                contrast: 'high',
              },
              localeRegion: { ...preferences.localeRegion, language: 'en' },
            },
          },
        }),
      );
    },
    { preferences: defaultPreferences, version: PREFERENCES_VERSION },
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 400 });
  await page.goto('/');
  await expectHydrated(page);
  await openAccount(page);
  await page.getByRole('menuitem', { name: 'Theme Dark', exact: true }).click();
  await expectWithinViewport(page);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  await saveEvidenceScreenshot(page, { path: `${evidence}/dark-en-expanded-reduced.png` });
  await page.keyboard.press('Escape');
  await openAccount(page);
  const region = page.getByRole('region', { name: 'Current user', exact: true });
  await region.focus();
  await expect(region).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Sign out', exact: true })).toBeInViewport({
    ratio: 1,
  });
});

test('Hover crosses into submenu safely; a sticky header remains anchored after scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expectHydrated(page);
  await page.evaluate(() => window.scrollTo(0, 600));
  await openAccount(page);
  const language = page.getByRole('menuitem', { name: '语言 简体中文', exact: true });
  await language.hover();
  const english = page.getByRole('menuitemradio', { name: 'English', exact: true });
  await expect(english).toBeVisible();
  await english.hover();
  await expectWithinViewport(page);
  await saveEvidenceScreenshot(page, { path: `${evidence}/scrolled-hover-desktop.png` });
  await english.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('Touch selection and short viewport use the same nested overlay lifecycle', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 400 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${e2eBaseUrl}/`);
  await expectHydrated(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).tap();
  await page.getByRole('menuitem', { name: /^主题 / }).tap();
  await expectWithinViewport(page);
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).tap();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openAccount(page);
  await page.mouse.click(8, 380);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await context.close();
});

test('Overlay authority uses the same grouped menu with selection and disabled semantics', async ({
  page,
}) => {
  await page.goto('/ui-elements/overlays');
  await expectHydrated(page);
  await expect(page.getByText('uiElements.previewStateLabels.', { exact: false })).toHaveCount(0);
  const trigger = page.getByRole('button', { name: '分组与二级菜单', exact: true });
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: '归档（不可用）', exact: true })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.getByRole('menuitem', { name: '选择 编辑', exact: true }).click();
  await expect(page.getByRole('menuitemradio', { name: '编辑', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('menuitemradio', { name: '复制', exact: true }).click();
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: '选择 复制', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '选择 复制', exact: true }).click();
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  await saveEvidenceScreenshot(page, { path: `${evidence}/authority-grouped.png` });
});
