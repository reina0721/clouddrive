# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.ts >> 移动侧栏打开状态纳入视觉回归
- Location: apps\web\e2e\visual.spec.ts:88:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  6623 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: mobile-navigation-open.png

Call log:
  - Expect "soft toHaveScreenshot(mobile-navigation-open.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 6623 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 6623 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
    - alert [ref=e11]
    - link "跳到主要内容 / Skip to content" [ref=e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=e14]:
        - banner [ref=e16]:
            - button "打开导航" [ref=e18] [cursor=pointer]
            - button "搜索页面与操作" [ref=e20] [cursor=pointer]
            - generic [ref=e21]:
                - button "通知" [ref=e22]
                - button "当前用户" [ref=e26] [cursor=pointer]:
                    - generic "Rin" [ref=e30]: RI
        - main [ref=e31]:
            - generic [ref=e33]:
                - generic [ref=e34]:
                    - list "面包屑导航" [ref=e35]:
                        - listitem [ref=e36]:
                            - link "基座验证" [ref=e37] [cursor=pointer]
                            - generic [ref=e38]: /
                        - listitem [ref=e39]:
                            - link "数据工作台" [disabled]
                    - generic [ref=e40]:
                        - generic [ref=e41]:
                            - paragraph [ref=e42]: Reference · Workspace
                            - heading "高密度数据工作台" [level=1] [ref=e43]
                            - paragraph [ref=e44]: 使用 48 条本地基准数据验证 Dashboard、筛选、Table、Master-Detail、Tabs、Drawer、Dialog 与非正常状态的协作边界。
                        - generic [ref=e45]:
                            - button "打开活动侧栏" [ref=e46] [cursor=pointer]
                            - button "打开确认对话框" [ref=e47] [cursor=pointer]
                - generic [ref=e48]:
                    - generic [ref=e49]:
                        - paragraph [ref=e50]: 总工作流
                        - paragraph [ref=e51]: '48'
                    - generic [ref=e52]:
                        - paragraph [ref=e53]: 需关注
                        - paragraph [ref=e54]: '16'
                    - generic [ref=e55]:
                        - paragraph [ref=e56]: 高风险
                        - paragraph [ref=e57]: '16'
                    - generic [ref=e58]:
                        - paragraph [ref=e59]: 筛选结果
                        - paragraph [ref=e60]: '48'
                - toolbar "页面工具栏" [ref=e61]:
                    - generic [ref=e64]:
                        - group [ref=e66]:
                            - searchbox "搜索 Reference 数据" [ref=e67]
                            - button "Close"
                        - button "搜索" [ref=e68] [cursor=pointer]
                    - button "导出快照" [ref=e71] [cursor=pointer]
                - generic [ref=e74]:
                    - generic [ref=e75]:
                        - generic [ref=e76]: 状态
                        - button "全部 状态" [ref=e77] [cursor=pointer]:
                            - generic [ref=e78]: 全部
                        - combobox [ref=e85]
                    - generic [ref=e86]:
                        - generic [ref=e87]: 区域
                        - button "全部 区域" [ref=e88] [cursor=pointer]:
                            - generic [ref=e89]: 全部
                        - combobox [ref=e96]
                    - generic [ref=e97]:
                        - generic [ref=e98]: 表格密度
                        - button "舒适 表格密度" [ref=e99] [cursor=pointer]:
                            - generic [ref=e100]: 舒适
                        - combobox [ref=e107]
                    - generic [ref=e108]:
                        - generic [ref=e109]: 场景状态
                        - button "正常 场景状态" [ref=e110] [cursor=pointer]:
                            - generic [ref=e111]: 正常
                        - combobox [ref=e118]
                - region "Reference 工作流数据表" [ref=e119]:
                    - generic [ref=e121]:
                        - generic [ref=e122]:
                            - generic [ref=e123]:
                                - heading "工作流列表" [level=2] [ref=e124]
                                - paragraph [ref=e125]: 当前展示 48 条记录；数据量用于验证滚动、密度与溢出。
                            - button "列设置" [ref=e128]
                        - generic [ref=e129]:
                            - grid "Reference 工作流数据表" [ref=e133]:
                                - rowgroup [ref=e134]:
                                    - row [ref=e135]:
                                        - columnheader [ref=e136] [cursor=pointer]:
                                            - generic [ref=e137]: 工作流
                                            - slider "尺寸调整器 工作流" [ref=e138]: '174'
                                        - columnheader [ref=e139] [cursor=pointer]:
                                            - generic [ref=e140]: 状态
                                            - slider "尺寸调整器 状态" [ref=e141]: '174'
                                - rowgroup [ref=e142]:
                                    - row [ref=e143] [cursor=pointer]:
                                        - rowheader [ref=e144]:
                                            - generic [ref=e145]:
                                                - paragraph [ref=e146]: North Star analytics 1
                                                - paragraph [ref=e147]: REF-001
                                        - gridcell "健康" [ref=e148]
                                    - row [ref=e151] [cursor=pointer]:
                                        - rowheader [ref=e152]:
                                            - generic [ref=e153]:
                                                - paragraph [ref=e154]: Creator support operations 13
                                                - paragraph [ref=e155]: REF-013
                                        - gridcell "健康" [ref=e156]
                                    - row [ref=e159] [cursor=pointer]:
                                        - rowheader [ref=e160]:
                                            - generic [ref=e161]:
                                                - paragraph [ref=e162]: North Star analytics 25
                                                - paragraph [ref=e163]: REF-025
                                        - gridcell "健康" [ref=e164]
                                    - row [ref=e167] [cursor=pointer]:
                                        - rowheader [ref=e168]:
                                            - generic [ref=e169]:
                                                - paragraph [ref=e170]: Creator support operations 37
                                                - paragraph [ref=e171]: REF-037
                                        - gridcell "健康" [ref=e172]
                                    - row [ref=e175] [cursor=pointer]:
                                        - rowheader [ref=e176]:
                                            - generic [ref=e177]:
                                                - paragraph [ref=e178]: Partner onboarding 2
                                                - paragraph [ref=e179]: REF-002
                                        - gridcell "需关注" [ref=e180]
                                    - row [ref=e183] [cursor=pointer]:
                                        - rowheader [ref=e184]:
                                            - generic [ref=e185]:
                                                - paragraph [ref=e186]: Moderation quality signals 14
                                                - paragraph [ref=e187]: REF-014
                                        - gridcell "需关注" [ref=e188]
                                    - row [ref=e191] [cursor=pointer]:
                                        - rowheader [ref=e192]:
                                            - generic [ref=e193]:
                                                - paragraph [ref=e194]: Partner onboarding 26
                                                - paragraph [ref=e195]: REF-026
                                        - gridcell "需关注" [ref=e196]
                                    - row [ref=e199] [cursor=pointer]:
                                        - rowheader [ref=e200]:
                                            - generic [ref=e201]:
                                                - paragraph [ref=e202]: Moderation quality signals 38
                                                - paragraph [ref=e203]: REF-038
                                        - gridcell "需关注" [ref=e204]
                                    - row [ref=e207] [cursor=pointer]:
                                        - rowheader [ref=e208]:
                                            - generic [ref=e209]:
                                                - paragraph [ref=e210]: Trust review pipeline 3
                                                - paragraph [ref=e211]: REF-003
                                        - gridcell "已暂停" [ref=e212]
                                    - row [ref=e215] [cursor=pointer]:
                                        - rowheader [ref=e216]:
                                            - generic [ref=e217]:
                                                - paragraph [ref=e218]: Billing reconciliation 15
                                                - paragraph [ref=e219]: REF-015
                                        - gridcell "已暂停" [ref=e220]
                                    - row [ref=e223] [cursor=pointer]:
                                        - rowheader [ref=e224]:
                                            - generic [ref=e225]:
                                                - paragraph [ref=e226]: Trust review pipeline 27
                                                - paragraph [ref=e227]: REF-027
                                        - gridcell "已暂停" [ref=e228]
                                    - row [ref=e231] [cursor=pointer]:
                                        - rowheader [ref=e232]:
                                            - generic [ref=e233]:
                                                - paragraph [ref=e234]: Billing reconciliation 39
                                                - paragraph [ref=e235]: REF-039
                                        - gridcell "已暂停" [ref=e236]
                                    - row [ref=e239] [cursor=pointer]:
                                        - rowheader [ref=e240]:
                                            - generic [ref=e241]:
                                                - paragraph [ref=e242]: Regional release readiness 4
                                                - paragraph [ref=e243]: REF-004
                                        - gridcell "健康" [ref=e244]
                                    - row [ref=e247] [cursor=pointer]:
                                        - rowheader [ref=e248]:
                                            - generic [ref=e249]:
                                                - paragraph [ref=e250]: Content lifecycle governance 16
                                                - paragraph [ref=e251]: REF-016
                                        - gridcell "健康" [ref=e252]
                                    - row [ref=e255] [cursor=pointer]:
                                        - rowheader [ref=e256]:
                                            - generic [ref=e257]:
                                                - paragraph [ref=e258]: Regional release readiness 28
                                                - paragraph [ref=e259]: REF-028
                                        - gridcell "健康" [ref=e260]
                                    - row [ref=e263] [cursor=pointer]:
                                        - rowheader [ref=e264]:
                                            - generic [ref=e265]:
                                                - paragraph [ref=e266]: Content lifecycle governance 40
                                                - paragraph [ref=e267]: REF-040
                                        - gridcell "健康" [ref=e268]
                                    - row [ref=e271] [cursor=pointer]:
                                        - rowheader [ref=e272]:
                                            - generic [ref=e273]:
                                                - paragraph [ref=e274]: Creator support operations 5
                                                - paragraph [ref=e275]: REF-005
                                        - gridcell "需关注" [ref=e276]
                                    - row [ref=e279] [cursor=pointer]:
                                        - rowheader [ref=e280]:
                                            - generic [ref=e281]:
                                                - paragraph [ref=e282]: North Star analytics 17
                                                - paragraph [ref=e283]: REF-017
                                        - gridcell "需关注" [ref=e284]
                                    - row [ref=e287] [cursor=pointer]:
                                        - rowheader [ref=e288]:
                                            - generic [ref=e289]:
                                                - paragraph [ref=e290]: Creator support operations 29
                                                - paragraph [ref=e291]: REF-029
                                        - gridcell "需关注" [ref=e292]
                                    - row [ref=e295] [cursor=pointer]:
                                        - rowheader [ref=e296]:
                                            - generic [ref=e297]:
                                                - paragraph [ref=e298]: North Star analytics 41
                                                - paragraph [ref=e299]: REF-041
                                        - gridcell "需关注" [ref=e300]
                            - navigation "Reference 列表分页" [ref=e304]:
                                - list [ref=e305]:
                                    - listitem [ref=e306]:
                                        - button "上一页" [disabled]:
                                            - generic: ‹
                                    - listitem [ref=e307]:
                                        - button "第 1 页" [ref=e308] [cursor=pointer]: '1'
                                    - listitem [ref=e309]:
                                        - button "第 2 页" [ref=e310] [cursor=pointer]: '2'
                                    - listitem [ref=e311]:
                                        - button "第 3 页" [ref=e312] [cursor=pointer]: '3'
                                    - listitem [ref=e313]:
                                        - button "下一页" [ref=e314] [cursor=pointer]:
                                            - generic [ref=e315]: ›
    - generic [ref=e316]:
        - generic:
            - generic:
                - button "取消"
            - dialog [active] [ref=e317]:
                - generic [ref=e318]:
                    - heading "主导航" [level=2] [ref=e319]
                    - paragraph [ref=e320]: 管理工作空间
                    - button "关闭导航" [ref=e321] [cursor=pointer]:
                        - generic [ref=e322]: ×
                - generic [ref=e323]:
                    - generic [ref=e324]:
                        - generic [ref=e325]: C
                        - generic [ref=e327]:
                            - paragraph [ref=e328]: clouddrive
                            - paragraph [ref=e329]: 管理工作空间
                    - navigation "主导航" [ref=e330]:
                        - generic [ref=e331]:
                            - paragraph [ref=e332]: 工作空间
                            - list "工作空间" [ref=e333]:
                                - listitem [ref=e334]:
                                    - link "工作台" [ref=e335] [cursor=pointer]:
                                        - /url: /
                        - generic [ref=e343]:
                            - paragraph [ref=e344]: 个人
                            - list "个人" [ref=e345]:
                                - listitem [ref=e346]:
                                    - link "个人偏好" [ref=e347] [cursor=pointer]:
                                        - /url: /settings
                        - generic [ref=e353]:
                            - paragraph [ref=e354]: 开发中心
                            - list "开发中心" [ref=e355]:
                                - listitem [ref=e356]:
                                    - button "展开或收起UI Elements" [ref=e357]:
                                        - generic [ref=e364]: UI Elements
                                - listitem [ref=e367]:
                                    - button "展开或收起Page Patterns" [ref=e368]:
                                        - generic [ref=e375]: Page Patterns
                                - listitem [ref=e378]:
                                    - button "展开或收起Page Archetypes" [expanded] [ref=e379]:
                                        - generic [ref=e383]: Page Archetypes
                                    - list [ref=e386]:
                                        - listitem [ref=e387]:
                                            - link "总览原型" [ref=e388] [cursor=pointer]:
                                                - /url: /page-archetypes/overview
                                        - listitem [ref=e393]:
                                            - link "数据工作台" [ref=e394] [cursor=pointer]:
                                                - /url: /page-archetypes/resource-list
                                        - listitem [ref=e399]:
                                            - link "详情页" [ref=e400] [cursor=pointer]:
                                                - /url: /page-archetypes/detail
                                        - listitem [ref=e405]:
                                            - link "创建与编辑" [ref=e406] [cursor=pointer]:
                                                - /url: /page-archetypes/create-edit
                                        - listitem [ref=e411]:
                                            - link "设置页" [ref=e412] [cursor=pointer]:
                                                - /url: /page-archetypes/settings
                                        - listitem [ref=e417]:
                                            - link "主从视图" [ref=e418] [cursor=pointer]:
                                                - /url: /page-archetypes/master-detail
                                        - listitem [ref=e423]:
                                            - link "操作任务" [ref=e424] [cursor=pointer]:
                                                - /url: /page-archetypes/operation
                                - listitem [ref=e429]:
                                    - link "参考资源" [ref=e430] [cursor=pointer]:
                                        - /url: /reference-resources
                                - listitem [ref=e435]:
                                    - link "Icon 大全" [ref=e436] [cursor=pointer]:
                                        - /url: /system-tools/icons
                                - listitem [ref=e443]:
                                    - link "基座能力" [ref=e444] [cursor=pointer]:
                                        - /url: /foundations
                                - listitem [ref=e457]:
                                    - link "Motion" [ref=e458] [cursor=pointer]:
                                        - /url: /motion
                                - listitem [ref=e467]:
                                    - link "状态体系" [ref=e468] [cursor=pointer]:
                                        - /url: /states
