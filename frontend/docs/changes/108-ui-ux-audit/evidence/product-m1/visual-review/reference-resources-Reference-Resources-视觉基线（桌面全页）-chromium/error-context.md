# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reference-resources.spec.ts >> Reference Resources 视觉基线（桌面全页）
- Location: apps\web\e2e\reference-resources.spec.ts:75:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  13998 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: reference-resources-desktop.png

Call log:
  - Expect "soft toHaveScreenshot(reference-resources-desktop.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 21879 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 14799 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 250ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 13998 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
    - alert [ref=e11]
    - link "跳到主要内容 / Skip to content" [ref=e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=e13]:
        - complementary [ref=e14]:
            - generic [ref=e15]:
                - generic [ref=e16]: C
                - generic [ref=e18]:
                    - paragraph [ref=e19]: clouddrive
                    - paragraph [ref=e20]: 管理工作空间
            - navigation "主导航" [ref=e21]:
                - generic [ref=e22]:
                    - paragraph [ref=e23]: 工作空间
                    - list "工作空间" [ref=e24]:
                        - listitem [ref=e25]:
                            - link "工作台" [ref=e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=e34]:
                    - paragraph [ref=e35]: 个人
                    - list "个人" [ref=e36]:
                        - listitem [ref=e37]:
                            - link "个人偏好" [ref=e38] [cursor=pointer]:
                                - /url: /settings
                - generic [ref=e44]:
                    - paragraph [ref=e45]: 开发中心
                    - list "开发中心" [ref=e46]:
                        - listitem [ref=e47]:
                            - button "展开或收起UI Elements" [ref=e48]:
                                - generic [ref=e55]: UI Elements
                        - listitem [ref=e58]:
                            - button "展开或收起Page Patterns" [ref=e59]:
                                - generic [ref=e66]: Page Patterns
                        - listitem [ref=e69]:
                            - button "展开或收起Page Archetypes" [ref=e70]:
                                - generic [ref=e74]: Page Archetypes
                        - listitem [ref=e77]:
                            - link "参考资源" [ref=e78] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=e83]:
                            - link "Icon 大全" [ref=e84] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=e91]:
                            - link "基座能力" [ref=e92] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=e105]:
                            - link "Motion" [ref=e106] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=e115]:
                            - link "状态体系" [ref=e116] [cursor=pointer]:
                                - /url: /states
        - generic [ref=e123]:
            - banner [ref=e125]:
                - button "收起侧栏" [ref=e127] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=e129] [cursor=pointer]
                - generic [ref=e130]:
                    - generic [ref=e131]:
                        - button "切换语言" [ref=e132] [cursor=pointer]
                        - button "切换主题" [ref=e133] [cursor=pointer]
                    - button "通知" [ref=e134]
                    - button "当前用户" [ref=e138] [cursor=pointer]:
                        - generic [ref=e140]:
                            - generic "Rin" [ref=e143]: RI
                            - generic [ref=e144]: Rin
            - main [ref=e148]:
                - generic [ref=e150]:
                    - generic [ref=e152]:
                        - generic [ref=e153]:
                            - paragraph [ref=e154]: 本地演示 · 刷新后恢复示例数据
                            - heading "参考资源" [level=1] [ref=e155]
                            - paragraph [ref=e156]: 通过 File Route 与 Route Target 驱动的确定性参考资源列表。
                        - link "新建资源" [ref=e158] [cursor=pointer]:
                            - /url: /reference-resources/create
                    - list [ref=e159]:
                        - listitem [ref=e160]:
                            - generic [ref=e161]:
                                - generic [ref=e162]:
                                    - paragraph [ref=e163]: resource-alpha
                                    - heading "Alpha 示例资源" [level=2] [ref=e164]
                                    - paragraph [ref=e165]: 第一个确定性参考资源，用于验证列表、详情与编辑的路由。
                                - generic [ref=e166]: 进行中
                            - generic [ref=e168]:
                                - link "查看" [ref=e169] [cursor=pointer]:
                                    - /url: /reference-resources/detail?id=resource-alpha
                                - link "编辑" [ref=e170] [cursor=pointer]:
                                    - /url: /reference-resources/edit?id=resource-alpha
                        - listitem [ref=e171]:
                            - generic [ref=e172]:
                                - generic [ref=e173]:
                                    - paragraph [ref=e174]: resource-beta
                                    - heading "Beta 引导指南" [level=2] [ref=e175]
                                    - paragraph [ref=e176]: 展示静态路由装配与受控导航目标的确定性链路。
                                - generic [ref=e177]: 进行中
                            - generic [ref=e179]:
                                - link "查看" [ref=e180] [cursor=pointer]:
                                    - /url: /reference-resources/detail?id=resource-beta
                                - link "编辑" [ref=e181] [cursor=pointer]:
                                    - /url: /reference-resources/edit?id=resource-beta
                        - listitem [ref=e182]:
                            - generic [ref=e183]:
                                - generic [ref=e184]:
                                    - paragraph [ref=e185]: resource-gamma
                                    - heading "Gamma 模板" [level=2] [ref=e186]
                                    - paragraph [ref=e187]: 草稿资源，用于验证状态展示与编辑场景。
                                - generic [ref=e188]: 草稿
                            - generic [ref=e190]:
                                - link "查看" [ref=e191] [cursor=pointer]:
                                    - /url: /reference-resources/detail?id=resource-gamma
                                - link "编辑" [ref=e192] [cursor=pointer]:
                                    - /url: /reference-resources/edit?id=resource-gamma
