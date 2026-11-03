# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> 收缩侧栏的 Hover Flyout 保持稳定并支持键盘进入
- Location: apps\web\e2e\navigation.spec.ts:46:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  9948 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: surface-shell-compact-flyout.png

Call log:
  - Expect "soft toHaveScreenshot(surface-shell-compact-flyout.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 9948 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 9948 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
    - alert [ref=e11]: Overlay 与 Floating Layer
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
                        - button "UI Elements" [active] [ref=e80] [cursor=pointer]
                    - listitem [ref=e89]:
                        - button "Page Patterns" [ref=e90] [cursor=pointer]
                    - listitem [ref=e99]:
                        - button "Page Archetypes" [ref=e100] [cursor=pointer]
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
                    - generic [ref=e175]:
                        - list "面包屑导航" [ref=e176]:
                            - listitem [ref=e177]:
                                - link "基座验证" [ref=e178] [cursor=pointer]
                                - generic [ref=e179]: /
                            - listitem [ref=e180]:
                                - link "UI Elements" [ref=e181] [cursor=pointer]
                                - generic [ref=e182]: /
                            - listitem [ref=e183]:
                                - link "Overlay 与 Floating Layer" [disabled]
                        - generic [ref=e185]:
                            - paragraph [ref=e186]: UI Elements · Catalog
                            - heading "Overlay 与 Floating Layer" [level=1] [ref=e187]
                            - paragraph [ref=e188]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                    - generic [ref=e189]:
                        - generic [ref=e190]:
                            - generic [ref=e191]: 展示密度
                            - button "舒适 展示密度" [ref=e192] [cursor=pointer]:
                                - generic [ref=e193]: 舒适
                            - combobox [ref=e200]
                        - generic [ref=e202] [cursor=pointer]:
                            - switch "扩展文本" [ref=e204]
                            - generic [ref=e205]:
                                - generic [ref=e206]: 扩展文本
                                - generic [ref=e207]: 切换到极长内容以验证传播范围。
                        - generic [ref=e211] [cursor=pointer]:
                            - switch "English Locale" [ref=e213]
                            - generic [ref=e214]:
                                - generic [ref=e215]: English Locale
                                - generic [ref=e216]: 切换中英文并观察文本扩张与布局。
                    - region "UI Elements 分类导航" [ref=e220]:
                        - generic [ref=e221]:
                            - generic [ref=e222]:
                                - paragraph [ref=e223]: 公开契约目录
                                - heading "Overlay 与 Floating Layer" [level=2] [ref=e224]
                                - paragraph [ref=e225]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                            - generic [ref=e226]: 8 / 公开 Element 46 / 46
                        - navigation "UI Elements 分类导航" [ref=e228]:
                            - link "操作与选择 · 3" [ref=e229] [cursor=pointer]:
                                - /url: /ui-elements/actions-selection
                            - link "反馈 · 4" [ref=e232] [cursor=pointer]:
                                - /url: /ui-elements/feedback
                            - link "状态与异步 · 7" [ref=e235] [cursor=pointer]:
                                - /url: /ui-elements/status-async
                            - link "身份与展示 · 4" [ref=e238] [cursor=pointer]:
                                - /url: /ui-elements/identity-display
                            - link "导航 · 7" [ref=e241] [cursor=pointer]:
                                - /url: /ui-elements/navigation
                            - link "数据展示 · 1" [ref=e244] [cursor=pointer]:
                                - /url: /ui-elements/data
                            - link "表面与卡片 · 2" [ref=e247] [cursor=pointer]:
                                - /url: /ui-elements/surfaces
                            - link "表单控件 · 10" [ref=e250] [cursor=pointer]:
                                - /url: /ui-elements/forms
                            - link "浮层与弹出界面 · 8" [ref=e253] [cursor=pointer]:
                                - /url: /ui-elements/overlays
                    - navigation "本页区段" [ref=e256]:
                        - link "Overlay 与 Floating Layer" [ref=e257] [cursor=pointer]:
                            - /url: /ui-elements/overlays#overlays
                        - link "MenuButton" [ref=e258] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-menubutton
                        - link "MenuButton · Groups / Submenu" [ref=e259] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-menubutton-groups-submenu
                        - link "PopoverCard" [ref=e260] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-popovercard
                        - link "TooltipAction" [ref=e261] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-tooltipaction
                        - link "DialogSurface" [ref=e262] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-dialogsurface
                        - link "ConfirmDialog" [ref=e263] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-confirmdialog
                        - link "DestructiveConfirmDialog" [ref=e264] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-destructiveconfirmdialog
                        - link "DrawerSurface" [ref=e265] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-drawersurface
                        - link "CommandMenu" [ref=e266] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-commandmenu
                    - generic [ref=e268]:
                        - generic [ref=e270]:
                            - heading "Overlay 与 Floating Layer" [level=2] [ref=e271]
                            - paragraph [ref=e272]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                        - generic [ref=e274]:
                            - generic [ref=e275]:
                                - generic [ref=e276]:
                                    - generic [ref=e277]:
                                        - heading "MenuButton" [level=3] [ref=e278]
                                        - generic "MenuButton 状态" [ref=e279]:
                                            - generic [ref=e280]: 默认
                                            - generic [ref=e282]: 图标
                                            - generic [ref=e284]: 说明
                                            - generic [ref=e286]: 禁用
                                            - generic [ref=e288]: 危险
                                            - generic [ref=e290]: 键盘
                                    - paragraph [ref=e292]: MenuButton 承载命令集合，区分普通、危险和不可用 Item。
                                - button "Reference 操作菜单" [ref=e294] [cursor=pointer]: Dropdown Menu
                            - generic [ref=e295]:
                                - generic [ref=e296]:
                                    - generic [ref=e297]:
                                        - heading "MenuButton · Groups / Submenu" [level=3] [ref=e298]
                                        - generic "MenuButton · Groups / Submenu 状态" [ref=e299]:
                                            - generic [ref=e300]: 分组
                                            - generic [ref=e302]: 选中
                                            - generic [ref=e304]: 二级菜单
                                            - generic [ref=e306]: 键盘
                                            - generic [ref=e308]: 触摸
                                            - generic [ref=e310]: 碰撞避让
                                    - paragraph [ref=e312]: 分组与二级菜单
                                - button "分组与二级菜单" [ref=e314] [cursor=pointer]
                            - generic [ref=e315]:
                                - generic [ref=e316]:
                                    - generic [ref=e317]:
                                        - heading "PopoverCard" [level=3] [ref=e318]
                                        - generic "PopoverCard 状态" [ref=e319]:
                                            - generic [ref=e320]: 触发器
                                            - generic [ref=e322]: 标题
                                            - generic [ref=e324]: 长内容
                                            - generic [ref=e326]: 焦点返回
                                            - generic [ref=e328]: 碰撞避让
                                    - paragraph [ref=e330]: PopoverCard 承载与 Trigger 相关的可交互短内容，不替代 Tooltip 或 Dialog。
                                - button "Popover" [ref=e332] [cursor=pointer]
                            - generic [ref=e333]:
                                - generic [ref=e334]:
                                    - generic [ref=e335]:
                                        - heading "TooltipAction" [level=3] [ref=e336]
                                        - generic "TooltipAction 状态" [ref=e337]:
                                            - generic [ref=e338]: 悬停
                                            - generic [ref=e340]: 焦点
                                            - generic [ref=e342]: 延迟
                                            - generic [ref=e344]: Escape 键
                                            - generic [ref=e346]: 非交互内容
                                    - paragraph [ref=e348]: Tooltip 只提供简短非交互说明，同时支持 Hover 与 Keyboard Focus。
                                - generic [ref=e349]:
                                    - button "Tooltip" [ref=e350]
                                    - generic [ref=e351]:
                                        - link "组合提示" [ref=e352] [cursor=pointer]:
                                            - /url: '#element-popovercard'
                                        - button "Overlay 与 Floating Layer" [ref=e356] [cursor=pointer]
                            - generic [ref=e363]:
                                - generic [ref=e364]:
                                    - generic [ref=e365]:
                                        - heading "DialogSurface" [level=3] [ref=e366]
                                        - generic "DialogSurface 状态" [ref=e367]:
                                            - generic [ref=e368]: 表单内容
                                            - generic [ref=e370]: 取消
                                            - generic [ref=e372]: 确认
                                            - generic [ref=e374]: 提交中
                                            - generic [ref=e376]: 失败
                                            - generic [ref=e378]: 焦点隔离
                                    - paragraph [ref=e380]: DialogSurface 承载普通表单决策，并统一焦点、Pending、失败与 Footer。
                                - button "Dialog" [ref=e382] [cursor=pointer]
                            - generic [ref=e383]:
                                - generic [ref=e384]:
                                    - generic [ref=e385]:
                                        - heading "ConfirmDialog" [level=3] [ref=e386]
                                        - generic "ConfirmDialog 状态" [ref=e387]:
                                            - generic [ref=e388]: 影响范围
                                            - generic [ref=e390]: 取消
                                            - generic [ref=e392]: 确认
                                            - generic [ref=e394]: 禁用
                                            - generic [ref=e396]: 提交中
                                            - generic [ref=e398]: 失败
                                    - paragraph [ref=e400]: ConfirmDialog 用于需要显式确认的普通决策，并呈现影响范围。
                                - button "普通确认" [ref=e402] [cursor=pointer]
                            - generic [ref=e403]:
                                - generic [ref=e404]:
                                    - generic [ref=e405]:
                                        - heading "DestructiveConfirmDialog" [level=3] [ref=e406]
                                        - generic "DestructiveConfirmDialog 状态" [ref=e407]:
                                            - generic [ref=e408]: 危险语义
                                            - generic [ref=e410]: 影响范围
                                            - generic [ref=e412]: 提交中
                                            - generic [ref=e414]: 失败
                                            - generic [ref=e416]: 焦点恢复
                                    - paragraph [ref=e418]: Destructive Confirm 以危险语义强调不可逆后果，不与普通确认共用视觉。
                                - button "危险确认" [ref=e420] [cursor=pointer]
                            - generic [ref=e421]:
                                - generic [ref=e422]:
                                    - generic [ref=e423]:
                                        - heading "DrawerSurface" [level=3] [ref=e424]
                                        - generic "DrawerSurface 状态" [ref=e425]:
                                            - generic [ref=e426]: 右侧抽屉
                                            - generic [ref=e428]: 标题与正文
                                            - generic [ref=e430]: 关闭
                                            - generic [ref=e432]: 滚动
                                            - generic [ref=e434]: 窄视口
                                    - paragraph [ref=e436]: Drawer 在侧边承载辅助任务，拥有独立 Header、Body、关闭和滚动边界。
                                - button "Drawer" [ref=e438] [cursor=pointer]
                            - generic [ref=e439]:
                                - generic [ref=e440]:
                                    - generic [ref=e441]:
                                        - heading "CommandMenu" [level=3] [ref=e442]
                                        - generic "CommandMenu 状态" [ref=e443]:
                                            - generic [ref=e444]: 搜索
                                            - generic [ref=e446]: 已筛选
                                            - generic [ref=e448]: 空状态
                                            - generic [ref=e450]: 键盘操作
                                            - generic [ref=e452]: 模态焦点
                                    - paragraph [ref=e454]: CommandMenu 组合搜索、过滤、空结果和键盘命令执行。
                                - button "Command" [ref=e456] [cursor=pointer]
```

# Test source

```ts
  1   | import AxeBuilder from '@axe-core/playwright';
  2   | import { expect, test } from '@playwright/test';
  3   |
  4   | test('展开侧栏用同一递归能力呈现 Page Archetypes 与 UI Elements（Active Path Anchored Accordion）', async ({
  5   |   page,
  6   | }) => {
  7   |   await page.goto('/page-archetypes/create-edit');
  8   |   const navigation = page.getByRole('navigation', { name: '主导航' });
  9   |   const referenceToggle = navigation.getByRole('button', {
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
> 61  |   await expect.soft(page).toHaveScreenshot('surface-shell-compact-flyout.png');
      |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
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
```
