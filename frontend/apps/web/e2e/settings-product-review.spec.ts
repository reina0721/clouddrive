import { saveEvidenceScreenshot } from './evidence-screenshot';
import { test, expect, type Page } from '@playwright/test';
import { e2eBaseUrl } from './base-url';
import AxeBuilder from '@axe-core/playwright';
import {
  defaultPreferences,
  PREFERENCES_VERSION,
  type Preferences,
} from '@clouddrive/surface/preferences-model';

async function seedAppearance(
  page: Page,
  expanded: boolean,
  accent: Preferences['appearance']['accent'] = 'purple',
) {
  await page.addInitScript(
    ({ preferences, version, expanded, accent }) => {
      localStorage.setItem(
        'clouddrive.shell',
        JSON.stringify({
          version,
          state: {
            preferences: {
              ...preferences,
              appearance: {
                ...preferences.appearance,
                themeMode: expanded ? 'dark' : 'light',
                fontScale: expanded ? 'large' : 'standard',
                contrast: 'high',
                accent,
              },
              localeRegion: { ...preferences.localeRegion, language: expanded ? 'en' : 'zh-CN' },
            },
          },
        }),
      );
    },
    { preferences: defaultPreferences, version: PREFERENCES_VERSION, expanded, accent },
  );
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

// Cover every category under a normal desktop layout and the combined narrow/dark/English/large case.
for (const category of [
  '',
  'navigation',
  'data-display',
  'actions',
  'locale',
  'notifications',
  'accessibility',
  'security',
  'shortcuts',
]) {
  test(`All settings fields remain readable and accessible: ${category || 'appearance'}`, async ({
    browser,
  }, testInfo) => {
    const evidence = testInfo.outputDir;
    for (const expanded of [false, true]) {
      const context = await browser.newContext({
        baseURL: e2eBaseUrl,
        viewport: { width: expanded ? 320 : 1440, height: 900 },
        hasTouch: expanded,
      });
      try {
        const page = await context.newPage();
        await seedAppearance(page, expanded);
        await page.goto(`/settings${category ? `/${category}` : ''}`);
        await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
        await expectAccessible(page);
        if (expanded) {
          const navigation = page.getByRole('button', {
            name: 'Categories and search',
            exact: true,
          });
          await expect(navigation).toBeVisible();
          expect(
            await navigation.evaluate((element) => element.scrollWidth <= element.clientWidth),
          ).toBe(true);
        }
        if (category === '') {
          const theme = page.getByRole('radiogroup', {
            name: expanded ? 'Theme mode' : '主题模式',
            exact: true,
          });
          const labels = await theme
            .locator('.ui-choice-content .font-semibold')
            .evaluateAll((elements) =>
              elements.map(
                (element) =>
                  element.getBoundingClientRect().height /
                  Number.parseFloat(getComputedStyle(element).lineHeight),
              ),
            );
          expect(labels).toHaveLength(3);
          for (const lines of labels) expect(lines).toBeLessThanOrEqual(2);
        }
        const fieldCounts: Readonly<Record<string, number>> = {
          '': 10,
          navigation: 12,
          'data-display': 10,
          actions: 18,
          locale: 7,
          notifications: 7,
          accessibility: 4,
          security: 4,
          shortcuts: 2,
        };
        const expectedCount = fieldCounts[category];
        if (expectedCount === undefined) throw new Error('Missing field count for ' + category);
        await expect(page.getByRole('main').locator('[id^="settings-"]')).toHaveCount(
          expectedCount,
        );
        const fields = await page
          .getByRole('main')
          .locator('[id^="settings-"]')
          .evaluateAll((elements) =>
            elements.map((element) => ({
              id: element.id,
              width: element.getBoundingClientRect().width,
            })),
          );
        expect(fields.length).toBe(fieldCounts[category]);
        expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length);
        for (const field of fields) expect(field.width, field.id).toBeGreaterThanOrEqual(44);
        await saveEvidenceScreenshot(page, {
          path: `${evidence}/${category || 'appearance'}-${expanded ? '320-dark-en-large' : '1440-light'}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      } finally {
        await context.close();
      }
    }
  });
}

for (const family of ['forms', 'actions-selection', 'data', 'overlays']) {
  for (const expanded of [false, true]) {
    test(`Shared controls preserve high contrast: ${family}, ${expanded ? 'dark narrow English' : 'light desktop'}`, async ({
      browser,
    }, testInfo) => {
      const evidence = testInfo.outputDir;
      const context = await browser.newContext({
        baseURL: e2eBaseUrl,
        viewport: { width: expanded ? 390 : 1440, height: 900 },
      });
      try {
        const page = await context.newPage();
        await seedAppearance(page, expanded);
        await page.goto(`/ui-elements/${family}`);
        await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
        if (family === 'overlays') {
          const trigger = page.getByRole('button', { name: 'Dialog', exact: true });
          await trigger.press('Enter');
          const dialog = page.getByRole('dialog', {
            name: expanded ? 'Edit display name' : '编辑显示名称',
            exact: true,
          });
          await expect(dialog).toBeVisible();
          await page.keyboard.press('Tab');
          await expectAccessible(page);
          await saveEvidenceScreenshot(page, {
            path: `${evidence}/high-contrast-dialog-${expanded ? 'dark' : 'light'}.png`,
            animations: 'disabled',
          });
          await page.keyboard.press('Escape');
          await expect(dialog).not.toBeVisible();
          await expect(trigger).toBeFocused();
        } else {
          await expectAccessible(page);
        }
      } finally {
        await context.close();
      }
    });
  }
}

test('Collapsed desktop sidebar releases its grid column on mobile and restores it on desktop', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/settings/navigation');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const compact = page
    .getByRole('radiogroup', { name: '侧边栏状态', exact: true })
    .getByRole('radio', { name: '紧凑', exact: true });
  await compact.press('Space');
  await expect(compact).toBeChecked();
  const shell = page.locator('.surface-shell-grid');
  await expect(shell).toHaveAttribute('data-sidebar', 'collapsed');
  for (const width of [1023, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/settings', '/reference-resources']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
      const available = await page.evaluate(() => document.documentElement.clientWidth);
      await expect
        .poll(() =>
          page.getByRole('main').evaluate((element) => element.getBoundingClientRect().width),
        )
        .toBe(available);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(shell).toHaveAttribute('data-sidebar', 'collapsed');
    }
  }
  await saveEvidenceScreenshot(page, {
    path: `${evidence}/collapsed-sidebar-320.png`,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect
    .poll(() =>
      shell.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
    )
    .toBe(2);
  await expect(page.getByRole('button', { name: '展开侧栏', exact: true })).toBeVisible();
});

for (const accent of ['blue', 'green', 'orange'] as const) {
  for (const expanded of [false, true]) {
    test(`Dialog confirmation uses the accent foreground: ${accent}, ${expanded ? 'dark' : 'light'}`, async ({
      page,
    }, testInfo) => {
      const evidence = testInfo.outputDir;
      await page.setViewportSize({ width: expanded ? 390 : 1440, height: 900 });
      await seedAppearance(page, expanded, accent);
      await page.goto('/ui-elements/overlays');
      await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
      await page.getByRole('button', { name: 'Dialog', exact: true }).press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectAccessible(page);
      await saveEvidenceScreenshot(page, {
        path: `${evidence}/dialog-${accent}-${expanded ? 'dark' : 'light'}.png`,
        animations: 'disabled',
      });
    });
  }
}

for (const narrow of [false, true]) {
  test(`Settings search discovers previously missing fields and focuses their destination: ${narrow ? 'mobile' : 'desktop'}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: narrow ? 390 : 1440, height: 900 });
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    if (narrow) await page.getByRole('button', { name: /切换分类与搜索/ }).click();
    await page
      .getByRole('searchbox', { name: '搜索设置项', exact: true })
      .fill(narrow ? 'timezone' : '提示时长');
    const link = page.getByRole('link', {
      name: narrow ? '时区' : '非关键成功提示时长',
      exact: true,
    });
    await link.press('Enter');
    const fieldId = narrow
      ? 'settings-localeRegion-timeZone'
      : 'settings-notifications-toastDuration';
    await expect(page.locator(`#${fieldId}`)).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate((id) => document.activeElement?.closest(`#${id}`) !== null, fieldId),
      )
      .toBe(true);
  });
}
