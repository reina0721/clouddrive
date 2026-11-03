import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetAll(page: Page) {
  await page.goto('/settings/navigation');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.sessionStorage.removeItem('clouddrive.page-tabs');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('顶部页面标签默认关：不显示标签条', async ({ page }) => {
  await resetAll(page);
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '参考资源', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('navigation', { name: '页面标签' })).not.toBeVisible();
});

test('开启 顶部页面标签：访问页面显示标签、可切换与关闭', async ({ page }) => {
  await resetAll(page);
  // 设置 → 导航 → 顶部页面标签 = 开。
  await page.goto('/settings/navigation');
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  const enabled = page.getByRole('switch', { name: '顶部页面标签' });
  await enabled.focus();
  await page.keyboard.press('Space');
  await expect(enabled).toBeChecked();
  await page.waitForTimeout(300);

  // 访问参考资源列表 → 标签条出现含当前页。
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '参考资源', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const strip = page.getByRole('navigation', { name: '页面标签' });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole('button', { name: '参考资源', exact: true })).toBeVisible();

  // SPA 访问设置 → 设置标签也打开。
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '个人偏好', exact: true }).click();
  await page.waitForURL(/\/settings/);
  const strip2 = page.getByRole('navigation', { name: '页面标签' });
  await expect(strip2.getByRole('button', { name: '外观', exact: true })).toBeVisible();
  await expect(strip2.getByRole('button', { name: '参考资源', exact: true })).toBeVisible();

  // 关闭参考资源标签 → 消失。
  await strip2.getByRole('button', { name: '关闭 参考资源' }).click();
  await expect(
    page
      .getByRole('navigation', { name: '页面标签' })
      .getByRole('button', { name: '参考资源', exact: true }),
  ).not.toBeVisible();
});

test('关闭当前激活标签按策略导航到最近其他标签（默认 recent）', async ({ page }) => {
  await resetAll(page);
  // 开启标签（导航分类页）。
  await page.goto('/settings/navigation');
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  const enabled = page.getByRole('switch', { name: '顶部页面标签' });
  await enabled.focus();
  await page.keyboard.press('Space');
  await expect(enabled).toBeChecked();
  await page.waitForTimeout(300);

  // 访问设置根（导航叶子入口 → 记 tab）与参考资源并激活后者。
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '个人偏好', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(400);
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '参考资源', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(600);
  // 当前激活 = 参考资源；关闭它 → 导航到另一标签 设置（recent）。
  const strip = page.getByRole('navigation', { name: '页面标签' });
  await expect(strip.getByRole('button', { name: '参考资源', exact: true })).toBeVisible();
  await strip.getByRole('button', { name: '关闭 参考资源' }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(
    page
      .getByRole('navigation', { name: '页面标签' })
      .getByRole('button', { name: '参考资源', exact: true }),
  ).not.toBeVisible();
});

test('关闭后跳转策略选择器存在并持久化（右邻优先）', async ({ page }) => {
  await resetAll(page);
  await page.goto('/settings/navigation');
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  // 选择 右邻优先。
  const select = page.getByRole('button', { name: /关闭当前标签后跳转/ });
  await select.click();
  await page.getByRole('option', { name: '右邻优先' }).click();
  await page.waitForTimeout(300);
  // 持久化：重载后仍为 右邻优先。
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: /右邻优先/ })).toBeVisible();
});

test('恢复上次打开的标签：重载后标签保持（默认关时清除）', async ({ page }) => {
  await resetAll(page);
  // 开启 顶部页面标签 + 恢复上次打开的标签。
  await page.goto('/settings/navigation');
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  for (const label of ['顶部页面标签', '恢复上次打开的标签']) {
    const sw = page.getByRole('switch', { name: label });
    await sw.focus();
    await page.keyboard.press('Space');
    await expect(sw).toBeChecked();
  }
  await page.waitForTimeout(300);
  // 访问两个页面（均为导航入口叶子：参考资源根 + 设置）。
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '参考资源', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: '参考资源', exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: '页面标签' })
      .getByRole('button', { name: '参考资源', exact: true }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '个人偏好', exact: true }).click();
  await page.waitForURL(/\/settings/);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(600);
  // 重载 → 两个标签都恢复。
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const strip = page.getByRole('navigation', { name: '页面标签' });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole('button', { name: '参考资源', exact: true })).toBeVisible();
  await expect(strip.getByRole('button', { name: '外观', exact: true })).toBeVisible();
});
