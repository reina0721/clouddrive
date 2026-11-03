import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** 清空偏好（clouddrive.shell），保证每次测试从默认开始。 */
async function resetPreferences(page: Page) {
  await page.goto('/settings');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('打开 /settings 直接是外观分类页（默认页，无索引）：即时生效并持久化', async ({ page }) => {
  await resetPreferences(page);
  // resetPreferences 已停在根页。
  const h1s = page.getByRole('heading', { level: 1 });
  await expect(h1s).toHaveCount(1);
  await expect(h1s).toContainText('外观');

  const themeGroup = page.getByRole('radiogroup', { name: '主题模式' });
  await expect(themeGroup.getByRole('radio', { name: /^跟随系统/ })).toBeChecked();
  await page
    .getByRole('radiogroup', { name: '主题模式' })
    .getByText('深色主题', { exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const accentGroup = page.getByRole('radiogroup', { name: '强调色' });
  await accentGroup.getByText('蓝色', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('分类页顶部搜索跨目录：命中"删除"跳操作偏好页', async ({ page }) => {
  await resetPreferences(page);
  const search = page.getByRole('searchbox', { name: '搜索设置项' });
  await search.fill('删除');
  const deleteResult = page.getByRole('link', { name: /删除前二次确认/ });
  await expect(deleteResult).toHaveCount(1);
  await deleteResult.click();
  await expect(page).toHaveURL(/\/settings\/actions/);
  await expect(page.getByRole('heading', { level: 1, name: '操作偏好' })).toBeVisible();
  // 操作偏好页也带搜索与恢复全部默认。
  await expect(page.getByRole('searchbox', { name: '搜索设置项' })).toBeVisible();
  await expect(page.getByRole('button', { name: '恢复全部默认' })).toBeVisible();
});

test('恢复全部默认（任意分类页 header）：确认弹窗重置回默认', async ({ page }) => {
  await resetPreferences(page);
  await page
    .getByRole('radiogroup', { name: '主题模式' })
    .getByText('深色主题', { exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '恢复全部默认' }).click();
  await page.getByRole('button', { name: '恢复', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('语言与地区独立页：切换 English 即时生效并持久化', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/settings/locale');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page
    .getByRole('radiogroup', { name: '界面语言' })
    .getByText('English', { exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('深链直达：/settings/shortcuts 打开快捷键分类页', async ({ page }) => {
  await page.goto('/settings/shortcuts');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('switch', { name: '启用快捷键' })).toBeVisible();
  await expect(page.getByRole('link', { name: '快捷键', exact: true })).toHaveAttribute(
    'class',
    /bg-brand-soft/,
  );
});

test('左导航跳转：外观(根) 与其他分类互跳且各自 active', async ({ page }) => {
  await resetPreferences(page);
  // 根页 = 外观 active。
  await expect(page.getByRole('link', { name: '外观', exact: true })).toHaveAttribute(
    'class',
    /bg-brand-soft/,
  );
  // 跳导航分类。
  await page.getByRole('link', { name: '导航', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/navigation/);
  await expect(page.getByRole('link', { name: '导航', exact: true })).toHaveAttribute(
    'class',
    /bg-brand-soft/,
  );
  // 回外观（根）。
  await page.getByRole('link', { name: '外观', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: '外观' })).toBeVisible();
});
