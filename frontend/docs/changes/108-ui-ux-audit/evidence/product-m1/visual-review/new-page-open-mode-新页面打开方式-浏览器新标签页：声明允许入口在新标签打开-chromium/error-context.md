# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: new-page-open-mode.spec.ts >> 新页面打开方式=浏览器新标签页：声明允许入口在新标签打开
- Location: apps\web\e2e\new-page-open-mode.spec.ts:19:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForEvent: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for event "popup"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
    - button "Open Next.js Dev Tools" [ref=f3e7] [cursor=pointer]
    - alert [ref=f3e11]
    - link "跳到主要内容 / Skip to content" [ref=f3e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=f3e13]:
        - complementary [ref=f3e14]:
            - generic [ref=f3e15]:
                - generic [ref=f3e16]: C
                - generic [ref=f3e18]:
                    - paragraph [ref=f3e19]: clouddrive
                    - paragraph [ref=f3e20]: 管理工作空间
            - navigation "主导航" [ref=f3e21]:
                - generic [ref=f3e22]:
                    - paragraph [ref=f3e23]: 工作空间
                    - list "工作空间" [ref=f3e24]:
                        - listitem [ref=f3e25]:
                            - link "工作台" [ref=f3e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f3e34]:
                    - paragraph [ref=f3e35]: 个人
                    - list "个人" [ref=f3e36]:
                        - listitem [ref=f3e37]:
                            - link "个人偏好" [ref=f3e38] [cursor=pointer]:
                                - /url: /settings
                - generic [ref=f3e44]:
                    - paragraph [ref=f3e45]: 开发中心
                    - list "开发中心" [ref=f3e46]:
                        - listitem [ref=f3e47]:
                            - button "展开或收起UI Elements" [ref=f3e48]:
                                - generic [ref=f3e55]: UI Elements
                        - listitem [ref=f3e58]:
                            - button "展开或收起Page Patterns" [ref=f3e59]:
                                - generic [ref=f3e66]: Page Patterns
                        - listitem [ref=f3e69]:
                            - button "展开或收起Page Archetypes" [ref=f3e70]:
                                - generic [ref=f3e74]: Page Archetypes
                        - listitem [ref=f3e77]:
                            - link "参考资源" [ref=f3e78] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=f3e83]:
                            - link "Icon 大全" [ref=f3e84] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=f3e91]:
                            - link "基座能力" [ref=f3e92] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f3e105]:
                            - link "Motion" [ref=f3e106] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f3e115]:
                            - link "状态体系" [ref=f3e116] [cursor=pointer]:
                                - /url: /states
        - generic [ref=f3e123]:
            - banner [ref=f3e125]:
                - button "收起侧栏" [ref=f3e127] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f3e129] [cursor=pointer]
                - generic [ref=f3e130]:
                    - generic [ref=f3e131]:
                        - button "切换语言" [ref=f3e132] [cursor=pointer]
                        - button "切换主题" [ref=f3e133] [cursor=pointer]
                    - button "通知" [ref=f3e134]
                    - button "当前用户" [ref=f3e138] [cursor=pointer]:
                        - generic [ref=f3e140]:
                            - generic "Rin" [ref=f3e143]: RI
                            - generic [ref=f3e144]: Rin
            - main [ref=f3e148]:
                - generic [ref=f3e150]:
                    - generic [ref=f3e152]:
                        - generic [ref=f3e153]:
                            - paragraph [ref=f3e154]: clouddrive
                            - heading "工作台" [level=1] [ref=f3e155]
                            - paragraph [ref=f3e156]: Rin，从常用页面继续工作，查看未完成草稿与最近应用事件。
                        - link "个人偏好" [ref=f3e158] [cursor=pointer]:
                            - /url: /settings
                    - generic [ref=f3e160]:
                        - generic [ref=f3e162]:
                            - generic [ref=f3e164]:
                                - heading "收藏" [level=2] [ref=f3e165]
                                - paragraph [ref=f3e166]: 常用页面与资源的快捷入口。
                            - paragraph [ref=f3e168]: 还没有收藏。可在支持收藏的详情页添加常用入口。
                        - generic [ref=f3e170]:
                            - generic [ref=f3e172]:
                                - heading "最近访问" [level=2] [ref=f3e173]
                                - paragraph [ref=f3e174]: 当前账户在此浏览器的最近页面。
                            - list [ref=f3e176]:
                                - listitem [ref=f3e177]:
                                    - link "导航" [ref=f3e178] [cursor=pointer]:
                                        - /url: /settings/navigation
                                    - time [ref=f3e180]: 2026/10/12 · 05:52
                    - generic [ref=f3e182]:
                        - generic [ref=f3e183]:
                            - generic [ref=f3e184]:
                                - heading "最近应用事件" [level=2] [ref=f3e185]
                                - paragraph [ref=f3e186]: 来自当前账户的实际操作反馈，保留在此浏览器。
                            - button "打开通知中心" [ref=f3e187] [cursor=pointer]
                        - generic [ref=f3e189]:
                            - paragraph [ref=f3e191]: 0 条未读
                            - paragraph [ref=f3e192]: 暂无应用事件。完成操作后，反馈会显示在这里。
                    - generic [ref=f3e194]:
                        - generic [ref=f3e196]:
                            - heading "工作偏好" [level=2] [ref=f3e197]
                            - paragraph [ref=f3e198]: 调整当前账户在此浏览器的工作体验。
                        - list [ref=f3e200]:
                            - listitem [ref=f3e201]:
                                - link "外观" [ref=f3e202] [cursor=pointer]:
                                    - /url: /settings
                                - paragraph [ref=f3e204]: 主题、密度与阅读宽度。
                            - listitem [ref=f3e205]:
                                - link "导航与工作恢复" [ref=f3e206] [cursor=pointer]:
                                    - /url: /settings/navigation
                                - paragraph [ref=f3e208]: 页签、最近记录与草稿恢复。
                            - listitem [ref=f3e209]:
                                - link "语言与地区" [ref=f3e210] [cursor=pointer]:
                                    - /url: /settings/locale
                                - paragraph [ref=f3e212]: 界面语言、日期与时间格式。
                            - listitem [ref=f3e213]:
                                - link "操作与草稿" [ref=f3e214] [cursor=pointer]:
                                    - /url: /settings/actions
                                - paragraph [ref=f3e216]: 保存去向、离开确认与自动草稿。
                    - generic [ref=f3e217]:
                        - generic [ref=f3e219]:
                            - heading "开发中心" [level=2] [ref=f3e220]
                            - paragraph [ref=f3e221]: 组件规范、示例流程与工具，用于开发和验证。
                        - generic [ref=f3e223]:
                            - link "组件规范" [ref=f3e224] [cursor=pointer]:
                                - /url: /ui-elements
                            - link "参考资源示例" [ref=f3e226] [cursor=pointer]:
                                - /url: /reference-resources
                            - link "图标工具" [ref=f3e228] [cursor=pointer]:
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
  15 |   await page.getByRole('link', { name: '图标工具' }).click();
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
> 32 |   const popupPromise = page.waitForEvent('popup');
     |                             ^ Error: page.waitForEvent: Test timeout of 30000ms exceeded.
  33 |   await page.getByRole('link', { name: '图标工具' }).click();
  34 |   const popup = await popupPromise;
  35 |   await popup.waitForLoadState();
  36 |   expect(popup.url()).toContain('/system-tools/icons');
  37 |   // 当前页仍在首页（未被导航离开）。
  38 |   await expect(page).toHaveURL(/\/$/);
  39 | });
  40 |
```
