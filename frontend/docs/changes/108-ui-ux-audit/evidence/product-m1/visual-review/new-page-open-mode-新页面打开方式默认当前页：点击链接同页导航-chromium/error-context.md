# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: new-page-open-mode.spec.ts >> 新页面打开方式默认当前页：点击链接同页导航
- Location: apps\web\e2e\new-page-open-mode.spec.ts:11:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: '查看基座地图' })

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
                    - generic [ref=f2e152]:
                        - generic [ref=f2e153]:
                            - paragraph [ref=f2e154]: clouddrive
                            - heading "工作台" [level=1] [ref=f2e155]
                            - paragraph [ref=f2e156]: Rin，从常用页面继续工作，查看未完成草稿与最近应用事件。
                        - link "个人偏好" [ref=f2e158] [cursor=pointer]:
                            - /url: /settings
                    - generic [ref=f2e160]:
                        - generic [ref=f2e162]:
                            - generic [ref=f2e164]:
                                - heading "收藏" [level=2] [ref=f2e165]
                                - paragraph [ref=f2e166]: 常用页面与资源的快捷入口。
                            - paragraph [ref=f2e168]: 还没有收藏。可在支持收藏的详情页添加常用入口。
                        - generic [ref=f2e170]:
                            - generic [ref=f2e172]:
                                - heading "最近访问" [level=2] [ref=f2e173]
                                - paragraph [ref=f2e174]: 当前账户在此浏览器的最近页面。
                            - paragraph [ref=f2e176]: 访问页面后，最近记录会显示在这里。
                    - generic [ref=f2e178]:
                        - generic [ref=f2e179]:
                            - generic [ref=f2e180]:
                                - heading "最近应用事件" [level=2] [ref=f2e181]
                                - paragraph [ref=f2e182]: 来自当前账户的实际操作反馈，保留在此浏览器。
                            - button "打开通知中心" [ref=f2e183] [cursor=pointer]
                        - generic [ref=f2e185]:
                            - paragraph [ref=f2e187]: 0 条未读
                            - paragraph [ref=f2e188]: 暂无应用事件。完成操作后，反馈会显示在这里。
                    - generic [ref=f2e190]:
                        - generic [ref=f2e192]:
                            - heading "工作偏好" [level=2] [ref=f2e193]
                            - paragraph [ref=f2e194]: 调整当前账户在此浏览器的工作体验。
                        - list [ref=f2e196]:
                            - listitem [ref=f2e197]:
                                - link "外观" [ref=f2e198] [cursor=pointer]:
                                    - /url: /settings
                                - paragraph [ref=f2e200]: 主题、密度与阅读宽度。
                            - listitem [ref=f2e201]:
                                - link "导航与工作恢复" [ref=f2e202] [cursor=pointer]:
                                    - /url: /settings/navigation
                                - paragraph [ref=f2e204]: 页签、最近记录与草稿恢复。
                            - listitem [ref=f2e205]:
                                - link "语言与地区" [ref=f2e206] [cursor=pointer]:
                                    - /url: /settings/locale
                                - paragraph [ref=f2e208]: 界面语言、日期与时间格式。
                            - listitem [ref=f2e209]:
                                - link "操作与草稿" [ref=f2e210] [cursor=pointer]:
                                    - /url: /settings/actions
                                - paragraph [ref=f2e212]: 保存去向、离开确认与自动草稿。
                    - generic [ref=f2e213]:
                        - generic [ref=f2e215]:
                            - heading "开发中心" [level=2] [ref=f2e216]
                            - paragraph [ref=f2e217]: 组件规范、示例流程与工具，用于开发和验证。
                        - generic [ref=f2e219]:
                            - link "组件规范" [ref=f2e220] [cursor=pointer]:
                                - /url: /ui-elements
                            - link "参考资源示例" [ref=f2e222] [cursor=pointer]:
                                - /url: /reference-resources
                            - link "图标工具" [ref=f2e224] [cursor=pointer]:
                                - /url: /system-tools/icons
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | import { expect, test } from '@playwright/test';
  3  |
  4  | async function resetPreferences(page: Page) {
  5  |   await page.goto('/settings/navigation');
  6  |   await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  7  |   await page.reload();
  8  |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  9  | }
  10 |
  11 | test('新页面打开方式默认当前页：点击链接同页导航', async ({ page }) => {
  12 |   await resetPreferences(page);
  13 |   await page.goto('/');
  14 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
> 15 |   await page.getByRole('link', { name: '图标工具' }).click();
     |                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  16 |   await expect(page).toHaveURL(/\/system-tools\/icons/);
  17 | });
  18 |
  19 | test('新页面打开方式=浏览器新标签页：声明允许入口在新标签打开', async ({ page }) => {
  20 |   await resetPreferences(page);
  21 |   // 设置 → 导航 → 新页面打开方式 = 浏览器新标签页。
  22 |   await page.goto('/settings/navigation');
  23 |   await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  24 |   await page
  25 |     .getByRole('radiogroup', { name: '新页面打开方式' })
  26 |     .getByText('浏览器新标签页', { exact: true })
  27 |     .click();
  28 |   await page.waitForTimeout(300);
  29 |
  30 |   await page.goto('/');
  31 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  32 |   const popupPromise = page.waitForEvent('popup');
  33 |   await page.getByRole('link', { name: '图标工具' }).click();
  34 |   const popup = await popupPromise;
  35 |   await popup.waitForLoadState();
  36 |   expect(popup.url()).toContain('/system-tools/icons');
  37 |   // 当前页仍在首页（未被导航离开）。
  38 |   await expect(page).toHaveURL(/\/$/);
  39 | });
  40 |
```
