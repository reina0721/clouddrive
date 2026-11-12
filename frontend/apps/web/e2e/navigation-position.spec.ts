import { expect, test } from '@playwright/test';

test.use({ actionTimeout: 15_000 });

test('深层导航在自己的视口内显示当前项，并保留用户滚动与焦点', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/page-archetypes/create-edit');
  const navigation = page.getByRole('navigation', { name: '主导航', exact: true });
  const current = navigation.getByRole('link', { name: '创建与编辑', exact: true });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(current).toBeInViewport();
  await expect(current).not.toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await navigation.screenshot({ path: info.outputPath('active-navigation.png') });

  await navigation.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(current).not.toBeInViewport();
  // 手动探索菜单不能被仍在运行的自动定位反复拉回。
  const explore = navigation.getByRole('button', { name: '展开或收起UI Elements', exact: true });
  await explore.click();
  await expect(explore).toHaveAttribute('aria-expanded', 'true');
  await expect(current).not.toBeInViewport();

  await page.getByRole('button', { name: '收起侧栏', exact: true }).click();
  const branch = navigation.getByRole('button', { name: 'Page Archetypes', exact: true });
  await expect(branch).toHaveAttribute('data-active', 'true');
  await expect(branch).toBeInViewport();
  await expect(page.getByRole('button', { name: '展开侧栏', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('移动导航打开时能看到深层当前链接', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/page-archetypes/create-edit');
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  const navigation = page.getByRole('navigation', { name: '主导航', exact: true });
  const current = navigation.getByRole('link', { name: '创建与编辑', exact: true });
  await expect(current).toBeInViewport();
  await expect(current).not.toBeFocused();
  await navigation.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.getByRole('button', { name: '关闭导航', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '主导航', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await expect(current).toBeInViewport();
});