```

# Test source

```ts
  1   | import { expect, test, type Page } from '@playwright/test';
  2   | import { waitForVisualReadiness } from './visual-readiness';
  3   |
  4   | async function expectHydrated(page: Page) {
  5   |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  6   |   await waitForVisualReadiness(page);
  7   | }
  8   |
  9   | async function expectReferenceReady(page: Page) {
  10  |   await expectHydrated(page);
  11  |   await expect(page.getByRole('heading', { level: 1 })).toHaveText('高密度数据工作台');
  12  |   // 默认每页 20 → 首页 20 数据行 + 1 表头。
  13  |   await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  14  | }
  15  |
  16  | test('桌面与超宽屏 Reference 布局保持稳定', async ({ page }) => {
  17  |   await page.setViewportSize({ width: 1440, height: 900 });
  18  |   await page.goto('/page-archetypes/resource-list');
  19  |   await expectReferenceReady(page);
  20  |   await expect.soft(page).toHaveScreenshot('reference-desktop.png', { fullPage: true });
  21  |
  22  |   await page.setViewportSize({ width: 1920, height: 1080 });
  23  |   await page.reload();
  24  |   await expectReferenceReady(page);
  25  |   await expect.soft(page).toHaveScreenshot('reference-ultrawide.png', { fullPage: true });
  26  | });
  27  |
  28  | test('桌面 UI Elements Family 保持基础组件权威面稳定', async ({ page }) => {
  29  |   const consoleErrors: string[] = [];
  30  |   page.on('console', (message) => {
  31  |     if (message.type() === 'error') consoleErrors.push(message.text());
  32  |   });
  33  |   await page.setViewportSize({ width: 1440, height: 1000 });
  34  |   await page.goto('/ui-elements/actions-selection');
  35  |   await expectHydrated(page);
  36  |   await expect(page.getByRole('heading', { level: 1, name: '操作与选择' })).toBeVisible();
  37  |   await expect(page.getByText('公开 Element 46 / 46')).toBeVisible();
  38  |   await expect.soft(page).toHaveScreenshot('ui-elements-desktop.png', { fullPage: true });
  39  |   expect(consoleErrors).toEqual([]);
  40  | });
  41  |
  42  | test('九个 UI Element Family 页面均有独立视觉基线', async ({ page }) => {
  43  |   // Nine independent renders and snapshot comparisons retain their per-assertion limit.
  44  |   test.setTimeout(120_000);
  45  |   await page.setViewportSize({ width: 1440, height: 1000 });
  46  |
  47  |   const families = [
  48  |     'actions-selection',
  49  |     'feedback',
  50  |     'status-async',
  51  |     'identity-display',
  52  |     'navigation',
  53  |     'data',
  54  |     'surfaces',
  55  |     'forms',
  56  |     'overlays',
  57  |   ] as const;
  58  |
  59  |   for (const family of families) {
  60  |     await page.goto(`/ui-elements/${family}`);
  61  |     await expectHydrated(page);
  62  |     await expect(page.getByText('公开 Element 46 / 46')).toBeVisible();
  63  |     const sectionId = family === 'actions-selection' ? 'actions' : family;
  64  |     await expect
  65  |       .soft(page.locator(`#${sectionId}`))
  66  |       .toHaveScreenshot(`ui-elements-family-${family}.png`);
  67  |   }
  68  | });
  69  |
  70  | test('移动窗口、Dark Mode 与英文扩张保持无溢出', async ({ page }) => {
  71  |   await page.setViewportSize({ width: 390, height: 844 });
  72  |   await page.goto('/ui-elements/forms');
  73  |   await expectHydrated(page);
  74  |   await page.getByRole('button', { name: '当前用户', exact: true }).click();
  75  |   await page.getByRole('menuitem', { name: /^主题 / }).click();
  76  |   await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  77  |   await page.getByRole('button', { name: '当前用户', exact: true }).click();
  78  |   await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  79  |   await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  80  |   await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  81  |   const overflow = await page.evaluate(
  82  |     () => document.documentElement.scrollWidth - window.innerWidth,
  83  |   );
  84  |   expect(overflow).toBeLessThanOrEqual(0);
  85  |   await expect.soft(page).toHaveScreenshot('ui-elements-mobile-dark-en.png', { fullPage: true });
  86  | });
  87  |
  88  | test('移动侧栏打开状态纳入视觉回归', async ({ page }) => {
  89  |   await page.setViewportSize({ width: 390, height: 844 });
  90  |   await page.goto('/page-archetypes/resource-list');
  91  |   await expectHydrated(page);
  92  |   await page.getByRole('button', { name: '打开导航' }).click();
  93  |   await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
> 94  |   await expect.soft(page).toHaveScreenshot('mobile-navigation-open.png');
      |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
  95  | });
  96  |
  97  | test('状态体系页面保持 Loading 与异常状态视觉基线', async ({ page }) => {
  98  |   await page.setViewportSize({ width: 1440, height: 900 });
  99  |   await page.goto('/states');
  100 |   await expectHydrated(page);
  101 |   await expect(page.getByRole('heading', { name: '加载未完成' })).toBeVisible();
  102 |   await expect(page.getByRole('region', { name: '正在同步界面能力' })).toHaveAttribute(
  103 |     'aria-busy',
  104 |     'true',
  105 |   );
  106 |   await expect.soft(page).toHaveScreenshot('states-desktop.png', { fullPage: true });
  107 | });
  108 |
  109 | test('Overview、Reference Form 与 Settings 真实页面进入视觉矩阵', async ({ page }) => {
  110 |   await page.setViewportSize({ width: 1440, height: 900 });
  111 |
  112 |   await page.goto('/');
  113 |   await expectHydrated(page);
  114 |   await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  115 |   await expect.soft(page).toHaveScreenshot('overview-desktop.png', { fullPage: true });
  116 |
  117 |   await page.goto('/page-archetypes/create-edit');
  118 |   await expectHydrated(page);
  119 |   await expect(page.getByRole('heading', { name: '复杂设置与审批表单' })).toBeVisible();
  120 |   await expect.soft(page).toHaveScreenshot('reference-form-desktop.png', { fullPage: true });
  121 |
  122 |   await page.goto('/settings');
  123 |   await expectHydrated(page);
  124 |   // 根 /settings 即默认外观分类页（无索引主页）。
  125 |   await expect(page.getByRole('heading', { level: 1, name: '外观' })).toBeVisible();
  126 |   await expect.soft(page).toHaveScreenshot('settings-desktop.png', { fullPage: true });
  127 | });
  128 |
  129 | test('Toast、Destructive Confirm 与 Compact Density 开启态进入视觉矩阵', async ({ page }) => {
  130 |   await page.setViewportSize({ width: 1440, height: 900 });
  131 |
  132 |   await page.goto('/ui-elements/feedback?overlay=toast&density=compact');
  133 |   await expectHydrated(page);
  134 |   await expect(page.getByText('项目反馈已入队')).toBeVisible();
  135 |   await expect.soft(page).toHaveScreenshot('ui-elements-toast-compact.png');
  136 |
  137 |   await page.goto('/ui-elements/overlays?overlay=confirm');
  138 |   await expectHydrated(page);
  139 |   await expect(page.getByRole('alertdialog')).toBeVisible();
  140 |   await expect.soft(page).toHaveScreenshot('ui-elements-destructive-confirm.png');
  141 | });
  142 |
  143 | test('Reference 多选与分页的真实联动状态进入视觉矩阵', async ({ page }) => {
  144 |   await page.setViewportSize({ width: 1440, height: 900 });
  145 |   await page.goto('/page-archetypes/resource-list');
  146 |   await expectReferenceReady(page);
  147 |   const rows = page.getByRole('grid').getByRole('row');
  148 |   await rows.nth(1).click();
  149 |   await expect(rows.nth(1)).toHaveAttribute('data-selected', 'true');
  150 |   await rows.nth(2).focus();
  151 |   await rows.nth(2).press('Enter');
  152 |   await expect(page.getByText('已选 2 条')).toBeVisible();
  153 |   await page.evaluate(() => {
  154 |     window.scrollTo({ top: 0, behavior: 'instant' });
  155 |     for (const container of document.querySelectorAll<HTMLElement>(
  156 |       '[data-table-scroll-container]',
  157 |     )) {
  158 |       container.scrollLeft = 0;
  159 |     }
  160 |     if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  161 |   });
  162 |   await expect.soft(page).toHaveScreenshot('reference-multi-select.png', { fullPage: true });
  163 | });
  164 |
```
