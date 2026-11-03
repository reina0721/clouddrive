# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scroll-to-top.spec.ts >> 关闭 跳转后自动滚顶：长页滚下后导航保持滚动位置
- Location: apps\web\e2e\scroll-to-top.spec.ts:32:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 100
Received:   0
```

# Page snapshot

```yaml
- generic [ref=f3e1]:
    - button "Open Next.js Dev Tools" [ref=f3e7] [cursor=pointer]
    - alert [ref=f3e11]: 外观
    - link "跳到主要内容 / Skip to content" [ref=f3e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=f3e13]:
        - complementary [ref=f3e14]:
            - generic [ref=f3e15]:
                - generic [ref=f3e16]: C
                - generic [ref=f3e18]:
                    - paragraph [ref=f3e19]: Community
                    - paragraph [ref=f3e20]: 统一前端基座
            - navigation "主导航" [ref=f3e21]:
                - generic [ref=f3e22]:
                    - paragraph [ref=f3e23]: Universal Foundation
                    - list [ref=f3e24]:
                        - listitem [ref=f3e25]:
                            - link "总览" [ref=f3e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f3e33]:
                    - paragraph [ref=f3e34]: 系统
                    - list [ref=f3e35]:
                        - listitem [ref=f3e36]:
                            - link "设置" [active] [ref=f3e37] [cursor=pointer]:
                                - /url: /settings
                        - listitem [ref=f3e42]:
                            - link "Icon 大全" [ref=f3e43] [cursor=pointer]:
                                - /url: /system-tools/icons
                - generic [ref=f3e48]:
                    - paragraph [ref=f3e49]: 参考资源
                    - list [ref=f3e50]:
                        - listitem [ref=f3e51]:
                            - link "参考资源" [ref=f3e52] [cursor=pointer]:
                                - /url: /reference-resources
                - generic [ref=f3e56]:
                    - paragraph [ref=f3e57]: 开发
                    - list [ref=f3e58]:
                        - listitem [ref=f3e59]:
                            - link "基座能力" [ref=f3e60] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f3e72]:
                            - link "Motion" [ref=f3e73] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f3e77]:
                            - button "展开或收起Page Archetypes" [ref=f3e78]:
                                - generic [ref=f3e81]: Page Archetypes
                        - listitem [ref=f3e84]:
                            - button "展开或收起Page Patterns" [ref=f3e85]:
                                - generic [ref=f3e91]: Page Patterns
                        - listitem [ref=f3e94]:
                            - link "状态体系" [ref=f3e95] [cursor=pointer]:
                                - /url: /states
                        - listitem [ref=f3e101]:
                            - button "展开或收起UI Elements" [ref=f3e102]:
                                - generic [ref=f3e108]: UI Elements
            - generic [ref=f3e111]:
                - generic [ref=f3e112]: Architecture Preview
                - paragraph [ref=f3e117]: React 19 · HeroUI · Tailwind CSS v4
        - generic [ref=f3e118]:
            - banner [ref=f3e120]:
                - button "收起侧栏" [ref=f3e122] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f3e124] [cursor=pointer]
                - generic [ref=f3e125]:
                    - generic [ref=f3e126]:
                        - button "切换语言" [ref=f3e127] [cursor=pointer]
                        - button "切换主题" [ref=f3e128] [cursor=pointer]
                    - button "通知" [ref=f3e129]
                    - button "当前用户" [ref=f3e133] [cursor=pointer]:
                        - generic [ref=f3e135]:
                            - generic "Rin" [ref=f3e138]: RI
                            - generic [ref=f3e139]: Rin
            - main [ref=f3e143]:
                - generic [ref=f3e145]:
                    - generic [ref=f3e148]:
                        - paragraph [ref=f3e149]: 系统
                        - heading "外观" [level=1] [ref=f3e150]
                        - paragraph [ref=f3e151]: 主题、强调色、密度、字号、内容宽度、动效与对比度。 更改立即生效并保存在当前浏览器。
                    - generic [ref=f3e152]:
                        - complementary [ref=f3e153]:
                            - generic [ref=f3e155]:
                                - group [ref=f3e158]:
                                    - searchbox "搜索设置项" [ref=f3e159]
                                    - button "Close"
                                - navigation "设置分类" [ref=f3e160]:
                                    - generic [ref=f3e161]:
                                        - paragraph [ref=f3e162]: 显示与数据
                                        - link "外观" [ref=f3e163] [cursor=pointer]:
                                            - /url: /settings
                                        - link "导航" [ref=f3e171] [cursor=pointer]:
                                            - /url: /settings/navigation
                                        - link "数据展示" [ref=f3e180] [cursor=pointer]:
                                            - /url: /settings/data-display
                                    - generic [ref=f3e184]:
                                        - paragraph [ref=f3e185]: 偏好与反馈
                                        - link "操作偏好" [ref=f3e186] [cursor=pointer]:
                                            - /url: /settings/actions
                                        - link "语言与地区" [ref=f3e194] [cursor=pointer]:
                                            - /url: /settings/locale
                                        - link "通知" [ref=f3e199] [cursor=pointer]:
                                            - /url: /settings/notifications
                                    - generic [ref=f3e203]:
                                        - paragraph [ref=f3e204]: 辅助与输入
                                        - link "可访问性" [ref=f3e205] [cursor=pointer]:
                                            - /url: /settings/accessibility
                                        - link "快捷键" [ref=f3e213] [cursor=pointer]:
                                            - /url: /settings/shortcuts
                        - generic [ref=f3e218]:
                            - generic [ref=f3e220]:
                                - generic [ref=f3e221]:
                                    - heading "主题与色彩" [level=2] [ref=f3e224]
                                    - generic [ref=f3e227]:
                                        - radiogroup "主题模式" [ref=f3e229]:
                                            - generic [ref=f3e236]:
                                                - generic [ref=f3e237]: 主题模式
                                                - generic [ref=f3e238]: 切换浅色、深色或跟随系统，立即预览。
                                            - generic [ref=f3e239]:
                                                - generic [ref=f3e241] [cursor=pointer]:
                                                    - radio "浅色主题" [ref=f3e243]
                                                    - generic [ref=f3e251]: 浅色主题
                                                - generic [ref=f3e254] [cursor=pointer]:
                                                    - radio "深色主题" [ref=f3e256]
                                                    - generic [ref=f3e260]: 深色主题
                                                - generic [ref=f3e263] [cursor=pointer]:
                                                    - radio "跟随系统" [checked] [ref=f3e265]
                                                    - generic [ref=f3e278]: 跟随系统
                                        - radiogroup "强调色" [ref=f3e281]:
                                            - generic [ref=f3e285]:
                                                - generic [ref=f3e287] [cursor=pointer]:
                                                    - radio "紫色" [checked] [ref=f3e289]
                                                    - generic [ref=f3e292]: 紫色
                                                - generic [ref=f3e295] [cursor=pointer]:
                                                    - radio "蓝色" [ref=f3e297]
                                                    - generic [ref=f3e300]: 蓝色
                                                - generic [ref=f3e303] [cursor=pointer]:
                                                    - radio "绿色" [ref=f3e305]
                                                    - generic [ref=f3e308]: 绿色
                                                - generic [ref=f3e311] [cursor=pointer]:
                                                    - radio "橙色" [ref=f3e313]
                                                    - generic [ref=f3e316]: 橙色
                                            - generic [ref=f3e318]: 产品主操作与选中状态的强调颜色。
                                - generic [ref=f3e319]:
                                    - heading "空间与阅读" [level=2] [ref=f3e322]
                                    - generic [ref=f3e325]:
                                        - radiogroup "界面密度" [ref=f3e327]:
                                            - generic [ref=f3e329]:
                                                - generic [ref=f3e330]: 界面密度
                                                - generic [ref=f3e331]: 比较空间节奏示意；选择后在当前页面即时生效。
                                            - generic [ref=f3e332]:
                                                - generic [ref=f3e334] [cursor=pointer]:
                                                    - radio "紧凑" [ref=f3e336]
                                                    - generic [ref=f3e337]: 紧凑
                                                - generic [ref=f3e340] [cursor=pointer]:
                                                    - radio "标准" [checked] [ref=f3e342]
                                                    - generic [ref=f3e343]: 标准
                                                - generic [ref=f3e346] [cursor=pointer]:
                                                    - radio "宽松" [ref=f3e348]
                                                    - generic [ref=f3e349]: 宽松
                                        - radiogroup "界面字号" [ref=f3e352]:
                                            - generic [ref=f3e354]:
                                                - generic [ref=f3e355]: 界面字号
                                                - generic [ref=f3e356]: 比较字样大小；选择后整体界面立即缩放。
                                            - generic [ref=f3e357]:
                                                - generic [ref=f3e359] [cursor=pointer]:
                                                    - radio "小" [ref=f3e361]
                                                    - generic: Aa 字
                                                    - generic [ref=f3e362]: 小
                                                - generic [ref=f3e365] [cursor=pointer]:
                                                    - radio "标准" [checked] [ref=f3e367]
                                                    - generic: Aa 字
                                                    - generic [ref=f3e368]: 标准
                                                - generic [ref=f3e371] [cursor=pointer]:
                                                    - radio "大" [ref=f3e373]
                                                    - generic: Aa 字
                                                    - generic [ref=f3e374]: 大
                                        - radiogroup "内容宽度" [ref=f3e377]:
                                            - generic [ref=f3e379]:
                                                - generic [ref=f3e380]: 内容宽度
                                                - generic [ref=f3e381]: 比较容器比例示意；窄屏下均使用可用宽度。
                                            - generic [ref=f3e382]:
                                                - generic [ref=f3e384] [cursor=pointer]:
                                                    - radio "自适应" [checked] [ref=f3e386]
                                                    - generic [ref=f3e387]: 自适应
                                                - generic [ref=f3e390] [cursor=pointer]:
                                                    - radio "标准" [ref=f3e392]
                                                    - generic [ref=f3e393]: 标准
                                                - generic [ref=f3e396] [cursor=pointer]:
                                                    - radio "宽屏" [ref=f3e398]
                                                    - generic [ref=f3e399]: 宽屏
                                - generic [ref=f3e401]:
                                    - heading "动效与视觉辅助" [level=2] [ref=f3e404]
                                    - generic [ref=f3e407]:
                                        - radiogroup "动效偏好" [ref=f3e409]:
                                            - generic [ref=f3e413]:
                                                - generic [ref=f3e415] [cursor=pointer]:
                                                    - radio "跟随系统" [checked] [ref=f3e417]
                                                    - generic [ref=f3e419]: 跟随系统
                                                - generic [ref=f3e422] [cursor=pointer]:
                                                    - radio "标准" [ref=f3e424]
                                                    - generic [ref=f3e426]: 标准
                                                - generic [ref=f3e429] [cursor=pointer]:
                                                    - radio "减少动效" [ref=f3e431]
                                                    - generic [ref=f3e433]: 减少动效
                                            - generic [ref=f3e435]: 跟随系统、标准或减少动效。
                                        - radiogroup "高对比度" [ref=f3e437]:
                                            - generic [ref=f3e441]:
                                                - generic [ref=f3e443] [cursor=pointer]:
                                                    - radio "跟随系统" [checked] [ref=f3e445]
                                                    - generic [ref=f3e447]: 跟随系统
                                                - generic [ref=f3e450] [cursor=pointer]:
                                                    - radio "标准" [ref=f3e452]
                                                    - generic [ref=f3e454]: 标准
                                                - generic [ref=f3e457] [cursor=pointer]:
                                                    - radio "高对比度" [ref=f3e459]
                                                    - generic [ref=f3e461]: 高对比度
                                            - generic [ref=f3e463]: 高对比度增强辅助文字、边界与焦点轮廓；跟随系统响应操作系统的对比度偏好。
                                        - generic [ref=f3e464]:
                                            - paragraph [ref=f3e465]: 即时效果预览
                                            - paragraph [ref=f3e466]: 切换内容查看动效；使用 Tab 聚焦按钮检查轮廓。减少动效和系统偏好同样作用于此预览。
                                            - generic [ref=f3e467]:
                                                - button "切换预览内容" [ref=f3e468] [cursor=pointer]
                                                - generic [ref=f3e470]: 辅助文字与边界示例
                                            - paragraph [ref=f3e473]: 当前设置已应用。可比较主要操作、辅助文字和边界。
                            - generic [ref=f3e474]:
                                - button "恢复默认" [ref=f3e475] [cursor=pointer]
                                - button "恢复全部默认" [ref=f3e476] [cursor=pointer]
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
  11 | async function spaToSettings(page: Page) {
  12 |   const nav = page.getByRole('navigation', { name: '主导航' });
  13 |   await nav.getByRole('link', { name: /^设置$/ }).click();
  14 |   await page.waitForURL(/\/settings$/);
  15 | }
  16 |
  17 | test('跳转后自动滚顶默认开：长页滚下后导航到设置 → 回到顶部', async ({ page }) => {
  18 |   await resetPreferences(page);
  19 |   await page.goto('/page-archetypes/resource-list');
  20 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  21 |   await page.evaluate(() => window.scrollTo(0, 800));
  22 |   await page.waitForTimeout(300);
  23 |   const before = await page.evaluate(() => window.scrollY);
  24 |   expect(before).toBeGreaterThan(100);
  25 |   await spaToSettings(page);
  26 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  27 |   await page.waitForTimeout(500);
  28 |   const after = await page.evaluate(() => window.scrollY);
  29 |   expect(after).toBeLessThan(50);
  30 | });
  31 |
  32 | test('关闭 跳转后自动滚顶：长页滚下后导航保持滚动位置', async ({ page }) => {
  33 |   await resetPreferences(page);
  34 |   // 设置 → 导航 → 跳转后自动滚顶 = 关。
  35 |   await page.goto('/settings/navigation');
  36 |   await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  37 |   const scrollPref = page.getByRole('switch', { name: '跳转后自动滚动到顶部' });
  38 |   await scrollPref.focus();
  39 |   await page.keyboard.press('Space');
  40 |   await expect(scrollPref).not.toBeChecked();
  41 |   await page.waitForTimeout(300);
  42 |
  43 |   await page.goto('/page-archetypes/resource-list');
  44 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  45 |   await page.evaluate(() => window.scrollTo(0, 800));
  46 |   await page.waitForTimeout(300);
  47 |   await spaToSettings(page);
  48 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  49 |   await page.waitForTimeout(500);
  50 |   const after = await page.evaluate(() => window.scrollY);
> 51 |   expect(after).toBeGreaterThan(100);
     |                 ^ Error: expect(received).toBeGreaterThan(expected)
  52 | });
  53 |
```
