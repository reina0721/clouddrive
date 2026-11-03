import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const referenceResources = '/reference-resources';

async function expectHydrated(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('Reference Resources 列表经 Registry 派生 Navigation 进入侧栏并可直接验收', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(referenceResources);
  await expectHydrated(page);
  await expect(page).toHaveURL(/\/reference-resources$/);
  await expect(page.getByRole('heading', { level: 1, name: '参考资源' })).toBeVisible();

  // 列表展示三条确定性资源
  await expect(page.getByText('Alpha 示例资源')).toBeVisible();
  await expect(page.getByText('Beta 引导指南')).toBeVisible();
  await expect(page.getByText('Gamma 模板')).toBeVisible();

  // Sidebar 中的 Reference Resources 分组来自 Registry resolved model
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await expect(navigation.getByRole('link', { name: '参考资源' })).toBeVisible();
});

test('Route Target Link 导航：列表 → 详情 → 编辑，编辑 canonical parent 为详情', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(referenceResources);
  await expectHydrated(page);

  await page.getByRole('link', { name: '查看', exact: true }).first().click();
  await expect(page).toHaveURL(/\/reference-resources\/detail\?id=resource-alpha$/);
  await expect(page.getByRole('heading', { level: 1, name: '参考资源详情' })).toBeVisible();
  await expect(page.getByText('Alpha 示例资源')).toBeVisible();

  await page.getByRole('link', { name: '编辑此资源' }).click();
  await expect(page).toHaveURL(/\/reference-resources\/edit\?id=resource-alpha$/);
  await expect(page.getByRole('heading', { level: 1, name: '编辑参考资源' })).toBeVisible();
});

test('创建页提交通过 imperative navigation 返回列表', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/reference-resources/create');
  await expectHydrated(page);
  await expect(page.getByRole('heading', { level: 1, name: '创建参考资源' })).toBeVisible();

  await page.getByLabel('名称').fill('本地新增资源');
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page).toHaveURL(/\/reference-resources$/);
  await expect(page.getByRole('heading', { level: 1, name: '参考资源' })).toBeVisible();
});

test('Reference Resources 页面 Axe WCAG AA 无违规', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of [
    referenceResources,
    '/reference-resources/detail?id=resource-alpha',
    '/reference-resources/edit?id=resource-alpha',
    '/reference-resources/create',
  ]) {
    await page.goto(route);
    await expectHydrated(page);
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations, `${route} axe violations`).toEqual([]);
  }
});

test('Reference Resources 视觉基线（桌面全页）', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(referenceResources);
  await expectHydrated(page);
  await expect.soft(page).toHaveScreenshot('reference-resources-desktop.png', { fullPage: true });
});

test('窄屏与英文扩张下 Reference Resources 无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(referenceResources);
  await expectHydrated(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
