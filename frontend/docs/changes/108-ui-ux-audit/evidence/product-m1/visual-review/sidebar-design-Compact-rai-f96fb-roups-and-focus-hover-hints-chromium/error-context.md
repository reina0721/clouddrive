# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sidebar-design.spec.ts >> Compact rail uses coherent geometry, current route, named groups and focus/hover hints
- Location: apps\web\e2e\sidebar-design.spec.ts:11:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('navigation', { name: '主导航' }).getByRole('list', { name: '系统', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('navigation', { name: '主导航' }).getByRole('list', { name: '系统', exact: true })

```

```yaml
- alert
- link "跳到主要内容 / Skip to content":
    - /url: '#main-content'
- complementary:
    - navigation "主导航":
        - list "工作空间":
            - listitem:
                - link "工作台":
                    - /url: /
        - list "个人":
            - listitem:
                - link "个人偏好":
                    - /url: /settings
        - list "开发中心":
            - listitem:
                - button "UI Elements"
            - listitem:
                - button "Page Patterns"
            - listitem:
                - button "Page Archetypes"
            - listitem:
                - link "参考资源":
                    - /url: /reference-resources
            - listitem:
                - link "Icon 大全":
                    - /url: /system-tools/icons
            - listitem:
                - link "基座能力":
                    - /url: /foundations
            - listitem:
                - link "Motion":
                    - /url: /motion
            - listitem:
                - link "状态体系":
                    - /url: /states
- banner:
    - button "展开侧栏"
    - button "按 Ctrl K 搜索"
    - button "切换语言"
    - button "切换主题"
    - button "通知"
    - button "当前用户": RI Rin
- main:
    - list "面包屑导航":
        - listitem:
            - link "基座验证"
        - listitem:
            - link "UI Elements"
        - listitem:
            - link "导航与集合进度" [disabled]
    - paragraph: UI Elements · Catalog
    - heading "导航与集合进度" [level=1]
    - paragraph: 文本链接、层级导航、分页和内容 Tabs 分别保留原生导航语义。
    - text: 展示密度
    - button "舒适 展示密度": 舒适
    - switch "扩展文本"
    - text: 扩展文本 切换到极长内容以验证传播范围。
    - switch "English Locale"
    - text: English Locale 切换中英文并观察文本扩张与布局。
    - region "UI Elements 分类导航":
        - paragraph: 公开契约目录
        - heading "导航与集合进度" [level=2]
        - paragraph: 文本链接、层级导航、分页和内容 Tabs 分别保留原生导航语义。
        - text: 7 / 公开 Element 46 / 46
        - navigation "UI Elements 分类导航":
            - link "操作与选择 · 3":
                - /url: /ui-elements/actions-selection
            - link "反馈 · 4":
                - /url: /ui-elements/feedback
            - link "状态与异步 · 7":
                - /url: /ui-elements/status-async
            - link "身份与展示 · 4":
                - /url: /ui-elements/identity-display
            - link "导航 · 7":
                - /url: /ui-elements/navigation
            - link "数据展示 · 1":
                - /url: /ui-elements/data
            - link "表面与卡片 · 2":
                - /url: /ui-elements/surfaces
            - link "表单控件 · 10":
                - /url: /ui-elements/forms
            - link "浮层与弹出界面 · 8":
                - /url: /ui-elements/overlays
    - navigation "本页区段":
        - link "导航与集合进度":
            - /url: /ui-elements/navigation#navigation
        - link "TextLink":
            - /url: /ui-elements/navigation#element-textlink
        - link "BreadcrumbTrail":
            - /url: /ui-elements/navigation#element-breadcrumbtrail
        - link "PaginationControl":
            - /url: /ui-elements/navigation#element-paginationcontrol
        - link "TabsView · soft":
            - /url: /ui-elements/navigation#element-tabsview-soft
        - link "TabsView":
            - /url: /ui-elements/navigation#element-tabsview
        - link "TabsView · line + icon":
            - /url: /ui-elements/navigation#element-tabsview-line-icon
        - link "TabsView · line + badge":
            - /url: /ui-elements/navigation#element-tabsview-line-badge
        - link "TabsView · vertical":
            - /url: /ui-elements/navigation#element-tabsview-vertical
        - link "TabsView · section（Section Tabs in Panel）":
            - /url: /ui-elements/navigation#element-tabsview-section-section-tabs-in-panel
        - link "StepNavigation":
            - /url: /ui-elements/navigation#element-stepnavigation
        - link "Tree":
            - /url: /ui-elements/navigation#element-tree
        - link "DisclosurePanel":
            - /url: /ui-elements/navigation#element-disclosurepanel
    - heading "导航与集合进度" [level=2]
    - paragraph: 文本链接、层级导航、分页和内容 Tabs 分别保留原生导航语义。
    - heading "TextLink" [level=3]
    - text: 品牌 中性 前后图标 外部链接 运行时适配
    - paragraph: TextLink 用于真实导航；SPA 拦截由 Host Adapter 注入，Action 不伪装链接。
    - link "返回 Actions":
        - /url: '#actions'
    - link "Host 拦截示例":
        - /url: '#navigation'
    - heading "BreadcrumbTrail" [level=3]
    - text: 链接 禁用 当前 aria-current
    - paragraph: Breadcrumb 显式区分可导航层级、禁用层级和当前位置。
    - list "面包屑导航":
        - listitem:
            - link "基座验证":
                - /url: /
        - listitem:
            - link "受限层级" [disabled]
        - listitem:
            - link "UI Elements" [disabled]
    - heading "PaginationControl" [level=3]
    - text: 当前 上一项与下一项 省略 边界 禁用
    - paragraph: Pagination 表达边界、当前页、Ellipsis 和整体禁用，集合状态留给 Feature。
    - navigation "UI Elements 分页":
        - list:
            - listitem:
                - button "上一页"
            - listitem:
                - button "第 1 页": '1'
            - listitem:
                - button "第 2 页": '2'
            - listitem:
                - button "第 3 页": '3'
            - listitem
            - listitem:
                - button "第 12 页": '12'
            - listitem:
                - button "下一页"
    - navigation "禁用分页":
        - list:
            - listitem:
                - button "上一页" [disabled]
            - listitem:
                - button "第 1 页" [disabled]: '1'
            - listitem:
                - button "下一页" [disabled]
    - heading "TabsView · soft" [level=3]
    - text: 总览 通知 分析 客户
    - paragraph: soft Variant 让 TabList 形成轻量选择区域：muted 容器 + selected Tab 用 elevated surface 凸显；仍是内容切换，不是值/模式选择。
    - tablist "内容视图 Tabs":
        - tab "总览" [selected]
        - tab "通知"
        - tab "分析"
        - tab "客户"
    - tabpanel "总览":
        - paragraph: 这是用于验证正常内容节奏的短说明。
    - heading "TabsView" [level=3]
    - text: 选中 禁用 受控 键盘 仅内容标签
    - paragraph: TabsView 只切换同一内容域，保留 selected、disabled 和键盘语义。
    - tablist "内容视图 Tabs":
        - tab "正常" [selected]
        - tab "空状态"
        - tab "不可用" [disabled]
    - tabpanel "正常":
        - paragraph: 这是用于验证正常内容节奏的短说明。
    - heading "TabsView · line + icon" [level=3]
    - text: 前置图标 选中 键盘
    - paragraph: item 支持受控 leading icon：统一尺寸、跟随 foreground、不改变 Tab 语义。
    - tablist "内容视图 Tabs":
        - tab "总览" [selected]
        - tab "通知"
        - tab "客户"
    - tabpanel "总览":
        - paragraph: 这是用于验证正常内容节奏的短说明。
    - heading "TabsView · line + badge" [level=3]
    - text: 计数徽标 选中 未选中时可读
    - paragraph: item 支持受控 count badge：由公共 Badge primitive 渲染，selected/unselected 均可读。
    - tablist "内容视图 Tabs":
        - tab "总览" [selected]
        - tab "通知 12"
        - tab "客户 4"
    - tabpanel "总览":
        - paragraph: 这是用于验证正常内容节奏的短说明。
    - heading "TabsView · vertical" [level=3]
    - text: 双列 侧边指示器 上下方向键 响应式
    - paragraph: vertical 让 Tab 列 + 内容区形成稳定两栏；窄视口自动转为顶部横向可滚动 TabList。
    - tablist "内容视图 Tabs":
        - tab "总览" [selected]
        - tab "通知"
        - tab "分析"
        - tab "客户"
    - tabpanel "总览":
        - paragraph: 这是用于验证正常内容节奏的短说明。
    - heading "TabsView · section（Section Tabs in Panel）" [level=3]
    - text: 嵌入面板 不增加容器或工具条 键盘
    - paragraph: section Variant 用于 Card、Form、Settings 等内部章节导航：透明 TabList、不创建灰色 Toolbar 或独立 Surface，内容分隔由父容器决定。
    - heading "内容视图 Tabs" [level=2]
    - paragraph: section Variant 用于 Card、Form、Settings 等内部章节导航：透明 TabList、不创建灰色 Toolbar 或独立 Surface，内容分隔由父容器决定。
    - tablist "内容视图 Tabs":
        - tab "正常" [selected]
        - tab "空状态"
    - tabpanel "正常":
        - paragraph: 这是用于验证正常内容节奏的短说明。
    - heading "StepNavigation" [level=3]
    - text: 即将开始 当前 完成 错误 禁用
    - paragraph: 有限步骤表达当前位置、完成与错误，不代替页面 Tabs。
    - navigation "基座步骤":
        - list:
            - listitem: 契约
            - listitem: 可访问性
            - listitem: 验证证据
    - heading "Tree" [level=3]
    - text: 嵌套 展开 选中 禁用 键盘 长标签 图标与说明
    - paragraph: 层级集合统一键盘导航、展开、选择与禁用语义。
    - treegrid "基座树":
        - row "Universal Foundation" [expanded] [level=1]:
            - gridcell "收起 Universal Foundation Universal Foundation Universal Foundation 跨 Surface 稳定契约":
                - button "收起 Universal Foundation Universal Foundation"
                - text: Universal Foundation 跨 Surface 稳定契约
        - row "UI Elements" [level=2]:
            - gridcell "UI Elements"
        - row "Motion" [disabled] [level=2]:
            - gridcell "Motion" [disabled]
        - row "这是验证深层级与窄宽度下长文本仍完整可读和可访问的树节点示例。" [level=2]:
            - gridcell "这是验证深层级与窄宽度下长文本仍完整可读和可访问的树节点示例。"
        - row "Surface Foundation" [level=1]:
            - gridcell "Surface Foundation"
    - heading "DisclosurePanel" [level=3]
    - text: 折叠 展开 禁用 键盘
    - paragraph: 补充内容展开由 React Aria/HeroUI 管理状态与焦点。
    - heading "组合边界" [level=3]:
        - button "组合边界" [expanded]
    - group "组合边界": Disclosure 不承担页面导航或浮层交互。
```

# Test source

```ts
  1   | import AxeBuilder from '@axe-core/playwright';
  2   | import { expect, test, type Page } from '@playwright/test';
  3   |
  4   | const navigation = (page: Page) => page.getByRole('navigation', { name: '主导航' });
  5   | async function collapse(page: Page) {
  6   |   await page.goto('/ui-elements/navigation');
  7   |   await page.getByRole('button', { name: '收起侧栏' }).click();
  8   |   await expect(page.locator('aside').first()).toHaveCSS('width', '80px');
  9   | }
  10  |
  11  | test('Compact rail uses coherent geometry, current route, named groups and focus/hover hints', async ({
  12  |   page,
  13  | }, testInfo) => {
  14  |   const evidence = testInfo.outputDir;
  15  |   await collapse(page);
  16  |   const nav = navigation(page);
  17  |   const targets = nav.locator('a,button');
  18  |   for (const item of await targets.all()) {
  19  |     const box = await item.boundingBox();
  20  |     expect(box?.width).toBe(48);
  21  |     expect(box?.height).toBe(48);
  22  |     expect(box!.x + box!.width / 2).toBe(40);
  23  |     await expect(item.locator('svg').first()).toHaveCSS('width', '24px');
  24  |     await expect(item.locator('svg').first()).toHaveAttribute('aria-hidden', 'true');
  25  |   }
> 26  |   await expect(nav.getByRole('list', { name: '个人', exact: true })).toBeVisible();
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
  27  |   const branch = nav.getByRole('button', { name: 'UI Elements', exact: true });
  28  |   await expect(branch).toHaveAttribute('data-active', 'true');
  29  |   const settings = nav.getByRole('link', { name: '个人偏好', exact: true });
  30  |   await settings.hover();
  31  |   await expect(page.getByRole('tooltip', { name: '个人偏好', exact: true })).toBeVisible();
  32  |   await page.screenshot({ path: `${evidence}/compact-tooltip.png`, animations: 'disabled' });
  33  |   await page.mouse.move(700, 200);
  34  |   await page.keyboard.press('Tab');
  35  |   await settings.focus();
  36  |   await expect(page.getByRole('tooltip', { name: '个人偏好', exact: true })).toBeVisible();
  37  |   await expect(settings).toBeFocused();
  38  |   await expect(settings).toHaveCSS('outline-style', 'solid');
  39  |   await expect(settings).toHaveCSS('outline-width', '2px');
  40  |   await page.evaluate(() => {
  41  |     document.documentElement.dataset.enhanceFocus = 'on';
  42  |   });
  43  |   await expect(settings).toHaveCSS('outline-width', '4px');
  44  |   await page.screenshot({ path: `${evidence}/compact-focus-enhanced.png`, animations: 'disabled' });
  45  |   await settings.press('Escape');
  46  |   await expect(page.getByRole('tooltip')).toBeHidden();
  47  |   await settings.press('Enter');
  48  |   await expect(page).toHaveURL(/\/settings$/);
  49  |   await expect(settings).toHaveAttribute('aria-current', 'page');
  50  |   await page.reload();
  51  |   await expect(page.locator('aside').first()).toHaveCSS('width', '80px');
  52  | });
  53  |
  54  | test('Hover bridge, click pin, second click close and keyboard focus survive pointer departure', async ({
  55  |   page,
  56  | }, testInfo) => {
  57  |   const evidence = testInfo.outputDir;
  58  |   await collapse(page);
  59  |   const trigger = navigation(page).getByRole('button', { name: 'UI Elements', exact: true });
  60  |   const flyout = page.getByRole('dialog', { name: 'UI Elements', exact: true });
  61  |   await trigger.hover();
  62  |   await expect(flyout).toBeVisible();
  63  |   await expect(flyout.getByText('UI Elements', { exact: true })).toBeVisible();
  64  |   await flyout.getByRole('link', { name: '导航', exact: true }).hover();
  65  |   await expect(flyout.getByRole('link', { name: '导航', exact: true })).toHaveAttribute(
  66  |     'aria-current',
  67  |     'page',
  68  |   );
  69  |   await expect(flyout).toBeVisible();
  70  |   await trigger.click();
  71  |   await page.mouse.move(700, 200);
  72  |   // Wait past the close corridor to prove press-open is durable.
  73  |   await page.waitForTimeout(400);
  74  |   await expect(flyout).toBeVisible();
  75  |   await trigger.click();
  76  |   await expect(flyout).toBeHidden();
  77  |   await page.mouse.move(700, 200);
  78  |   await trigger.focus();
  79  |   await trigger.press('Enter');
  80  |   await expect(flyout).toBeVisible();
  81  |   await page.keyboard.press('Tab');
  82  |   await expect(flyout.getByRole('link').first()).toBeFocused();
  83  |   await page.mouse.move(700, 200);
  84  |   await page.waitForTimeout(400);
  85  |   await expect(flyout).toBeVisible();
  86  |   const scan = await new AxeBuilder({ page })
  87  |     .include('nav')
  88  |     .include('[role="dialog"]')
  89  |     .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  90  |     .analyze();
  91  |   expect(scan.violations).toEqual([]);
  92  |   await page.screenshot({ path: `${evidence}/compact-flyout.png`, animations: 'disabled' });
  93  |   await page.keyboard.press('Escape');
  94  |   await expect(flyout).toBeHidden();
  95  |   await expect(trigger).toBeFocused();
  96  | });
  97  |
  98  | test('Mode round trip retains exploration and closes old portal; expanded layout remains intact', async ({
  99  |   page,
  100 | }, testInfo) => {
  101 |   const evidence = testInfo.outputDir;
  102 |   await page.goto('/');
  103 |   const nav = navigation(page);
  104 |   await nav.getByRole('button', { name: '展开或收起Page Patterns' }).click();
  105 |   await page.getByRole('button', { name: '收起侧栏' }).click();
  106 |   await nav.getByRole('button', { name: 'UI Elements', exact: true }).hover();
  107 |   await expect(page.getByRole('dialog', { name: 'UI Elements' })).toBeVisible();
  108 |   await page.getByRole('button', { name: '展开侧栏' }).click();
  109 |   await expect(page.getByRole('dialog', { name: 'UI Elements' })).toBeHidden();
  110 |   await expect(nav.getByRole('button', { name: '展开或收起Page Patterns' })).toHaveAttribute(
  111 |     'aria-expanded',
  112 |     'true',
  113 |   );
  114 |   await expect(page.locator('aside').first()).toHaveCSS('width', '264px');
  115 |   await expect(nav.getByRole('link', { name: '工作台', exact: true }).locator('svg')).toHaveCSS(
  116 |     'width',
  117 |     '16px',
  118 |   );
  119 |   await page.screenshot({ path: `${evidence}/expanded.png`, animations: 'disabled' });
  120 | });
  121 |
  122 | test('Compact rail stays usable at 1024/1440/2560, dark English, short height and text zoom', async ({
  123 |   page,
  124 | }, testInfo) => {
  125 |   const evidence = testInfo.outputDir;
  126 |   await collapse(page);
```
