# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> 展开侧栏用同一递归能力呈现 Page Archetypes 与 UI Elements（Active Path Anchored Accordion）
- Location: apps\web\e2e\navigation.spec.ts:4:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: getByRole('navigation', { name: '主导航' })
  Expected an image 263px by 538px, received 263px by 640px. 5893 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: surface-shell-parent-navigation.png

Call log:
  - Expect "toHaveScreenshot(surface-shell-parent-navigation.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for getByRole('navigation', { name: '主导航' })
    - locator resolved to <nav aria-label="主导航" class="surface-shell-navigation-viewport min-h-0 flex-1 py-6 space-y-7 px-3">…</nav>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - Expected an image 263px by 538px, received 263px by 640px. 5893 pixels (ratio 0.04 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for getByRole('navigation', { name: '主导航' })
    - locator resolved to <nav aria-label="主导航" class="surface-shell-navigation-viewport min-h-0 flex-1 py-6 space-y-7 px-3">…</nav>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - Expected an image 263px by 538px, received 263px by 640px. 5893 pixels (ratio 0.04 of all image pixels) are different.

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
                            - button "展开或收起Page Archetypes" [expanded] [ref=e70]:
                                - generic [ref=e74]: Page Archetypes
                            - list [ref=e77]:
                                - listitem [ref=e78]:
                                    - link "总览原型" [ref=e79] [cursor=pointer]:
                                        - /url: /page-archetypes/overview
                                - listitem [ref=e84]:
                                    - link "数据工作台" [ref=e85] [cursor=pointer]:
                                        - /url: /page-archetypes/resource-list
                                - listitem [ref=e90]:
                                    - link "详情页" [ref=e91] [cursor=pointer]:
                                        - /url: /page-archetypes/detail
                                - listitem [ref=e96]:
                                    - link "创建与编辑" [ref=e97] [cursor=pointer]:
                                        - /url: /page-archetypes/create-edit
                                - listitem [ref=e102]:
                                    - link "设置页" [ref=e103] [cursor=pointer]:
                                        - /url: /page-archetypes/settings
                                - listitem [ref=e108]:
                                    - link "主从视图" [ref=e109] [cursor=pointer]:
                                        - /url: /page-archetypes/master-detail
                                - listitem [ref=e114]:
                                    - link "操作任务" [ref=e115] [cursor=pointer]:
                                        - /url: /page-archetypes/operation
                        - listitem [ref=e120]:
                            - link "参考资源" [ref=e121] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=e126]:
                            - link "Icon 大全" [ref=e127] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=e134]:
                            - link "基座能力" [ref=e135] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=e148]:
                            - link "Motion" [ref=e149] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=e158]:
                            - link "状态体系" [ref=e159] [cursor=pointer]:
                                - /url: /states
        - generic [ref=e166]:
            - banner [ref=e168]:
                - button "收起侧栏" [ref=e170] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=e172] [cursor=pointer]
                - generic [ref=e173]:
                    - generic [ref=e174]:
                        - button "切换语言" [ref=e175] [cursor=pointer]
                        - button "切换主题" [ref=e176] [cursor=pointer]
                    - button "通知" [ref=e177]
                    - button "当前用户" [ref=e181] [cursor=pointer]:
                        - generic [ref=e183]:
                            - generic "Rin" [ref=e186]: RI
                            - generic [ref=e187]: Rin
            - main [ref=e191]:
                - generic [ref=e194]:
                    - generic [ref=e195]:
                        - list "面包屑导航" [ref=e196]:
                            - listitem [ref=e197]:
                                - link "基座验证" [ref=e198] [cursor=pointer]
                                - generic [ref=e199]: /
                            - listitem [ref=e200]:
                                - link "复杂表单" [disabled]
                        - generic [ref=e201]:
                            - generic [ref=e202]:
                                - paragraph [ref=e203]: Reference · Form
                                - heading "复杂设置与审批表单" [level=1] [ref=e204]
                                - paragraph [ref=e205]: 集中验证 Schema、Tabs、Select、Combobox、DatePicker、错误状态、禁用状态、Pending 与粘性 Footer Action。
                            - generic [ref=e206]: 尚未修改
                    - generic [ref=e209]:
                        - generic [ref=e211]:
                            - generic [ref=e213]:
                                - heading "Reference 配置" [level=2] [ref=e214]
                                - paragraph [ref=e215]: 字段被分组但保持一个表单语义，切换 Tab 不丢失状态。
                            - generic [ref=e218]:
                                - tablist "配置步骤" [ref=e219]:
                                    - tab "基本信息" [selected] [ref=e220] [cursor=pointer]
                                    - tab "行为与时间" [ref=e222] [cursor=pointer]
                                    - tab "复核" [ref=e224] [cursor=pointer]
                                - tabpanel "基本信息" [ref=e226]:
                                    - generic [ref=e228]:
                                        - generic [ref=e229]:
                                            - generic [ref=e230]: 场景名称
                                            - textbox "场景名称" [ref=e231]: 区域发布准备
                                            - generic [ref=e232]: 3 至 80 个字符；用于验证长文本与验证错误。
                                        - generic [ref=e233]:
                                            - generic [ref=e234]:
                                                - generic [ref=e235]: 负责人
                                                - group [ref=e236]:
                                                    - combobox "负责人" [ref=e237]: Lin Chen
                                                    - button "显示建议 负责人" [ref=e238] [cursor=pointer]
                                                - generic [ref=e241]: Combobox 支持键盘筛选与焦点管理。
                                            - generic [ref=e242]:
                                                - generic [ref=e243]: 运行区域
                                                - button "亚太 运行区域" [ref=e244] [cursor=pointer]:
                                                    - generic [ref=e245]: 亚太
                                                - generic [ref=e250]: Select 的 Popup 与页面使用同一套视觉语言。
                                                - combobox [ref=e253]
                                        - generic [ref=e254]:
                                            - generic [ref=e255]: 说明
                                            - textbox "说明" [ref=e256]: 此参考草稿组合校验、浮层、长内容、嵌套区段和固定操作栏。
                                            - generic [ref=e257]: 至少 20 个字符，最多 600 个字符。
                        - complementary [ref=e258]:
                            - generic [ref=e259]:
                                - generic [ref=e265]:
                                    - heading "验证矩阵" [level=2] [ref=e266]
                                    - paragraph [ref=e267]: 当前场景主动覆盖的架构压力点
                                - list [ref=e268]:
                                    - listitem [ref=e269]: Zod 在 Schema 边界保留字段级失败语义。
                                    - listitem [ref=e273]: Select、Combobox 与 DatePicker 继承 React Aria 键盘行为。
                                    - listitem [ref=e277]: Pending 会禁用全部可变控件并保留可见反馈。
                                    - listitem [ref=e281]: 提交保持本地，平台能力通过显式 Port 注入。
                    - generic [ref=e285]:
                        - button "重置" [ref=e286] [cursor=pointer]
                        - button "保存草稿" [ref=e288] [cursor=pointer]
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
> 19  |   await expect(navigation).toHaveScreenshot('surface-shell-parent-navigation.png');
      |                            ^ Error: expect(locator).toHaveScreenshot(expected) failed
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
```
