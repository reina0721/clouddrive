import { saveEvidenceScreenshot } from './evidence-screenshot';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Product IA retains old links, search targets, page tabs and history', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: '主导航' });
  await expect(nav.getByText('开发中心', { exact: true })).toBeVisible();
  await expect(nav.getByText('Universal Foundation', { exact: true })).toHaveCount(0);
  const development = nav.getByRole('list', { name: '开发中心', exact: true });
  await expect(development.getByRole('link', { name: 'Icon 大全', exact: true })).toHaveAttribute(
    'href',
    '/system-tools/icons',
  );
  await expect(development.getByRole('link', { name: '参考资源', exact: true })).toHaveAttribute(
    'href',
    '/reference-resources',
  );
  await nav.getByRole('link', { name: '个人偏好', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  const tabsToggle = page.getByRole('switch', { name: '顶部页面标签', exact: true });
  await page.goto('/settings/navigation');
  await tabsToggle.focus();
  await page.keyboard.press('Space');
  await expect(tabsToggle).toBeChecked();
  await page.getByRole('button', { name: '按 Ctrl K 搜索' }).click();
  await page.getByRole('searchbox', { name: '搜索命令', exact: true }).fill('Icon');
  await page.getByRole('option', { name: /Icon 大全/ }).click();
  await expect(page).toHaveURL(/\/system-tools\/icons$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/navigation$/);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '最近访问', exact: true })).toBeVisible();
  await expect(
    page.locator('#workbench-recents').getByRole('link', { name: 'Icon 大全', exact: true }),
  ).toHaveAttribute('href', '/system-tools/icons');
});

test('Home contains only recents while drafts and notification actions remain available in their owners', async ({
  page,
}) => {
  await page.goto('/settings/actions');
  const autosave = page.getByRole('switch', { name: '本地草稿自动保存' });
  await autosave.focus();
  await page.keyboard.press('Space');
  await expect(autosave).toBeChecked();
  await page.goto('/reference-resources/create');
  await page.getByLabel('名称', { exact: true }).fill('M1 工作台恢复验证');
  await page.goto('/');
  await expect(page.locator('#workbench-drafts')).toHaveCount(0);
  await expect(page.locator('#workbench-favorites')).toHaveCount(0);
  await expect(page.locator('#workbench-activity')).toHaveCount(0);
  await expect(page.locator('#workbench-shortcuts')).toHaveCount(0);
  await page.goto('/reference-resources/create');
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('M1 工作台恢复验证');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page).toHaveURL(/\/reference-resources(?:\?.*)?$/);
  await page.goto('/');
  await page.getByRole('button', { name: /^通知(?:，|$)/ }).click();
  await expect(page.getByRole('dialog', { name: '通知中心' })).toContainText('参考资源已保存');
  await page
    .getByRole('dialog', { name: '通知中心' })
    .getByRole('button', { name: '全部标为已读' })
    .click();
  await expect(
    page.getByRole('dialog', { name: '通知中心' }).getByRole('button', { name: '全部标为已读' }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^通知(?:，|$)/ })).toBeFocused();
});

test('English dark workbench is usable at mobile, tablet, desktop and wide widths', async ({
  page,
}, testInfo) => {
  await page.goto('/settings/locale');
  await page.getByRole('radio', { name: 'English', exact: true }).press('Space');
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Dark theme', exact: true }).press('Space');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Workbench', exact: true })).toBeVisible();
  for (const width of [390, 768, 1440, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await expect(page.locator('main')).not.toContainText('overview.');
    await saveEvidenceScreenshot(page, {
      path: testInfo.outputPath('workbench-dark-en-' + width + '.png'),
      fullPage: true,
    });
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Primary navigation', exact: true });
  await expect(drawer.getByText('Developer center', { exact: true })).toBeVisible();
  await drawer.getByRole('link', { name: 'Personal preferences', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/settings$/);
});
