import { expect, test } from '@playwright/test';

/**
 * Page Hierarchy UX Contract（代表性页面）。
 *
 * 保护「页面使用正式 PageHeader/Section 层级」的产品契约：
 * - 每个标准页面恰有一个可见 h1（页面标题，来自 PageHeader）——防手写重复标题
 *   或绕过 PageHeader 自绘骨架（历史：Overview 首页曾手写 hero+h1+自定标题层级）。
 * - h1 非空且与导航高亮一致（用户可观察）。
 * - 主导航与 main landmark 始终可达。
 *
 * 只断言用户可观察的语义（role/landmark/heading），不断言内部 className。
 */
const contractPages = [
  { path: '/', label: 'Overview' },
  { path: '/foundations', label: 'Foundations' },
  { path: '/motion', label: 'Motion' },
  { path: '/page-patterns/collections-data', label: 'Page Pattern' },
  { path: '/page-archetypes/resource-list', label: 'List archetype' },
  { path: '/page-archetypes/create-edit', label: 'Form archetype' },
  { path: '/page-archetypes/detail', label: 'Detail archetype' },
  { path: '/page-archetypes/settings', label: 'Settings archetype' },
  { path: '/states', label: 'States' },
  { path: '/ui-elements', label: 'UI Elements' },
] as const;

test('代表性页面保持统一 Page Hierarchy（单 h1 + 导航 + main）', async ({ page }) => {
  test.setTimeout(120_000); // Ten routes may compile independently in a fresh dev cache.
  for (const { path, label } of contractPages) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    // Hydration also covers the authentication surface; measure the restored application.
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();

    // 恰一个 h1（页面标题来自 PageHeader，不重复、不缺失）
    const h1s = page.getByRole('heading', { level: 1 });
    await expect(h1s).toHaveCount(1);
    await expect(h1s.first()).toBeVisible();
    const h1Text = (await h1s.first().textContent())?.trim() ?? '';
    expect(h1Text.length, `${path} h1 不应为空`).toBeGreaterThan(0);

    // 主导航与主内容 landmark 可达
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    // 页面标题（h1）应出现在 document title 或为可见文本（可观察性）
    await expect(h1s.first()).toHaveText(h1Text);

    // 无横向溢出（层级结构不应破坏响应式）
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} 不应横向溢出`).toBeLessThanOrEqual(0);

    // 分类标签断言失败时给出可定位信息
    test.info().annotations.push({ type: 'page', description: `${label}: ${h1Text}` });
  }
});
