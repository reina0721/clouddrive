# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Shell NavigationViewport 隐藏原生 scrollbar 且保留滚动能力
- Location: apps\web\e2e\navigation.spec.ts:147:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.evaluate: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByText('React 19 · HeroUI · Tailwind CSS v4')

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
                            - paragraph [ref=e154]: clouddrive
                            - heading "工作台" [level=1] [ref=e155]
                            - paragraph [ref=e156]: Rin，从常用页面继续工作，查看未完成草稿与最近应用事件。
                        - link "个人偏好" [ref=e158] [cursor=pointer]:
                            - /url: /settings
                    - generic [ref=e160]:
                        - generic [ref=e162]:
                            - generic [ref=e164]:
                                - heading "收藏" [level=2] [ref=e165]
                                - paragraph [ref=e166]: 常用页面与资源的快捷入口。
                            - paragraph [ref=e168]: 还没有收藏。可在支持收藏的详情页添加常用入口。
                        - generic [ref=e170]:
                            - generic [ref=e172]:
                                - heading "最近访问" [level=2] [ref=e173]
                                - paragraph [ref=e174]: 当前账户在此浏览器的最近页面。
                            - paragraph [ref=e176]: 访问页面后，最近记录会显示在这里。
                    - generic [ref=e178]:
                        - generic [ref=e179]:
                            - generic [ref=e180]:
                                - heading "最近应用事件" [level=2] [ref=e181]
                                - paragraph [ref=e182]: 来自当前账户的实际操作反馈，保留在此浏览器。
                            - button "打开通知中心" [ref=e183] [cursor=pointer]
                        - generic [ref=e185]:
                            - paragraph [ref=e187]: 0 条未读
                            - paragraph [ref=e188]: 暂无应用事件。完成操作后，反馈会显示在这里。
                    - generic [ref=e190]:
                        - generic [ref=e192]:
                            - heading "工作偏好" [level=2] [ref=e193]
                            - paragraph [ref=e194]: 调整当前账户在此浏览器的工作体验。
                        - list [ref=e196]:
                            - listitem [ref=e197]:
                                - link "外观" [ref=e198] [cursor=pointer]:
                                    - /url: /settings
                                - paragraph [ref=e200]: 主题、密度与阅读宽度。
                            - listitem [ref=e201]:
                                - link "导航与工作恢复" [ref=e202] [cursor=pointer]:
                                    - /url: /settings/navigation
                                - paragraph [ref=e204]: 页签、最近记录与草稿恢复。
                            - listitem [ref=e205]:
                                - link "语言与地区" [ref=e206] [cursor=pointer]:
                                    - /url: /settings/locale
                                - paragraph [ref=e208]: 界面语言、日期与时间格式。
                            - listitem [ref=e209]:
                                - link "操作与草稿" [ref=e210] [cursor=pointer]:
                                    - /url: /settings/actions
                                - paragraph [ref=e212]: 保存去向、离开确认与自动草稿。
                    - generic [ref=e213]:
                        - generic [ref=e215]:
                            - heading "开发中心" [level=2] [ref=e216]
                            - paragraph [ref=e217]: 组件规范、示例流程与工具，用于开发和验证。
                        - generic [ref=e219]:
                            - link "组件规范" [ref=e220] [cursor=pointer]:
                                - /url: /ui-elements
                            - link "参考资源示例" [ref=e222] [cursor=pointer]:
                                - /url: /reference-resources
                            - link "图标工具" [ref=e224] [cursor=pointer]:
                                - /url: /system-tools/icons
```

# Test source

```ts
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
  110 |   await expect.soft(page).toHaveScreenshot('surface-shell-compact-sibling-swap.png');
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
  189 |   // 6. 底部 Preview 辅助区独立：滚动后位置不变（不随 NavigationContent 滚动）
  190 |   const previewBefore = await page
  191 |     .getByText('React 19 · HeroUI · Tailwind CSS v4')
> 192 |     .evaluate((element) => element.getBoundingClientRect().top);
      |      ^ Error: locator.evaluate: Test timeout of 30000ms exceeded.
  193 |   await navigation.evaluate((element) => element.scrollTo({ top: 300, behavior: 'instant' }));
  194 |   const previewAfter = await page
  195 |     .getByText('React 19 · HeroUI · Tailwind CSS v4')
  196 |     .evaluate((element) => element.getBoundingClientRect().top);
  197 |   expect(Math.abs(previewAfter - previewBefore)).toBeLessThanOrEqual(1);
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
  211 |
  212 |   // 9. Sidebar 宽度不因 scrollbar 隐藏变化（grid 列宽仍为 16.5rem 语义）
  213 |   const sidebarWidth = await page
  214 |     .locator('aside')
  215 |     .first()
  216 |     .evaluate((element) => element.getBoundingClientRect().width);
  217 |   expect(sidebarWidth).toBe(264); // 16.5rem
  218 |
  219 |   // 10. 移动端导航 drawer 同样隐藏 scrollbar 且可滚动
  220 |   await page.setViewportSize({ width: 390, height: 844 });
  221 |   await page.goto('/');
  222 |   await page.getByRole('button', { name: '打开导航' }).click();
  223 |   const mobileNavigation = page.getByRole('navigation', { name: '主导航' });
  224 |   await expect(mobileNavigation).toHaveCSS('overflow-y', 'auto');
  225 |   await expect(mobileNavigation).toHaveCSS('scrollbar-width', 'none');
  226 | });
  227 |
  228 | test('UI Elements 根路径进入默认子级且旧 Showcase 不再匹配', async ({ page }) => {
  229 |   await page.goto('/ui-elements');
  230 |   await expect(page).toHaveURL(/\/ui-elements\/actions-selection$/);
  231 |
  232 |   const response = await page.goto('/showcase');
  233 |   expect(response?.status()).toBe(404);
  234 |   await expect(page.getByRole('heading', { name: '页面不存在', exact: true })).toBeVisible();
  235 |   await expect(page.getByRole('button', { name: '进入工作台', exact: true })).toBeVisible();
  236 |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  237 | });
  238 |
```