```

# Test source

```ts
  1  | import AxeBuilder from '@axe-core/playwright';
  2  | import { expect, test, type Page } from '@playwright/test';
  3  |
  4  | const referenceResources = '/reference-resources';
  5  |
  6  | async function expectHydrated(page: Page) {
  7  |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  8  | }
  9  |
  10 | test('Reference Resources 列表经 Registry 派生 Navigation 进入侧栏并可直接验收', async ({
  11 |   page,
  12 | }) => {
  13 |   await page.setViewportSize({ width: 1440, height: 900 });
  14 |   await page.goto(referenceResources);
  15 |   await expectHydrated(page);
  16 |   await expect(page).toHaveURL(/\/reference-resources$/);
  17 |   await expect(page.getByRole('heading', { level: 1, name: '参考资源' })).toBeVisible();
  18 |
  19 |   // 列表展示三条确定性资源
  20 |   await expect(page.getByText('Alpha 示例资源')).toBeVisible();
  21 |   await expect(page.getByText('Beta 引导指南')).toBeVisible();
  22 |   await expect(page.getByText('Gamma 模板')).toBeVisible();
  23 |
  24 |   // Sidebar 中的 Reference Resources 分组来自 Registry resolved model
  25 |   const navigation = page.getByRole('navigation', { name: '主导航' });
  26 |   await expect(navigation.getByRole('link', { name: '参考资源' })).toBeVisible();
  27 | });
  28 |
  29 | test('Route Target Link 导航：列表 → 详情 → 编辑，编辑 canonical parent 为详情', async ({
  30 |   page,
  31 | }) => {
  32 |   await page.setViewportSize({ width: 1440, height: 900 });
  33 |   await page.goto(referenceResources);
  34 |   await expectHydrated(page);
  35 |
  36 |   await page.getByRole('link', { name: '查看', exact: true }).first().click();
  37 |   await expect(page).toHaveURL(/\/reference-resources\/detail\?id=resource-alpha$/);
  38 |   await expect(page.getByRole('heading', { level: 1, name: '参考资源详情' })).toBeVisible();
  39 |   await expect(page.getByText('Alpha 示例资源')).toBeVisible();
  40 |
  41 |   await page.getByRole('link', { name: '编辑此资源' }).click();
  42 |   await expect(page).toHaveURL(/\/reference-resources\/edit\?id=resource-alpha$/);
  43 |   await expect(page.getByRole('heading', { level: 1, name: '编辑参考资源' })).toBeVisible();
  44 | });
  45 |
  46 | test('创建页提交通过 imperative navigation 返回列表', async ({ page }) => {
  47 |   await page.setViewportSize({ width: 1440, height: 900 });
  48 |   await page.goto('/reference-resources/create');
  49 |   await expectHydrated(page);
  50 |   await expect(page.getByRole('heading', { level: 1, name: '创建参考资源' })).toBeVisible();
  51 |
  52 |   await page.getByLabel('名称').fill('本地新增资源');
  53 |   await page.getByRole('button', { name: '创建' }).click();
  54 |   await expect(page).toHaveURL(/\/reference-resources$/);
  55 |   await expect(page.getByRole('heading', { level: 1, name: '参考资源' })).toBeVisible();
  56 | });
  57 |
  58 | test('Reference Resources 页面 Axe WCAG AA 无违规', async ({ page }) => {
  59 |   await page.setViewportSize({ width: 1440, height: 900 });
  60 |   for (const route of [
  61 |     referenceResources,
  62 |     '/reference-resources/detail?id=resource-alpha',
  63 |     '/reference-resources/edit?id=resource-alpha',
  64 |     '/reference-resources/create',
  65 |   ]) {
  66 |     await page.goto(route);
  67 |     await expectHydrated(page);
  68 |     const accessibility = await new AxeBuilder({ page })
  69 |       .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  70 |       .analyze();
  71 |     expect(accessibility.violations, `${route} axe violations`).toEqual([]);
  72 |   }
  73 | });
  74 |
  75 | test('Reference Resources 视觉基线（桌面全页）', async ({ page }) => {
  76 |   await page.setViewportSize({ width: 1440, height: 900 });
  77 |   await page.goto(referenceResources);
  78 |   await expectHydrated(page);
> 79 |   await expect.soft(page).toHaveScreenshot('reference-resources-desktop.png', { fullPage: true });
     |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
  80 | });
  81 |
  82 | test('窄屏与英文扩张下 Reference Resources 无横向溢出', async ({ page }) => {
  83 |   await page.setViewportSize({ width: 390, height: 844 });
  84 |   await page.goto(referenceResources);
  85 |   await expectHydrated(page);
  86 |   await page.getByRole('button', { name: '当前用户', exact: true }).click();
  87 |   await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  88 |   await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  89 |   await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  90 |   const overflow = await page.evaluate(
  91 |     () => document.documentElement.scrollWidth - window.innerWidth,
  92 |   );
  93 |   expect(overflow).toBeLessThanOrEqual(0);
  94 | });
  95 |
```
