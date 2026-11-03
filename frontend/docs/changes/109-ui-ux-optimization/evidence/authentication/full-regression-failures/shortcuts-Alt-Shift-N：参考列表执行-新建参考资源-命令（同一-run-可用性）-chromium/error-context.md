# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shortcuts.spec.ts >> Alt+Shift+N：参考列表执行"新建参考资源"命令（同一 run/可用性）
- Location: apps\web\e2e\shortcuts.spec.ts:11:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/reference-resources\/create/
Received string:  "http://127.0.0.1:4173/reference-resources"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    14 × locator resolved to <html lang="zh-CN" data-theme="light" data-accent="purple" data-hydrated="true" data-motion-swap="on" data-motion-async="on" data-motion-media="on" data-contrast="system" data-motion-screen="on" data-motion-reveal="on" data-density="standard" data-follow-system="on" data-enhance-focus="off" data-motion-mode="system" data-motion-feedback="on" data-content-width="auto" data-enhance-target="off" data-font-scale="standard" data-system-contrast="standard">…</html>
       - unexpected value "http://127.0.0.1:4173/reference-resources"

```

```yaml
- alert
- link "跳到主要内容 / Skip to content":
    - /url: '#main-content'
- complementary:
    - paragraph: Community
    - paragraph: 统一前端基座
    - navigation "主导航":
        - paragraph: Universal Foundation
        - list:
            - listitem:
                - link "总览":
                    - /url: /
        - paragraph: 系统
        - list:
            - listitem:
                - link "设置":
                    - /url: /settings
            - listitem:
                - link "Icon 大全":
                    - /url: /system-tools/icons
        - paragraph: 参考资源
        - list:
            - listitem:
                - link "参考资源":
                    - /url: /reference-resources
        - paragraph: 开发
        - list:
            - listitem:
                - link "基座能力":
                    - /url: /foundations
            - listitem:
                - link "Motion":
                    - /url: /motion
            - listitem:
                - button "展开或收起Page Archetypes": Page Archetypes
            - listitem:
                - button "展开或收起Page Patterns": Page Patterns
            - listitem:
                - link "状态体系":
                    - /url: /states
            - listitem:
                - button "展开或收起UI Elements": UI Elements
    - text: Architecture Preview
    - paragraph: React 19 · HeroUI · Tailwind CSS v4
- banner:
    - button "收起侧栏"
    - button "按 Ctrl K 搜索"
    - button "切换语言"
    - button "切换主题"
    - button "通知"
    - button "当前用户": RI Rin
- main:
    - paragraph: 本地演示 · 刷新后恢复示例数据
    - heading "参考资源" [level=1]
    - paragraph: 通过 File Route 与 Route Target 驱动的确定性参考资源列表。
    - link "新建资源":
        - /url: /reference-resources/create
    - list:
        - listitem:
            - paragraph: resource-alpha
            - heading "Alpha 示例资源" [level=2]
            - paragraph: 第一个确定性参考资源，用于验证列表、详情与编辑的路由。
            - text: 进行中
            - link "查看":
                - /url: /reference-resources/detail?id=resource-alpha
            - link "编辑":
                - /url: /reference-resources/edit?id=resource-alpha
        - listitem:
            - paragraph: resource-beta
            - heading "Beta 引导指南" [level=2]
            - paragraph: 展示静态路由装配与受控导航目标的确定性链路。
            - text: 进行中
            - link "查看":
                - /url: /reference-resources/detail?id=resource-beta
            - link "编辑":
                - /url: /reference-resources/edit?id=resource-beta
        - listitem:
            - paragraph: resource-gamma
            - heading "Gamma 模板" [level=2]
            - paragraph: 草稿资源，用于验证状态展示与编辑场景。
            - text: 草稿
            - link "查看":
                - /url: /reference-resources/detail?id=resource-gamma
            - link "编辑":
                - /url: /reference-resources/edit?id=resource-gamma
```

# Test source

```ts
  1  | import type { Page } from '@playwright/test';
  2  | import { expect, test } from '@playwright/test';
  3  |
  4  | async function resetPreferences(page: Page) {
  5  |   await page.goto('/settings/shortcuts');
  6  |   await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  7  |   await page.reload();
  8  |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  9  | }
  10 |
  11 | test('Alt+Shift+N：参考列表执行"新建参考资源"命令（同一 run/可用性）', async ({ page }) => {
  12 |   await resetPreferences(page);
  13 |   await page.goto('/reference-resources');
  14 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  15 |   await page.keyboard.press('Alt+Shift+n');
> 16 |   await expect(page).toHaveURL(/\/reference-resources\/create/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  17 |   await expect(page.getByRole('heading', { level: 1 })).toHaveText('创建参考资源');
  18 | });
  19 |
  20 | test('快捷键关闭后 Alt+Shift+N 不再执行', async ({ page }) => {
  21 |   await resetPreferences(page);
  22 |   // 设置 → 快捷键 → 启用快捷键 = 关。
  23 |   await page.goto('/settings/shortcuts');
  24 |   await page.getByRole('heading', { name: '快捷键' }).first().scrollIntoViewIfNeeded();
  25 |   const enabled = page.getByRole('switch', { name: '启用快捷键' });
  26 |   await enabled.focus();
  27 |   await page.keyboard.press('Space');
  28 |   await expect(enabled).not.toBeChecked();
  29 |   await page.waitForTimeout(300);
  30 |
  31 |   await page.goto('/reference-resources');
  32 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  33 |   await page.keyboard.press('Alt+Shift+n');
  34 |   await page.waitForTimeout(400);
  35 |   await expect(page).not.toHaveURL(/\/reference-resources\/create/);
  36 | });
  37 |
```
