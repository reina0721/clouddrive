# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.ts >> 九个 UI Element Family 页面均有独立视觉基线
- Location: apps\web\e2e\visual.spec.ts:40:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/ui-elements/status-async
Call log:
  - navigating to "http://127.0.0.1:4173/ui-elements/status-async", waiting until "load"

```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   |
  3   | async function expectHydrated(page: Page) {
  4   |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  5   | }
  6   |
  7   | async function expectReferenceReady(page: Page) {
  8   |   await expectHydrated(page);
  9   |   await expect(page.getByRole('heading', { level: 1 })).toHaveText('高密度数据工作台');
  10  |   // 默认每页 20 → 首页 20 数据行 + 1 表头。
  11  |   await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  12  | }
  13  |
  14  | test('桌面与超宽屏 Reference 布局保持稳定', async ({ page }) => {
  15  |   await page.setViewportSize({ width: 1440, height: 900 });
  16  |   await page.goto('/page-archetypes/resource-list');
  17  |   await expectReferenceReady(page);
  18  |   await expect.soft(page).toHaveScreenshot('reference-desktop.png', { fullPage: true });
  19  |
  20  |   await page.setViewportSize({ width: 1920, height: 1080 });
  21  |   await page.reload();
  22  |   await expectReferenceReady(page);
  23  |   await expect.soft(page).toHaveScreenshot('reference-ultrawide.png', { fullPage: true });
  24  | });
  25  |
  26  | test('桌面 UI Elements Family 保持基础组件权威面稳定', async ({ page }) => {
  27  |   const consoleErrors: string[] = [];
  28  |   page.on('console', (message) => {
  29  |     if (message.type() === 'error') consoleErrors.push(message.text());
  30  |   });
  31  |   await page.setViewportSize({ width: 1440, height: 1000 });
  32  |   await page.goto('/ui-elements/actions-selection');
  33  |   await expectHydrated(page);
  34  |   await expect(page.getByRole('heading', { level: 1, name: '操作与选择' })).toBeVisible();
  35  |   await expect(page.getByText('公开 Element 46 / 46')).toBeVisible();
  36  |   await expect.soft(page).toHaveScreenshot('ui-elements-desktop.png', { fullPage: true });
  37  |   expect(consoleErrors).toEqual([]);
  38  | });
  39  |
  40  | test('九个 UI Element Family 页面均有独立视觉基线', async ({ page }) => {
  41  |   // Nine independent renders and snapshot comparisons retain their per-assertion limit.
  42  |   test.setTimeout(120_000);
  43  |   await page.setViewportSize({ width: 1440, height: 1000 });
  44  |
  45  |   const families = [
  46  |     'actions-selection',
  47  |     'feedback',
  48  |     'status-async',
  49  |     'identity-display',
  50  |     'navigation',
  51  |     'data',
  52  |     'surfaces',
  53  |     'forms',
  54  |     'overlays',
  55  |   ] as const;
  56  |
  57  |   for (const family of families) {
> 58  |     await page.goto(`/ui-elements/${family}`);
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/ui-elements/status-async
  59  |     await expectHydrated(page);
  60  |     await expect(page.getByText('公开 Element 46 / 46')).toBeVisible();
  61  |     const sectionId = family === 'actions-selection' ? 'actions' : family;
  62  |     await expect
  63  |       .soft(page.locator(`#${sectionId}`))
  64  |       .toHaveScreenshot(`ui-elements-family-${family}.png`);
  65  |   }
  66  | });
  67  |
  68  | test('移动窗口、Dark Mode 与英文扩张保持无溢出', async ({ page }) => {
  69  |   await page.setViewportSize({ width: 390, height: 844 });
  70  |   await page.goto('/ui-elements/forms');
  71  |   await expectHydrated(page);
  72  |   await page.getByRole('button', { name: '当前用户', exact: true }).click();
  73  |   await page.getByRole('menuitem', { name: /^主题 / }).click();
  74  |   await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  75  |   await page.getByRole('button', { name: '当前用户', exact: true }).click();
  76  |   await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  77  |   await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  78  |   await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  79  |   const overflow = await page.evaluate(
  80  |     () => document.documentElement.scrollWidth - window.innerWidth,
  81  |   );
  82  |   expect(overflow).toBeLessThanOrEqual(0);
  83  |   await expect.soft(page).toHaveScreenshot('ui-elements-mobile-dark-en.png', { fullPage: true });
  84  | });
  85  |
  86  | test('移动侧栏打开状态纳入视觉回归', async ({ page }) => {
  87  |   await page.setViewportSize({ width: 390, height: 844 });
  88  |   await page.goto('/page-archetypes/resource-list');
  89  |   await expectHydrated(page);
  90  |   await page.getByRole('button', { name: '打开导航' }).click();
  91  |   await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  92  |   await expect.soft(page).toHaveScreenshot('mobile-navigation-open.png');
  93  | });
  94  |
  95  | test('状态体系页面保持 Loading 与异常状态视觉基线', async ({ page }) => {
  96  |   await page.setViewportSize({ width: 1440, height: 900 });
  97  |   await page.goto('/states');
  98  |   await expectHydrated(page);
  99  |   await expect(page.getByRole('heading', { name: '加载未完成' })).toBeVisible();
  100 |   await expect(page.getByRole('region', { name: '正在同步界面能力' })).toHaveAttribute(
  101 |     'aria-busy',
  102 |     'true',
  103 |   );
  104 |   await expect.soft(page).toHaveScreenshot('states-desktop.png', { fullPage: true });
  105 | });
  106 |
  107 | test('Overview、Reference Form 与 Settings 真实页面进入视觉矩阵', async ({ page }) => {
  108 |   await page.setViewportSize({ width: 1440, height: 900 });
  109 |
  110 |   await page.goto('/');
  111 |   await expectHydrated(page);
  112 |   await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  113 |   await expect.soft(page).toHaveScreenshot('overview-desktop.png', { fullPage: true });
  114 |
  115 |   await page.goto('/page-archetypes/create-edit');
  116 |   await expectHydrated(page);
  117 |   await expect(page.getByRole('heading', { name: '复杂设置与审批表单' })).toBeVisible();
  118 |   await expect.soft(page).toHaveScreenshot('reference-form-desktop.png', { fullPage: true });
  119 |
  120 |   await page.goto('/settings');
  121 |   await expectHydrated(page);
  122 |   // 根 /settings 即默认外观分类页（无索引主页）。
  123 |   await expect(page.getByRole('heading', { level: 1, name: '外观' })).toBeVisible();
  124 |   await expect.soft(page).toHaveScreenshot('settings-desktop.png', { fullPage: true });
  125 | });
  126 |
  127 | test('Toast、Destructive Confirm 与 Compact Density 开启态进入视觉矩阵', async ({ page }) => {
  128 |   await page.setViewportSize({ width: 1440, height: 900 });
  129 |
  130 |   await page.goto('/ui-elements/feedback?overlay=toast&density=compact');
  131 |   await expectHydrated(page);
  132 |   await expect(page.getByText('项目反馈已入队')).toBeVisible();
  133 |   await expect.soft(page).toHaveScreenshot('ui-elements-toast-compact.png');
  134 |
  135 |   await page.goto('/ui-elements/overlays?overlay=confirm');
  136 |   await expectHydrated(page);
  137 |   await expect(page.getByRole('alertdialog')).toBeVisible();
  138 |   await expect.soft(page).toHaveScreenshot('ui-elements-destructive-confirm.png');
  139 | });
  140 |
  141 | test('Reference 多选与分页的真实联动状态进入视觉矩阵', async ({ page }) => {
  142 |   await page.setViewportSize({ width: 1440, height: 900 });
  143 |   await page.goto('/page-archetypes/resource-list');
  144 |   await expectReferenceReady(page);
  145 |   const rows = page.getByRole('grid').getByRole('row');
  146 |   await rows.nth(1).click();
  147 |   await expect(rows.nth(1)).toHaveAttribute('data-selected', 'true');
  148 |   await rows.nth(2).focus();
  149 |   await rows.nth(2).press('Enter');
  150 |   await expect(page.getByText('已选 2 条')).toBeVisible();
  151 |   await page.evaluate(() => {
  152 |     window.scrollTo({ top: 0, behavior: 'instant' });
  153 |     for (const container of document.querySelectorAll<HTMLElement>(
  154 |       '[data-table-scroll-container]',
  155 |     )) {
  156 |       container.scrollLeft = 0;
  157 |     }
  158 |     if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
```
