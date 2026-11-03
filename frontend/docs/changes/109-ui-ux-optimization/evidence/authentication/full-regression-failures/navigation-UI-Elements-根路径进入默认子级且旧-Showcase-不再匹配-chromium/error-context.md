# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> UI Elements 根路径进入默认子级且旧 Showcase 不再匹配
- Location: apps\web\e2e\navigation.spec.ts:228:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('404 Not Found')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('404 Not Found')

```

```yaml
- alert
- link "跳到主要内容 / Skip to content":
    - /url: '#main-content'
- main:
    - link "C Community":
        - /url: /welcome
    - button "切换语言"
    - button "切换主题"
    - region "清晰的界面，专注的工作。":
        - paragraph: clouddrive
        - heading "清晰的界面，专注的工作。" [level=2]
        - paragraph: 回到熟悉的工作台，让日常任务、个人偏好和操作反馈井然有序。
        - list:
            - listitem: 统一的工作台与导航
            - listitem: 持续保存的界面偏好
            - listitem: 清晰、及时的状态反馈
    - heading "页面不存在" [level=3]
    - paragraph: 当前地址没有对应页面，请返回工作台选择有效入口。
    - button "进入工作台"
    - complementary:
        - paragraph: 开发演示模式
        - paragraph: 这是本地模拟认证，可注册演示账户。请勿使用真实密码。
        - paragraph: 演示邮箱：demo@community.test
        - paragraph: 演示密码：CommunityDemo2026!
```

# Test source

```ts
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
  192 |     .evaluate((element) => element.getBoundingClientRect().top);
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
  232 |   await page.goto('/showcase');
> 233 |   await expect(page.getByText('404 Not Found')).toBeVisible();
      |                                                 ^ Error: expect(locator).toBeVisible() failed
  234 | });
  235 |
```
