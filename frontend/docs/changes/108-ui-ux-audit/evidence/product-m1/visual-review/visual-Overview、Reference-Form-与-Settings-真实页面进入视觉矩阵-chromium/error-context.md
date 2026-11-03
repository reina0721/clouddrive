# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: visual.spec.ts >> Overview、Reference Form 与 Settings 真实页面进入视觉矩阵
- Location: apps\web\e2e\visual.spec.ts:109:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 1440px by 1369px, received 1440px by 1010px. 52530 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: overview-desktop.png

Call log:
  - Expect "soft toHaveScreenshot(overview-desktop.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 1440px by 1369px, received 1440px by 1010px. 50095 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 1440px by 1369px, received 1440px by 1010px. 52530 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
    - button "Open Next.js Dev Tools" [ref=f2e7] [cursor=pointer]
    - alert [ref=f2e11]
    - link "跳到主要内容 / Skip to content" [ref=f2e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=f2e13]:
        - complementary [ref=f2e14]:
            - generic [ref=f2e15]:
                - generic [ref=f2e16]: C
                - generic [ref=f2e18]:
                    - paragraph [ref=f2e19]: clouddrive
                    - paragraph [ref=f2e20]: 管理工作空间
            - navigation "主导航" [ref=f2e21]:
                - generic [ref=f2e22]:
                    - paragraph [ref=f2e23]: 工作空间
                    - list "工作空间" [ref=f2e24]:
                        - listitem [ref=f2e25]:
                            - link "工作台" [ref=f2e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f2e34]:
                    - paragraph [ref=f2e35]: 个人
                    - list "个人" [ref=f2e36]:
                        - listitem [ref=f2e37]:
                            - link "个人偏好" [ref=f2e38] [cursor=pointer]:
                                - /url: /settings
                - generic [ref=f2e44]:
                    - paragraph [ref=f2e45]: 开发中心
                    - list "开发中心" [ref=f2e46]:
                        - listitem [ref=f2e47]:
                            - button "展开或收起UI Elements" [ref=f2e48]:
                                - generic [ref=f2e55]: UI Elements
                        - listitem [ref=f2e58]:
                            - button "展开或收起Page Patterns" [ref=f2e59]:
                                - generic [ref=f2e66]: Page Patterns
                        - listitem [ref=f2e69]:
                            - button "展开或收起Page Archetypes" [ref=f2e70]:
                                - generic [ref=f2e74]: Page Archetypes
                        - listitem [ref=f2e77]:
                            - link "参考资源" [ref=f2e78] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=f2e83]:
                            - link "Icon 大全" [ref=f2e84] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=f2e91]:
                            - link "基座能力" [ref=f2e92] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f2e105]:
                            - link "Motion" [ref=f2e106] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f2e115]:
                            - link "状态体系" [ref=f2e116] [cursor=pointer]:
                                - /url: /states
        - generic [ref=f2e123]:
            - banner [ref=f2e125]:
                - button "收起侧栏" [ref=f2e127] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f2e129] [cursor=pointer]
                - generic [ref=f2e130]:
                    - generic [ref=f2e131]:
                        - button "切换语言" [ref=f2e132] [cursor=pointer]
                        - button "切换主题" [ref=f2e133] [cursor=pointer]
                    - button "通知" [ref=f2e134]
                    - button "当前用户" [ref=f2e138] [cursor=pointer]:
                        - generic [ref=f2e140]:
                            - generic "Rin" [ref=f2e143]: RI
                            - generic [ref=f2e144]: Rin
            - main [ref=f2e148]:
                - generic [ref=f2e150]:
                    - generic [ref=f2e153]:
                        - paragraph [ref=f2e154]: 个人偏好
                        - heading "外观" [level=1] [ref=f2e155]
                        - paragraph [ref=f2e156]: 主题、强调色、密度、字号、内容宽度、动效与对比度。 更改立即生效并保存在当前浏览器。
                    - generic [ref=f2e157]:
                        - complementary [ref=f2e158]:
                            - generic [ref=f2e160]:
                                - group [ref=f2e163]:
                                    - searchbox "搜索设置项" [ref=f2e164]
                                    - button "Close"
                                - navigation "设置分类" [ref=f2e165]:
                                    - generic [ref=f2e166]:
                                        - paragraph [ref=f2e167]: 显示与数据
                                        - link "外观" [ref=f2e168] [cursor=pointer]:
                                            - /url: /settings
                                        - link "导航" [ref=f2e176] [cursor=pointer]:
                                            - /url: /settings/navigation
                                        - link "数据展示" [ref=f2e185] [cursor=pointer]:
                                            - /url: /settings/data-display
                                    - generic [ref=f2e189]:
                                        - paragraph [ref=f2e190]: 偏好与反馈
                                        - link "操作偏好" [ref=f2e191] [cursor=pointer]:
                                            - /url: /settings/actions
                                        - link "语言与地区" [ref=f2e199] [cursor=pointer]:
                                            - /url: /settings/locale
                                        - link "通知" [ref=f2e204] [cursor=pointer]:
                                            - /url: /settings/notifications
                                    - generic [ref=f2e208]:
                                        - paragraph [ref=f2e209]: 辅助与输入
                                        - link "可访问性" [ref=f2e210] [cursor=pointer]:
                                            - /url: /settings/accessibility
                                        - link "快捷键" [ref=f2e218] [cursor=pointer]:
                                            - /url: /settings/shortcuts
                        - generic [ref=f2e223]:
                            - generic [ref=f2e225]:
                                - generic [ref=f2e226]:
                                    - heading "主题与色彩" [level=2] [ref=f2e229]
                                    - generic [ref=f2e232]:
                                        - radiogroup "主题模式" [ref=f2e234]:
                                            - generic [ref=f2e241]:
                                                - generic [ref=f2e242]: 主题模式
                                                - generic [ref=f2e243]: 切换浅色、深色或跟随系统，立即预览。
                                            - generic [ref=f2e244]:
                                                - generic [ref=f2e246] [cursor=pointer]:
                                                    - radio "浅色主题" [ref=f2e248]
                                                    - generic [ref=f2e256]: 浅色主题
                                                - generic [ref=f2e259] [cursor=pointer]:
                                                    - radio "深色主题" [ref=f2e261]
                                                    - generic [ref=f2e265]: 深色主题
                                                - generic [ref=f2e268] [cursor=pointer]:
                                                    - radio "跟随系统" [checked] [ref=f2e270]
                                                    - generic [ref=f2e283]: 跟随系统
                                        - radiogroup "强调色" [ref=f2e286]:
                                            - generic [ref=f2e290]:
                                                - generic [ref=f2e292] [cursor=pointer]:
                                                    - radio "紫色" [checked] [ref=f2e294]
                                                    - generic [ref=f2e297]: 紫色
                                                - generic [ref=f2e300] [cursor=pointer]:
                                                    - radio "蓝色" [ref=f2e302]
                                                    - generic [ref=f2e305]: 蓝色
                                                - generic [ref=f2e308] [cursor=pointer]:
                                                    - radio "绿色" [ref=f2e310]
                                                    - generic [ref=f2e313]: 绿色
                                                - generic [ref=f2e316] [cursor=pointer]:
                                                    - radio "橙色" [ref=f2e318]
                                                    - generic [ref=f2e321]: 橙色
                                            - generic [ref=f2e323]: 产品主操作与选中状态的强调颜色。
                                - generic [ref=f2e324]:
                                    - heading "空间与阅读" [level=2] [ref=f2e327]
                                    - generic [ref=f2e330]:
                                        - radiogroup "界面密度" [ref=f2e332]:
                                            - generic [ref=f2e334]:
                                                - generic [ref=f2e335]: 界面密度
                                                - generic [ref=f2e336]: 比较空间节奏示意；选择后在当前页面即时生效。
                                            - generic [ref=f2e337]:
                                                - generic [ref=f2e339] [cursor=pointer]:
                                                    - radio "紧凑" [ref=f2e341]
                                                    - generic [ref=f2e342]: 紧凑
                                                - generic [ref=f2e345] [cursor=pointer]:
                                                    - radio "标准" [checked] [ref=f2e347]
                                                    - generic [ref=f2e348]: 标准
                                                - generic [ref=f2e351] [cursor=pointer]:
                                                    - radio "宽松" [ref=f2e353]
                                                    - generic [ref=f2e354]: 宽松
                                        - radiogroup "界面字号" [ref=f2e357]:
                                            - generic [ref=f2e359]:
                                                - generic [ref=f2e360]: 界面字号
                                                - generic [ref=f2e361]: 比较字样大小；选择后整体界面立即缩放。
                                            - generic [ref=f2e362]:
                                                - generic [ref=f2e364] [cursor=pointer]:
                                                    - radio "小" [ref=f2e366]
                                                    - generic: Aa 字
                                                    - generic [ref=f2e367]: 小
                                                - generic [ref=f2e370] [cursor=pointer]:
                                                    - radio "标准" [checked] [ref=f2e372]
                                                    - generic: Aa 字
                                                    - generic [ref=f2e373]: 标准
                                                - generic [ref=f2e376] [cursor=pointer]:
                                                    - radio "大" [ref=f2e378]
                                                    - generic: Aa 字
                                                    - generic [ref=f2e379]: 大
                                        - radiogroup "内容宽度" [ref=f2e382]:
                                            - generic [ref=f2e384]:
                                                - generic [ref=f2e385]: 内容宽度
                                                - generic [ref=f2e386]: 比较容器比例示意；窄屏下均使用可用宽度。
                                            - generic [ref=f2e387]:
                                                - generic [ref=f2e389] [cursor=pointer]:
                                                    - radio "自适应" [checked] [ref=f2e391]
                                                    - generic [ref=f2e392]: 自适应
                                                - generic [ref=f2e395] [cursor=pointer]:
                                                    - radio "标准" [ref=f2e397]
                                                    - generic [ref=f2e398]: 标准
                                                - generic [ref=f2e401] [cursor=pointer]:
                                                    - radio "宽屏" [ref=f2e403]
                                                    - generic [ref=f2e404]: 宽屏
                                - generic [ref=f2e406]:
                                    - heading "动效与视觉辅助" [level=2] [ref=f2e409]
                                    - generic [ref=f2e412]:
                                        - radiogroup "动效偏好" [ref=f2e414]:
                                            - generic [ref=f2e418]:
                                                - generic [ref=f2e420] [cursor=pointer]:
                                                    - radio "跟随系统" [checked] [ref=f2e422]
                                                    - generic [ref=f2e424]: 跟随系统
                                                - generic [ref=f2e427] [cursor=pointer]:
                                                    - radio "标准" [ref=f2e429]
                                                    - generic [ref=f2e431]: 标准
                                                - generic [ref=f2e434] [cursor=pointer]:
                                                    - radio "减少动效" [ref=f2e436]
                                                    - generic [ref=f2e438]: 减少动效
                                            - generic [ref=f2e440]: 跟随系统、标准或减少动效。
                                        - radiogroup "高对比度" [ref=f2e442]:
                                            - generic [ref=f2e446]:
                                                - generic [ref=f2e448] [cursor=pointer]:
                                                    - radio "跟随系统" [checked] [ref=f2e450]
                                                    - generic [ref=f2e452]: 跟随系统
                                                - generic [ref=f2e455] [cursor=pointer]:
                                                    - radio "标准" [ref=f2e457]
                                                    - generic [ref=f2e459]: 标准
                                                - generic [ref=f2e462] [cursor=pointer]:
                                                    - radio "高对比度" [ref=f2e464]
                                                    - generic [ref=f2e466]: 高对比度
                                            - generic [ref=f2e468]: 高对比度增强辅助文字、边界与焦点轮廓；跟随系统响应操作系统的对比度偏好。
                                        - generic [ref=f2e469]:
                                            - paragraph [ref=f2e470]: 即时效果预览
                                            - paragraph [ref=f2e471]: 切换内容查看动效；使用 Tab 聚焦按钮检查轮廓。减少动效和系统偏好同样作用于此预览。
                                            - generic [ref=f2e472]:
                                                - button "切换预览内容" [ref=f2e473] [cursor=pointer]
                                                - generic [ref=f2e475]: 辅助文字与边界示例
                                            - paragraph [ref=f2e478]: 当前设置已应用。可比较主要操作、辅助文字和边界。
                            - generic [ref=f2e479]:
                                - button "恢复默认" [ref=f2e480] [cursor=pointer]
                                - button "恢复全部默认" [ref=f2e481] [cursor=pointer]
```

# Test source

```ts
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
  94  |   await expect.soft(page).toHaveScreenshot('mobile-navigation-open.png');
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
> 115 |   await expect.soft(page).toHaveScreenshot('overview-desktop.png', { fullPage: true });
      |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
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
