import { expect, test, type Page } from '@playwright/test';

/** VP-06：分析页与个人工作区的产品级验收（图表可访问性、状态闭环、待办持久化）。 */

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test.describe('analytics', () => {
  test('KPI、图表可访问摘要与键盘导航可用，窄屏深色无横向溢出', async ({ page }) => {
    await ready(page, '/analytics');
    await expect(page.getByRole('heading', { level: 1, name: '分析' })).toBeVisible();
    // 异步演示数据：等真实内容（KPI）出现后再断言图表。
    for (const metric of ['用户量', '访问量', '下载量', '使用量']) {
      await expect(page.getByText(metric, { exact: true }).first()).toBeVisible();
    }

    const charts = page.locator('svg[role="img"]');
    expect(await charts.count()).toBeGreaterThanOrEqual(4);
    for (let index = 0; index < (await charts.count()); index += 1) {
      const label = await charts.nth(index).getAttribute('aria-label');
      expect(label && label.trim().length, `chart ${index} aria-label`).toBeTruthy();
    }

    // roving tabindex：图表只占一个 Tab 停靠点，方向键在数据点之间移动。
    const firstPoint = page.locator('[data-chart-point][tabindex="0"]').first();
    await firstPoint.focus();
    await page.keyboard.press('ArrowRight');
    expect(
      await page.evaluate(() => document.activeElement?.hasAttribute('data-chart-point') ?? false),
    ).toBe(true);

    // 深色 + 窄屏：图表仍渲染且无横向溢出。
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(charts.first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

  test('空数据与刷新失败可从工具栏触发并恢复', async ({ page }) => {
    await ready(page, '/analytics');
    await expect(page.getByRole('heading', { name: '流量趋势' })).toBeVisible();

    await page.getByRole('button', { name: '演示空数据', exact: true }).click();
    await expect(page.getByText('暂无分析数据', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '关闭演示空数据', exact: true }).click();
    await expect(page.getByRole('heading', { name: '流量趋势' })).toBeVisible();

    await page.getByRole('button', { name: '模拟刷新失败', exact: true }).click();
    await page.getByRole('button', { name: '刷新数据', exact: true }).click();
    await expect(page.getByText('分析数据加载失败', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(page.getByRole('heading', { name: '流量趋势' })).toBeVisible();
    await page.getByRole('button', { name: '模拟刷新失败', exact: true }).click();
  });
});

test.describe('workspace', () => {
  test('问候、快捷入口与待办勾选持久化', async ({ page }) => {
    await ready(page, '/workspace');
    await expect(page.getByRole('heading', { level: 1, name: '个人工作区' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '快捷导航' })).toBeVisible();

    const main = page.getByRole('main');
    for (const name of ['用户管理', '角色管理', '审计日志', '设置中心', '分析', '个人工作区']) {
      await expect(main.getByRole('link', { name: new RegExp(`^${name}`) }).first()).toBeVisible();
    }

    const todo = page.getByRole('checkbox').first();
    await expect(todo).toBeVisible();
    const label = await todo.getAttribute('aria-label');
    await todo.focus();
    await page.keyboard.press('Space');
    await expect(todo).toBeChecked();

    // 刷新后仍保持（Plugin 私有 store：clouddrive.plugin.workspace）。
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    const restored = label
      ? page.getByRole('checkbox', { name: label })
      : page.getByRole('checkbox').first();
    await expect(restored).toBeChecked();
  });
});
