# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commands.spec.ts >> 命令菜单聚合插件注册命令：Ctrl+K → 新建资源命令执行跳转
- Location: apps\web\e2e\commands.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('searchbox', { name: '搜索命令' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('searchbox', { name: '搜索命令' })

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
  1  | import { expect, test } from '@playwright/test';
  2  |
  3  | test('命令菜单聚合插件注册命令：Ctrl+K → 新建资源命令执行跳转', async ({ page }) => {
  4  |   await page.goto('/reference-resources');
  5  |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  6  |   // Ctrl+K 打开命令菜单。
  7  |   await page.keyboard.press('Control+K');
  8  |   const search = page.getByRole('searchbox', { name: '搜索命令' });
> 9  |   await expect(search).toBeVisible();
     |                        ^ Error: expect(locator).toBeVisible() failed
  10 |   // 插件注册的页面命令 "新建资源" 出现在结果中。
  11 |   await search.fill('新建资源');
  12 |   const option = page.getByRole('option', { name: /新建资源/ }).first();
  13 |   await expect(option).toBeVisible();
  14 |   // 激活（点击选项，与键盘 Enter 同一条 onAction 路径）→ 导航到创建页。
  15 |   await option.click();
  16 |   await expect(page).toHaveURL(/\/reference-resources\/create/);
  17 | });
  18 |
```
