import { expect, test, type Page } from '@playwright/test';

// 重复点击当前 Route 的导航 no-op 验证。
// 生命周期由 Host 统一提供：shouldProceedWithNavigation 短路同 resolved target，
// RouteTransition 对 pathname/search/hash 任一变化 complete；本 spec 验证用户可感知结果：
// 同路由点击不重导航、不启动 Top Progress；A→B 正常开始并收敛；快速连点不遗留 pending。

const progressBar = (page: Page) => page.locator('.top-progress');

async function expectHydrated(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function ensureUiElementsExpanded(page: Page) {
  const navigation = page.getByRole('navigation', { name: '主导航' });
  const toggle = navigation.getByRole('button', { name: '展开或收起UI Elements' });
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function navigateViaSidebar(page: Page, leafName: string) {
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await ensureUiElementsExpanded(page);
  await navigation.getByRole('link', { name: leafName, exact: true }).click();
}

async function expectPageHeading(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('当前 Route 再次点击自身：URL 不变、页面不重新导航、Progress 不出现', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ui-elements/feedback');
  await expectHydrated(page);
  await expectPageHeading(page);

  // 记录点击前 URL 与转场观察器：真实导航会设置 route-enter / 改变 URL / 出现 progress。
  await page.evaluate(() => {
    (window as unknown as { __noopWatch?: { routeEnterSeen: boolean } }).__noopWatch = {
      routeEnterSeen: false,
    };
    const record = (window as unknown as { __noopWatch?: { routeEnterSeen: boolean } }).__noopWatch;
    if (!record) return;
    const observer = new MutationObserver(() => {
      const content = document.querySelector<HTMLElement>('.surface-route-content');
      if (content?.dataset.routeEnter === 'true') record.routeEnterSeen = true;
    });
    observer.observe(document.documentElement, { subtree: true, attributes: true });
  });

  const urlBefore = page.url();
  await navigateViaSidebar(page, '反馈');
  await page.waitForTimeout(400);

  // 1. URL 不变
  expect(page.url()).toBe(urlBefore);
  // 2. 页面未重新导航（无 route content enter 转场标记）
  const watch = await page.evaluate(
    () => (window as unknown as { __noopWatch?: { routeEnterSeen: boolean } }).__noopWatch,
  );
  expect(watch?.routeEnterSeen).toBe(false);
  // 3. Progress 从未出现
  await expect(progressBar(page)).toHaveCount(0);
  // 4. 页面内容仍在
  await expectPageHeading(page);
});

test('同一 Leaf 重复点击不触发 RSC 重新导航请求', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // warm 目标路由使其完全渲染
  await page.goto('/ui-elements/status-async');
  await expectHydrated(page);
  await expectPageHeading(page);
  await page.goto('/');
  await expectHydrated(page);

  // 导航到 status-async（真实导航，progress 出现并收敛）
  await navigateViaSidebar(page, '状态与异步');
  await expect(page).toHaveURL(/\/ui-elements\/status-async$/);
  await expect(progressBar(page)).toHaveCount(0);
  await expectPageHeading(page);

  // 第二次点击同一 Leaf：不应产生新的 RSC 路由请求（同路由 no-op）
  let rscRequests = 0;
  const countRsc = (route: { url: () => string }) => {
    if (route.url().includes('_rsc')) rscRequests += 1;
  };
  page.on('request', countRsc);
  await navigateViaSidebar(page, '状态与异步');
  await page.waitForTimeout(400);
  page.off('request', countRsc);

  expect(page.url()).toMatch(/\/ui-elements\/status-async$/);
  expect(rscRequests).toBe(0);
  await expect(progressBar(page)).toHaveCount(0);
});

test('A → B 真实导航：Progress 正常开始并最终收敛为 0', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expectHydrated(page);

  await navigateViaSidebar(page, '状态与异步');
  await expect(page).toHaveURL(/\/ui-elements\/status-async$/);
  await expectPageHeading(page);
  // 真实导航后进度条收敛为 0（不遗留 pending）
  await expect(progressBar(page)).toHaveCount(0);
});

test('快速连点不同路由（A→B→C）：最终 URL 正确且 Progress 收敛为 0', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expectHydrated(page);

  const navigation = page.getByRole('navigation', { name: '主导航' });
  await ensureUiElementsExpanded(page);

  // 连续点击三个不同叶子：新 begin 接管旧事务，commit 收敛，不得遗留 pending
  await navigation.getByRole('link', { name: '反馈', exact: true }).click();
  await navigation.getByRole('link', { name: '数据展示', exact: true }).click();
  await navigation.getByRole('link', { name: '浮层与弹出界面', exact: true }).click();

  await expect(page).toHaveURL(/\/ui-elements\/overlays$/);
  await expectPageHeading(page);
  // 快速连点后进度条必须最终收敛（不能永久 pending）
  await expect(progressBar(page)).toHaveCount(0);
  await page.waitForTimeout(300);
  await expect(progressBar(page)).toHaveCount(0);
});

test('移动端导航抽屉：同路由 Leaf 关闭抽屉但不改变 URL、不出现 Progress', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ui-elements/feedback');
  await expectHydrated(page);
  await expectPageHeading(page);

  await page.getByRole('button', { name: '打开导航' }).click();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await expect(navigation).toBeVisible();
  await ensureUiElementsExpanded(page);

  const urlBefore = page.url();
  await navigation.getByRole('link', { name: '反馈', exact: true }).click();
  await expect(navigation).toBeHidden();
  expect(page.url()).toBe(urlBefore);
  await expect(progressBar(page)).toHaveCount(0);
});

test('Compact Flyout：同路由 Leaf 关闭 Flyout 且不触发导航', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ui-elements/feedback');
  await expectHydrated(page);
  await expectPageHeading(page);

  // 收缩侧栏进入 Compact 模式
  await page.getByRole('button', { name: '收起侧栏' }).click();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  const trigger = navigation.getByRole('button', { name: 'UI Elements' });
  await trigger.hover();
  const flyout = page.getByRole('dialog', { name: 'UI Elements' });
  await expect(flyout).toBeVisible();

  const urlBefore = page.url();
  await flyout.getByRole('link', { name: '反馈', exact: true }).click();
  await expect(flyout).toBeHidden();
  expect(page.url()).toBe(urlBefore);
  await expect(progressBar(page)).toHaveCount(0);
});
