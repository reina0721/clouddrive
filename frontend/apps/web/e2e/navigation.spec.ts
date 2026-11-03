import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

async function hoverCompactTrigger(trigger: Locator) {
  // Scroll the navigation viewport first, as a user would. Playwright's automatic
  // ancestor scrolling can otherwise move the document for a clipped sticky item.
  await trigger.evaluate((element) => {
    const viewport = element.closest('nav');
    if (!viewport) throw new Error('Missing navigation viewport');
    const item = element.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    if (item.bottom > bounds.bottom || item.top < bounds.top) {
      viewport.scrollTo({
        top: viewport.scrollTop + item.top - bounds.top - (bounds.height - item.height) / 2,
        behavior: 'instant',
      });
    }
  });
  await trigger.hover();
}

test('展开侧栏用同一递归能力呈现 Page Archetypes 与 UI Elements（Active Path Anchored Accordion）', async ({
  page,
}) => {
  await page.goto('/page-archetypes/create-edit');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  const referenceToggle = navigation.getByRole('button', {
    name: '展开或收起Page Archetypes',
  });
  const uiElementsToggle = navigation.getByRole('button', {
    name: '展开或收起UI Elements',
  });

  // Page Archetypes 是当前 active 链（深层页 /page-archetypes/create-edit）：锚定展开
  await expect(referenceToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation.getByRole('link', { name: '创建与编辑' })).toBeVisible();
  await expect(navigation).toHaveScreenshot('surface-shell-parent-navigation.png');
  const accessibilityScan = await new AxeBuilder({ page }).include('nav').analyze();
  expect(accessibilityScan.violations).toEqual([]);
  const currentUrl = page.url();

  // active ancestor 不允许被普通点击收起（不隐藏当前 Route）
  await referenceToggle.click();
  await expect(referenceToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation.getByRole('link', { name: '创建与编辑' })).toBeVisible();
  await expect(page).toHaveURL(currentUrl);

  // 展开另一顶层（同 root scope 的非 active）：Page Archetypes（active）保持，
  // UI Elements 成为 exploration 展开
  await expect(uiElementsToggle).toHaveAttribute('aria-expanded', 'false');
  await uiElementsToggle.click();
  await expect(uiElementsToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(referenceToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation.getByRole('link', { name: '浮层与弹出界面' })).toBeVisible();
  await expect(page).toHaveURL(currentUrl);

  // 再次点击非 active exploration：收起
  await uiElementsToggle.click();
  await expect(uiElementsToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(referenceToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page).toHaveURL(currentUrl);
});

test('收缩侧栏的 Hover Flyout 保持稳定并支持键盘进入', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '收起侧栏' }).click();
  const expandSidebar = page.getByRole('button', { name: '展开侧栏' });
  await expect(expandSidebar).toBeFocused();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  const trigger = navigation.getByRole('button', { name: 'UI Elements' });
  await trigger.hover();

  const flyout = page.getByRole('dialog', { name: 'UI Elements' });
  await expect(flyout).toBeVisible();
  await page.waitForTimeout(500);
  await expect(flyout).toHaveCount(1);
  await expect(flyout).toBeVisible();
  await expect(expandSidebar).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect.soft(page).toHaveScreenshot('surface-shell-compact-flyout.png');

  await flyout.hover();
  await page.waitForTimeout(300);
  await expect(flyout).toBeVisible();

  await flyout.getByRole('link', { name: '浮层与弹出界面' }).click();
  await expect(page).toHaveURL(/\/ui-elements\/overlays$/);
  await expect(flyout).toBeHidden();

  await page.mouse.move(600, 240);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(flyout).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(flyout).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('收缩侧栏切换兄弟菜单时同一时刻只有一个 Flyout 且旧菜单不残留', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '收起侧栏' }).click();
  const navigation = page.getByRole('navigation', { name: '主导航' });

  const uiElementsTrigger = navigation.getByRole('button', { name: 'UI Elements' });
  const pagePatternsTrigger = navigation.getByRole('button', { name: 'Page Patterns' });
  const pageArchetypesTrigger = navigation.getByRole('button', { name: 'Page Archetypes' });

  const dialogs = page.getByRole('dialog');
  await expect(dialogs).toHaveCount(0);

  // 依次 Hover 三个兄弟父级：每一步都只能有一个可见 Dialog
  await hoverCompactTrigger(uiElementsTrigger);
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs.first()).toHaveAttribute('aria-label', 'UI Elements');

  await hoverCompactTrigger(pagePatternsTrigger);
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Patterns');
  await page.waitForTimeout(400);
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Patterns');

  await hoverCompactTrigger(pageArchetypesTrigger);
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Archetypes');
  await page.waitForTimeout(400);
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Archetypes');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect.soft(page).toHaveScreenshot('surface-shell-compact-sibling-swap.png');

  // 快速来回切换：旧 Flyout 的延迟关闭计时器不能误关新菜单
  await hoverCompactTrigger(uiElementsTrigger);
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs.first()).toHaveAttribute('aria-label', 'UI Elements');
  await hoverCompactTrigger(pageArchetypesTrigger);
  await page.waitForTimeout(400);
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Archetypes');

  // 键盘仍可打开当前父级，Escape 关闭并恢复焦点
  await page.mouse.move(600, 240);
  await pageArchetypesTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(dialogs).toHaveCount(1);
  await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Archetypes');
  await page.keyboard.press('Escape');
  await expect(dialogs).toHaveCount(0);
  await expect(pageArchetypesTrigger).toBeFocused();
});

