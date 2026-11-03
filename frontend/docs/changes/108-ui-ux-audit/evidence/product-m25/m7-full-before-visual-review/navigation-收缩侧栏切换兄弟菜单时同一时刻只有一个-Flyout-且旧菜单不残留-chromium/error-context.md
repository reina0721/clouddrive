# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> 收缩侧栏切换兄弟菜单时同一时刻只有一个 Flyout 且旧菜单不残留
- Location: apps\web\e2e\navigation.spec.ts:80:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  22360 pixels (ratio 0.03 of all image pixels) are different.

  Snapshot: surface-shell-compact-sibling-swap.png

Call log:
  - Expect "soft toHaveScreenshot(surface-shell-compact-sibling-swap.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 22360 pixels (ratio 0.03 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 22360 pixels (ratio 0.03 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
    - alert [ref=e11]
    - link "跳到主要内容 / Skip to content" [ref=e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=e13]:
        - complementary [ref=e14]:
            - generic [ref=e15]: C
            - navigation "主导航" [ref=e18]:
                - list "工作空间" [ref=e20]:
                    - listitem [ref=e21]:
                        - link "工作台" [ref=e22] [cursor=pointer]:
                            - /url: /
                - list "身份与访问" [ref=e30]:
                    - listitem [ref=e31]:
                        - link "用户管理" [ref=e32] [cursor=pointer]:
                            - /url: /users
                    - listitem [ref=e38]:
                        - link "角色管理" [ref=e39] [cursor=pointer]:
                            - /url: /roles
                    - listitem [ref=e45]:
                        - link "审计日志" [ref=e46] [cursor=pointer]:
                            - /url: /audit-logs
                    - listitem [ref=e51]:
                        - link "系统配置" [ref=e52] [cursor=pointer]:
                            - /url: /system-settings
                - list "个人" [ref=e58]:
                    - listitem [ref=e59]:
                        - link "个人账户" [ref=e60] [cursor=pointer]:
                            - /url: /account
                    - listitem [ref=e66]:
                        - link "通知中心" [ref=e67] [cursor=pointer]:
                            - /url: /notifications
                    - listitem [ref=e71]:
                        - link "个人偏好" [ref=e72] [cursor=pointer]:
                            - /url: /settings
                - list "开发中心" [ref=e78]:
                    - listitem [ref=e79]:
                        - button "UI Elements" [ref=e80] [cursor=pointer]
                    - listitem [ref=e89]:
                        - button "Page Patterns" [ref=e90] [cursor=pointer]
                    - listitem [ref=e99]:
                        - button "Page Archetypes" [active] [ref=e100] [cursor=pointer]
                    - listitem [ref=e106]:
                        - link "参考资源" [ref=e107] [cursor=pointer]:
                            - /url: /reference-resources
                    - listitem [ref=e111]:
                        - link "Icon 大全" [ref=e112] [cursor=pointer]:
                            - /url: /system-tools/icons
                    - listitem [ref=e118]:
                        - link "基座能力" [ref=e119] [cursor=pointer]:
                            - /url: /foundations
                    - listitem [ref=e131]:
                        - link "Motion" [ref=e132] [cursor=pointer]:
                            - /url: /motion
                    - listitem [ref=e140]:
                        - link "状态体系" [ref=e141] [cursor=pointer]:
                            - /url: /states
        - generic [ref=e147]:
            - banner [ref=e149]:
                - button "展开侧栏" [ref=e151] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=e153] [cursor=pointer]
                - generic [ref=e154]:
                    - generic [ref=e155]:
                        - button "切换语言" [ref=e156] [cursor=pointer]
                        - button "切换主题" [ref=e157] [cursor=pointer]
                    - button "通知" [ref=e158]
                    - button "当前用户" [ref=e162] [cursor=pointer]:
                        - generic [ref=e164]:
                            - generic "Rin" [ref=e167]: RI
                            - generic [ref=e168]: Rin
            - main [ref=e172]:
                - generic [ref=e174]:
                    - generic [ref=e176]:
                        - generic [ref=e177]:
                            - paragraph [ref=e178]: clouddrive
                            - heading "工作台" [level=1] [ref=e179]
                            - paragraph [ref=e180]: Rin，从常用页面继续工作，查看未完成草稿与最近应用事件。
                        - link "个人偏好" [ref=e182] [cursor=pointer]:
                            - /url: /settings
                    - generic [ref=e184]:
                        - generic [ref=e186]:
                            - generic [ref=e188]:
                                - heading "收藏" [level=2] [ref=e189]
                                - paragraph [ref=e190]: 常用页面与资源的快捷入口。
                            - paragraph [ref=e192]: 还没有收藏。可在支持收藏的详情页添加常用入口。
                        - generic [ref=e194]:
                            - generic [ref=e196]:
                                - heading "最近访问" [level=2] [ref=e197]
                                - paragraph [ref=e198]: 当前账户在此浏览器的最近页面。
                            - paragraph [ref=e200]: 访问页面后，最近记录会显示在这里。
                    - generic [ref=e202]:
                        - generic [ref=e203]:
                            - generic [ref=e204]:
                                - heading "最近应用事件" [level=2] [ref=e205]
                                - paragraph [ref=e206]: 来自当前账户的实际操作反馈，保留在此浏览器。
                            - button "打开通知中心" [ref=e207] [cursor=pointer]
                        - generic [ref=e209]:
                            - paragraph [ref=e211]: 0 条未读
                            - paragraph [ref=e212]: 暂无应用事件。完成操作后，反馈会显示在这里。
                    - generic [ref=e214]:
                        - generic [ref=e216]:
                            - heading "工作偏好" [level=2] [ref=e217]
                            - paragraph [ref=e218]: 调整当前账户在此浏览器的工作体验。
                        - list [ref=e220]:
                            - listitem [ref=e221]:
                                - link "外观" [ref=e222] [cursor=pointer]:
                                    - /url: /settings
                                - paragraph [ref=e224]: 主题、密度与阅读宽度。
                            - listitem [ref=e225]:
                                - link "导航与工作恢复" [ref=e226] [cursor=pointer]:
                                    - /url: /settings/navigation
                                - paragraph [ref=e228]: 页签、最近记录与草稿恢复。
                            - listitem [ref=e229]:
                                - link "语言与地区" [ref=e230] [cursor=pointer]:
                                    - /url: /settings/locale
                                - paragraph [ref=e232]: 界面语言、日期与时间格式。
                            - listitem [ref=e233]:
                                - link "操作与草稿" [ref=e234] [cursor=pointer]:
                                    - /url: /settings/actions
                                - paragraph [ref=e236]: 保存去向、离开确认与自动草稿。
                    - generic [ref=e237]:
                        - generic [ref=e239]:
                            - heading "开发中心" [level=2] [ref=e240]
                            - paragraph [ref=e241]: 组件规范、示例流程与工具，用于开发和验证。
                        - generic [ref=e243]:
                            - link "组件规范" [ref=e244] [cursor=pointer]:
                                - /url: /ui-elements
                            - link "参考资源示例" [ref=e246] [cursor=pointer]:
                                - /url: /reference-resources
                            - link "图标工具" [ref=e248] [cursor=pointer]:
                                - /url: /system-tools/icons
