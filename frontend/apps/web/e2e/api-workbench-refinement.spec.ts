import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { safeParseWorkspaceSnapshot } from '@clouddrive/surface/api-workbench';
import {
  defaultPreferences,
  type AppearancePreferences,
} from '@clouddrive/surface/preferences-model';

const profiles: readonly Readonly<{
  name: string;
  width: number;
  height: number;
  collapsed: boolean;
  appearance: Partial<AppearancePreferences>;
  language?: 'en';
}>[] = [
  {
    name: '1920-light-expanded',
    width: 1920,
    height: 1080,
    collapsed: false,
    appearance: { themeMode: 'light' },
  },
  {
    name: '1440-dark-collapsed',
    width: 1440,
    height: 900,
    collapsed: true,
    appearance: { themeMode: 'dark', accent: 'blue', density: 'compact' },
  },
  {
    name: '1280-light-large',
    width: 1280,
    height: 800,
    collapsed: false,
    appearance: { themeMode: 'light', accent: 'green', fontScale: 'large', density: 'comfortable' },
  },
  {
    name: '1024-dark-high-contrast',
    width: 1024,
    height: 768,
    collapsed: true,
    appearance: { themeMode: 'dark', accent: 'orange', contrast: 'high', contentWidth: 'wide' },
  },
  {
    name: '768-system-small',
    width: 768,
    height: 900,
    collapsed: false,
    appearance: { themeMode: 'system', fontScale: 'small', contentWidth: 'standard' },
  },
  {
    name: '390-dark-english-large',
    width: 390,
    height: 844,
    collapsed: false,
    language: 'en',
    appearance: { themeMode: 'dark', density: 'comfortable', fontScale: 'large' },
  },
];

for (const profile of profiles) {
  test(`workbench appearance and navigation: ${profile.name}`, async ({ page }, testInfo) => {
    const evidence = testInfo.outputDir;
    await page.setViewportSize({ width: profile.width, height: profile.height });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.addInitScript(
      ({ preferences, profile }) => {
        localStorage.setItem(
          'clouddrive.shell',
          JSON.stringify({
            version: 1,
            state: {
              preferences: {
                ...preferences,
                appearance: { ...preferences.appearance, ...profile.appearance },
                navigation: { ...preferences.navigation, sidebarBehavior: 'remember' },
                localeRegion: {
                  ...preferences.localeRegion,
                  language: profile.language ?? 'zh-CN',
                },
              },
              rememberedSidebarCollapsed: profile.collapsed,
            },
          }),
        );
      },
      { preferences: defaultPreferences, profile },
    );
    await page.goto('/api-workbench');
    const en = profile.language === 'en';
    await expect(
      page.getByRole('textbox', { name: en ? 'Request URL' : '请求 URL', exact: true }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme',
      profile.appearance.themeMode === 'light' ? 'light' : 'dark',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (profile.width >= 1024) {
      const navigation = page.getByRole('navigation', {
        name: en ? 'Primary navigation' : '主导航',
        exact: true,
      });
      const bounds = await page.locator('.surface-shell-grid > aside').boundingBox();
      expect(bounds?.x).toBe(0);
      expect(
        await navigation.evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      await page.reload();
      await expect(page.locator('.surface-shell-grid')).toHaveAttribute(
        'data-sidebar',
        profile.collapsed ? 'collapsed' : 'expanded',
      );
      await expect(
        page.getByRole('textbox', { name: en ? 'Request URL' : '请求 URL', exact: true }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: `${evidence}/profile-${profile.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    const result = await new AxeBuilder({ page })
      .include('[data-workbench-layout]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}

test('project tree can collapse without losing a draft', async ({ page }, testInfo) => {
  const evidence = testInfo.outputDir;
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/api-workbench');
  const url = page.getByRole('textbox', { name: '请求 URL', exact: true });
  await url.fill('mock://draft');
  await page.getByRole('button', { name: '收起项目树', exact: true }).click();
  await expect(page.getByRole('treegrid')).toHaveCount(0);
  await expect(url).toHaveValue('mock://draft');
  await page.getByRole('button', { name: '项目与接口', exact: true }).click();
  await expect(
    page.getByRole('row', { name: 'GET 获取用户列表 (Mock)', exact: true }),
  ).toBeVisible();
  await expect(url).toHaveValue('mock://draft');
  await page.screenshot({ path: `${evidence}/project-tree-toggle.png`, animations: 'disabled' });
});

test('long configuration, pending, response scrolling and failures remain usable', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/api-workbench');
  const url = page.getByRole('textbox', { name: '请求 URL', exact: true });
  await expect(url).toBeVisible();
  const key = 'clouddrive.api-workbench.workspace.v1';
  const raw = await page.evaluate((key) => localStorage.getItem(key), key);
  const input: unknown = JSON.parse(raw ?? '{}');
  const parsed = safeParseWorkspaceSnapshot(input);
  if (!parsed.success) throw new Error('Missing workspace');
  const entries = Array.from({ length: 24 }, (_, index) => ({
    id: `long-${index}`,
    key: `parameter_${index}`,
    value: 'long_value_'.repeat(30),
    enabled: true,
  }));
  await page.evaluate(({ key, snapshot }) => localStorage.setItem(key, JSON.stringify(snapshot)), {
    key,
    snapshot: {
      ...parsed.data,
      requests: parsed.data.requests.map((request, index) =>
        index === 0 ? { ...request, params: entries, headers: entries } : request,
      ),
    },
  });
  await page.reload();
  await expect(page.getByRole('textbox', { name: '参数名', exact: true })).toHaveCount(24);
  const last = page.getByRole('textbox', { name: '参数值', exact: true }).last();
  await last.focus();
  await expect(last).toBeFocused();
  await page.getByRole('tab', { name: /^请求头/ }).click();
  await expect(page.getByRole('textbox', { name: '参数名', exact: true })).toHaveCount(24);
  await page.getByRole('tab', { name: '脚本', exact: true }).click();
  await page.route('**/review-response*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: Array.from({ length: 200 }, (_, id) => ({ id, text: 'long JSON '.repeat(30) })),
      }),
    });
  });
  await url.fill(new URL('/review-response?long=' + 'segment'.repeat(80), page.url()).href);
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('heading', { name: '正在发送请求', exact: true })).toBeVisible();
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
  const body = page.locator('pre').filter({ has: page.locator('code') });
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.getByRole('tab', { name: '原始内容', exact: true }).click();
  await page.getByRole('tab', { name: '响应头', exact: true }).click();
  await page.getByRole('tab', { name: '格式化', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidence}/long-json.png`, animations: 'disabled' });
  await url.fill('unsupported://invalid');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('heading', { name: '请求失败', exact: true })).toBeVisible();
  await page.screenshot({ path: `${evidence}/transport-error.png`, animations: 'disabled' });
});

test('global appearance edits propagate to the workbench and persist after refresh', async ({
  page,
}, testInfo) => {
  const evidence = testInfo.outputDir;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/settings');
  await page.getByRole('radio', { name: '深色主题', exact: true }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('radio', { name: '蓝色', exact: true }).focus();
  await page.keyboard.press('Space');
  await page
    .getByRole('radiogroup', { name: '界面密度', exact: true })
    .getByRole('radio', { name: '紧凑', exact: true })
    .focus();
  await page.keyboard.press('Space');
  await page.getByRole('link', { name: '接口调试', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '请求 URL', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.reload();
  await expect(page.getByRole('textbox', { name: '请求 URL', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: `${evidence}/global-settings-live.png`, animations: 'disabled' });
});