test('移动侧栏使用同一树并在选择叶子后关闭', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '打开导航' }).click();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  const uiElementsToggle = navigation.getByRole('button', {
    name: '展开或收起UI Elements',
  });
  await uiElementsToggle.click();
  await navigation.getByRole('link', { name: '反馈', exact: true }).click();

  await expect(page).toHaveURL(/\/ui-elements\/feedback$/);
  await expect(navigation).toBeHidden();
});

test('Shell NavigationViewport 隐藏原生 scrollbar 且保留滚动能力', async ({ page }) => {
  // 低高度桌面视口：导航内容必然超出可用高度，触发纵向滚动
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '主导航' });

  // 1. 滚动能力保留：overflow-y 是 auto，而不是 hidden
  await expect(navigation).toHaveCSS('overflow-y', 'auto');

  // 2. scrollbar 语义隐藏（Firefox scrollbar-width / Chromium 同样识别该属性）
  await expect(navigation).toHaveCSS('scrollbar-width', 'none');

  // 3. Chromium/WebKit 伪元素轨道宽度为 0（不可见）
  const webkitScrollbarWidth = await navigation.evaluate((element) => {
    const style = getComputedStyle(element, '::-webkit-scrollbar');
    return style.width;
  });
  expect(webkitScrollbarWidth).toBe('0px');

  // 4. 内容超出视口时确实可滚动（scrollHeight > clientHeight，且程序化滚动生效）
  const scrollMetrics = await navigation.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  await navigation.evaluate((element) => element.scrollTo({ top: 200, behavior: 'instant' }));
  const scrolledTop = await navigation.evaluate((element) => element.scrollTop);
  expect(scrolledTop).toBeGreaterThan(0);

  // 5. 顶部 Brand 稳定区不参与导航滚动：滚到顶部时 Brand 区仍在原位
  await navigation.evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }));
  const brandBefore = await page
    .locator('aside > div:first-child')
    .first()
    .evaluate((element) => element.getBoundingClientRect().top);
  await navigation.evaluate((element) => element.scrollTo({ top: 200, behavior: 'instant' }));
  const brandAfter = await page
    .locator('aside > div:first-child')
    .first()
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(brandAfter - brandBefore)).toBeLessThanOrEqual(1);

  // 6. 产品 Header 独立于导航滚动；工程 Preview 已从正式 Shell 移除。
  const headerBefore = await page
    .getByRole('banner')
    .evaluate((element) => element.getBoundingClientRect().top);
  await navigation.evaluate((element) => element.scrollTo({ top: 300, behavior: 'instant' }));
  const headerAfter = await page
    .getByRole('banner')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(headerAfter - headerBefore)).toBeLessThanOrEqual(1);

  // 7. 展开一个顶层菜单后可滚动访问最后一个菜单项
  //    （root scope Accordion：展开 Page Archetypes 后即为当前唯一 exploration/active 顶层）
  await navigation.getByRole('button', { name: '展开或收起Page Archetypes' }).click();
  const lastItem = navigation.getByRole('link', { name: '操作任务' });
  await lastItem.scrollIntoViewIfNeeded();
  await expect(lastItem).toBeInViewport();

  // 8. 主内容区 scrollbar 不受影响（保持浏览器默认，未被设为 none）
  const mainScrollbarWidth = await page
    .locator('main')
    .evaluate((element) => getComputedStyle(element).scrollbarWidth);
  expect(mainScrollbarWidth).not.toBe('none');

  // 9. Sidebar 宽度不因 scrollbar 隐藏变化（grid 列宽仍为 16.5rem 语义）
  const sidebarWidth = await page
    .locator('aside')
    .first()
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(sidebarWidth).toBe(264); // 16.5rem

  // 10. 移动端导航 drawer 同样隐藏 scrollbar 且可滚动
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '打开导航' }).click();
  const mobileNavigation = page.getByRole('navigation', { name: '主导航' });
  await expect(mobileNavigation).toHaveCSS('overflow-y', 'auto');
  await expect(mobileNavigation).toHaveCSS('scrollbar-width', 'none');
});

test('UI Elements 根路径进入默认子级且旧 Showcase 不再匹配', async ({ page }) => {
  await page.goto('/ui-elements');
  await expect(page).toHaveURL(/\/ui-elements\/actions-selection$/);

  const response = await page.goto('/showcase');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: '页面不存在', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入工作台', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
});