```

# Test source

```ts
  10  |     name: '展开或收起Page Archetypes',
  11  |   });
  12  |   const uiElementsToggle = navigation.getByRole('button', {
  13  |     name: '展开或收起UI Elements',
  14  |   });
  15  |
  16  |   // Page Archetypes 是当前 active 链（深层页 /page-archetypes/create-edit）：锚定展开
  17  |   await expect(referenceToggle).toHaveAttribute('aria-expanded', 'true');
  18  |   await expect(navigation.getByRole('link', { name: '创建与编辑' })).toBeVisible();
  19  |   await expect(navigation).toHaveScreenshot('surface-shell-parent-navigation.png');
  20  |   const accessibilityScan = await new AxeBuilder({ page }).include('nav').analyze();
  21  |   expect(accessibilityScan.violations).toEqual([]);
  22  |   const currentUrl = page.url();
  23  |
  24  |   // active ancestor 不允许被普通点击收起（不隐藏当前 Route）
  25  |   await referenceToggle.click();
  26  |   await expect(referenceToggle).toHaveAttribute('aria-expanded', 'true');
  27  |   await expect(navigation.getByRole('link', { name: '创建与编辑' })).toBeVisible();
  28  |   await expect(page).toHaveURL(currentUrl);
  29  |
  30  |   // 展开另一顶层（同 root scope 的非 active）：Page Archetypes（active）保持，
  31  |   // UI Elements 成为 exploration 展开
  32  |   await expect(uiElementsToggle).toHaveAttribute('aria-expanded', 'false');
  33  |   await uiElementsToggle.click();
  34  |   await expect(uiElementsToggle).toHaveAttribute('aria-expanded', 'true');
  35  |   await expect(referenceToggle).toHaveAttribute('aria-expanded', 'true');
  36  |   await expect(navigation.getByRole('link', { name: '浮层与弹出界面' })).toBeVisible();
  37  |   await expect(page).toHaveURL(currentUrl);
  38  |
  39  |   // 再次点击非 active exploration：收起
  40  |   await uiElementsToggle.click();
  41  |   await expect(uiElementsToggle).toHaveAttribute('aria-expanded', 'false');
  42  |   await expect(referenceToggle).toHaveAttribute('aria-expanded', 'true');
  43  |   await expect(page).toHaveURL(currentUrl);
  44  | });
  45  |
  46  | test('收缩侧栏的 Hover Flyout 保持稳定并支持键盘进入', async ({ page }) => {
  47  |   await page.goto('/');
  48  |   await page.getByRole('button', { name: '收起侧栏' }).click();
  49  |   const expandSidebar = page.getByRole('button', { name: '展开侧栏' });
  50  |   await expect(expandSidebar).toBeFocused();
  51  |   const navigation = page.getByRole('navigation', { name: '主导航' });
  52  |   const trigger = navigation.getByRole('button', { name: 'UI Elements' });
  53  |   await trigger.hover();
  54  |
  55  |   const flyout = page.getByRole('dialog', { name: 'UI Elements' });
  56  |   await expect(flyout).toBeVisible();
  57  |   await page.waitForTimeout(500);
  58  |   await expect(flyout).toHaveCount(1);
  59  |   await expect(flyout).toBeVisible();
  60  |   await expect(expandSidebar).toBeFocused();
  61  |   await expect.soft(page).toHaveScreenshot('surface-shell-compact-flyout.png');
  62  |
  63  |   await flyout.hover();
  64  |   await page.waitForTimeout(300);
  65  |   await expect(flyout).toBeVisible();
  66  |
  67  |   await flyout.getByRole('link', { name: '浮层与弹出界面' }).click();
  68  |   await expect(page).toHaveURL(/\/ui-elements\/overlays$/);
  69  |   await expect(flyout).toBeHidden();
  70  |
  71  |   await page.mouse.move(600, 240);
  72  |   await trigger.focus();
  73  |   await page.keyboard.press('Enter');
  74  |   await expect(flyout).toBeVisible();
  75  |   await page.keyboard.press('Escape');
  76  |   await expect(flyout).toBeHidden();
  77  |   await expect(trigger).toBeFocused();
  78  | });
  79  |
  80  | test('收缩侧栏切换兄弟菜单时同一时刻只有一个 Flyout 且旧菜单不残留', async ({ page }) => {
  81  |   await page.goto('/');
  82  |   await page.getByRole('button', { name: '收起侧栏' }).click();
  83  |   const navigation = page.getByRole('navigation', { name: '主导航' });
  84  |
  85  |   const uiElementsTrigger = navigation.getByRole('button', { name: 'UI Elements' });
  86  |   const pagePatternsTrigger = navigation.getByRole('button', { name: 'Page Patterns' });
  87  |   const pageArchetypesTrigger = navigation.getByRole('button', { name: 'Page Archetypes' });
  88  |
  89  |   const dialogs = page.getByRole('dialog');
  90  |   await expect(dialogs).toHaveCount(0);
  91  |
  92  |   // 依次 Hover 三个兄弟父级：每一步都只能有一个可见 Dialog
  93  |   await uiElementsTrigger.hover();
  94  |   await expect(dialogs).toHaveCount(1);
  95  |   await expect(dialogs.first()).toHaveAttribute('aria-label', 'UI Elements');
  96  |
  97  |   await pagePatternsTrigger.hover();
  98  |   await expect(dialogs).toHaveCount(1);
  99  |   await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Patterns');
  100 |   await page.waitForTimeout(400);
  101 |   await expect(dialogs).toHaveCount(1);
  102 |   await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Patterns');
  103 |
  104 |   await pageArchetypesTrigger.hover();
  105 |   await expect(dialogs).toHaveCount(1);
  106 |   await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Archetypes');
  107 |   await page.waitForTimeout(400);
  108 |   await expect(dialogs).toHaveCount(1);
  109 |   await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Archetypes');
> 110 |   await expect.soft(page).toHaveScreenshot('surface-shell-compact-sibling-swap.png');
      |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
  111 |
  112 |   // 快速来回切换：旧 Flyout 的延迟关闭计时器不能误关新菜单
  113 |   await uiElementsTrigger.hover();
  114 |   await expect(dialogs).toHaveCount(1);
  115 |   await expect(dialogs.first()).toHaveAttribute('aria-label', 'UI Elements');
  116 |   await pageArchetypesTrigger.hover();
  117 |   await page.waitForTimeout(400);
  118 |   await expect(dialogs).toHaveCount(1);
  119 |   await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Archetypes');
  120 |
  121 |   // 键盘仍可打开当前父级，Escape 关闭并恢复焦点
  122 |   await page.mouse.move(600, 240);
  123 |   await pageArchetypesTrigger.focus();
  124 |   await page.keyboard.press('Enter');
  125 |   await expect(dialogs).toHaveCount(1);
  126 |   await expect(dialogs.first()).toHaveAttribute('aria-label', 'Page Archetypes');
  127 |   await page.keyboard.press('Escape');
  128 |   await expect(dialogs).toHaveCount(0);
  129 |   await expect(pageArchetypesTrigger).toBeFocused();
  130 | });
  131 |
  132 | test('移动侧栏使用同一树并在选择叶子后关闭', async ({ page }) => {
  133 |   await page.setViewportSize({ width: 390, height: 844 });
  134 |   await page.goto('/');
  135 |   await page.getByRole('button', { name: '打开导航' }).click();
  136 |   const navigation = page.getByRole('navigation', { name: '主导航' });
  137 |   const uiElementsToggle = navigation.getByRole('button', {
  138 |     name: '展开或收起UI Elements',
  139 |   });
  140 |   await uiElementsToggle.click();
  141 |   await navigation.getByRole('link', { name: '反馈', exact: true }).click();
  142 |
  143 |   await expect(page).toHaveURL(/\/ui-elements\/feedback$/);
  144 |   await expect(navigation).toBeHidden();
  145 | });
  146 |
  147 | test('Shell NavigationViewport 隐藏原生 scrollbar 且保留滚动能力', async ({ page }) => {
  148 |   // 低高度桌面视口：导航内容必然超出可用高度，触发纵向滚动
  149 |   await page.setViewportSize({ width: 1440, height: 600 });
  150 |   await page.goto('/');
  151 |   const navigation = page.getByRole('navigation', { name: '主导航' });
  152 |
  153 |   // 1. 滚动能力保留：overflow-y 是 auto，而不是 hidden
  154 |   await expect(navigation).toHaveCSS('overflow-y', 'auto');
  155 |
  156 |   // 2. scrollbar 语义隐藏（Firefox scrollbar-width / Chromium 同样识别该属性）
  157 |   await expect(navigation).toHaveCSS('scrollbar-width', 'none');
  158 |
  159 |   // 3. Chromium/WebKit 伪元素轨道宽度为 0（不可见）
  160 |   const webkitScrollbarWidth = await navigation.evaluate((element) => {
  161 |     const style = getComputedStyle(element, '::-webkit-scrollbar');
  162 |     return style.width;
  163 |   });
  164 |   expect(webkitScrollbarWidth).toBe('0px');
  165 |
  166 |   // 4. 内容超出视口时确实可滚动（scrollHeight > clientHeight，且程序化滚动生效）
  167 |   const scrollMetrics = await navigation.evaluate((element) => ({
  168 |     scrollHeight: element.scrollHeight,
  169 |     clientHeight: element.clientHeight,
  170 |   }));
  171 |   expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  172 |   await navigation.evaluate((element) => element.scrollTo({ top: 200, behavior: 'instant' }));
  173 |   const scrolledTop = await navigation.evaluate((element) => element.scrollTop);
  174 |   expect(scrolledTop).toBeGreaterThan(0);
  175 |
  176 |   // 5. 顶部 Brand 稳定区不参与导航滚动：滚到顶部时 Brand 区仍在原位
  177 |   await navigation.evaluate((element) => element.scrollTo({ top: 0, behavior: 'instant' }));
  178 |   const brandBefore = await page
  179 |     .locator('aside > div:first-child')
  180 |     .first()
  181 |     .evaluate((element) => element.getBoundingClientRect().top);
  182 |   await navigation.evaluate((element) => element.scrollTo({ top: 200, behavior: 'instant' }));
  183 |   const brandAfter = await page
  184 |     .locator('aside > div:first-child')
  185 |     .first()
  186 |     .evaluate((element) => element.getBoundingClientRect().top);
  187 |   expect(Math.abs(brandAfter - brandBefore)).toBeLessThanOrEqual(1);
  188 |
  189 |   // 6. 产品 Header 独立于导航滚动；工程 Preview 已从正式 Shell 移除。
  190 |   const headerBefore = await page
  191 |     .getByRole('banner')
  192 |     .evaluate((element) => element.getBoundingClientRect().top);
  193 |   await navigation.evaluate((element) => element.scrollTo({ top: 300, behavior: 'instant' }));
  194 |   const headerAfter = await page
  195 |     .getByRole('banner')
  196 |     .evaluate((element) => element.getBoundingClientRect().top);
  197 |   expect(Math.abs(headerAfter - headerBefore)).toBeLessThanOrEqual(1);
  198 |
  199 |   // 7. 展开一个顶层菜单后可滚动访问最后一个菜单项
  200 |   //    （root scope Accordion：展开 Page Archetypes 后即为当前唯一 exploration/active 顶层）
  201 |   await navigation.getByRole('button', { name: '展开或收起Page Archetypes' }).click();
  202 |   const lastItem = navigation.getByRole('link', { name: '操作任务' });
  203 |   await lastItem.scrollIntoViewIfNeeded();
  204 |   await expect(lastItem).toBeInViewport();
  205 |
  206 |   // 8. 主内容区 scrollbar 不受影响（保持浏览器默认，未被设为 none）
  207 |   const mainScrollbarWidth = await page
  208 |     .locator('main')
  209 |     .evaluate((element) => getComputedStyle(element).scrollbarWidth);
  210 |   expect(mainScrollbarWidth).not.toBe('none');
```
