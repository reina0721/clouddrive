# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: overlays.spec.ts >> DatePicker 与 Command 展开面支持键盘及无障碍扫描
- Location: apps\web\e2e\overlays.spec.ts:687:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  9862 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: ui-elements-date-picker-open.png

Call log:
  - Expect "soft toHaveScreenshot(ui-elements-date-picker-open.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 9862 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 9862 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
    - button "Open Next.js Dev Tools" [ref=f1e7] [cursor=pointer]
    - alert [ref=f1e11]
    - link "跳到主要内容 / Skip to content" [ref=f1e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=f1e13]:
        - complementary [ref=f1e14]:
            - generic [ref=f1e15]:
                - generic [ref=f1e16]: C
                - generic [ref=f1e18]:
                    - paragraph [ref=f1e19]: clouddrive
                    - paragraph [ref=f1e20]: 管理工作空间
            - navigation "主导航" [ref=f1e21]:
                - generic [ref=f1e22]:
                    - paragraph [ref=f1e23]: 工作空间
                    - list "工作空间" [ref=f1e24]:
                        - listitem [ref=f1e25]:
                            - link "工作台" [ref=f1e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=f1e34]:
                    - paragraph [ref=f1e35]: 个人
                    - list "个人" [ref=f1e36]:
                        - listitem [ref=f1e37]:
                            - link "个人偏好" [ref=f1e38] [cursor=pointer]:
                                - /url: /settings
                - generic [ref=f1e44]:
                    - paragraph [ref=f1e45]: 开发中心
                    - list "开发中心" [ref=f1e46]:
                        - listitem [ref=f1e47]:
                            - button "展开或收起UI Elements" [expanded] [ref=f1e48]:
                                - generic [ref=f1e55]: UI Elements
                            - list [ref=f1e58]:
                                - listitem [ref=f1e59]:
                                    - link "操作与选择" [ref=f1e60] [cursor=pointer]:
                                        - /url: /ui-elements/actions-selection
                                - listitem [ref=f1e69]:
                                    - link "反馈" [ref=f1e70] [cursor=pointer]:
                                        - /url: /ui-elements/feedback
                                - listitem [ref=f1e75]:
                                    - link "状态与异步" [ref=f1e76] [cursor=pointer]:
                                        - /url: /ui-elements/status-async
                                - listitem [ref=f1e81]:
                                    - link "身份与展示" [ref=f1e82] [cursor=pointer]:
                                        - /url: /ui-elements/identity-display
                                - listitem [ref=f1e89]:
                                    - link "导航" [ref=f1e90] [cursor=pointer]:
                                        - /url: /ui-elements/navigation
                                - listitem [ref=f1e100]:
                                    - link "数据展示" [ref=f1e101] [cursor=pointer]:
                                        - /url: /ui-elements/data
                                - listitem [ref=f1e106]:
                                    - link "表面与卡片" [ref=f1e107] [cursor=pointer]:
                                        - /url: /ui-elements/surfaces
                                - listitem [ref=f1e112]:
                                    - link "表单控件" [ref=f1e113] [cursor=pointer]:
                                        - /url: /ui-elements/forms
                                - listitem [ref=f1e119]:
                                    - link "浮层与弹出界面" [ref=f1e120] [cursor=pointer]:
                                        - /url: /ui-elements/overlays
                        - listitem [ref=f1e127]:
                            - button "展开或收起Page Patterns" [ref=f1e128]:
                                - generic [ref=f1e135]: Page Patterns
                        - listitem [ref=f1e138]:
                            - button "展开或收起Page Archetypes" [ref=f1e139]:
                                - generic [ref=f1e143]: Page Archetypes
                        - listitem [ref=f1e146]:
                            - link "参考资源" [ref=f1e147] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=f1e152]:
                            - link "Icon 大全" [ref=f1e153] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=f1e160]:
                            - link "基座能力" [ref=f1e161] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f1e174]:
                            - link "Motion" [ref=f1e175] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f1e184]:
                            - link "状态体系" [ref=f1e185] [cursor=pointer]:
                                - /url: /states
        - generic [ref=f1e192]:
            - banner [ref=f1e194]:
                - button "收起侧栏" [ref=f1e196] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f1e198] [cursor=pointer]
                - generic [ref=f1e199]:
                    - generic [ref=f1e200]:
                        - button "切换语言" [ref=f1e201] [cursor=pointer]
                        - button "切换主题" [ref=f1e202] [cursor=pointer]
                    - button "通知" [ref=f1e203]
                    - button "当前用户" [ref=f1e207] [cursor=pointer]:
                        - generic [ref=f1e209]:
                            - generic "Rin" [ref=f1e212]: RI
                            - generic [ref=f1e213]: Rin
            - main [ref=f1e217]:
                - generic [ref=f1e219]:
                    - generic [ref=f1e220]:
                        - list "面包屑导航" [ref=f1e221]:
                            - listitem [ref=f1e222]:
                                - link "基座验证" [ref=f1e223] [cursor=pointer]
                                - generic [ref=f1e224]: /
                            - listitem [ref=f1e225]:
                                - link "UI Elements" [ref=f1e226] [cursor=pointer]
                                - generic [ref=f1e227]: /
                            - listitem [ref=f1e228]:
                                - link "Overlay 与 Floating Layer" [disabled]
                        - generic [ref=f1e230]:
                            - paragraph [ref=f1e231]: UI Elements · Catalog
                            - heading "Overlay 与 Floating Layer" [level=1] [ref=f1e232]
                            - paragraph [ref=f1e233]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                    - generic [ref=f1e234]:
                        - generic [ref=f1e235]:
                            - generic [ref=f1e236]: 展示密度
                            - button "舒适 展示密度" [ref=f1e237] [cursor=pointer]:
                                - generic [ref=f1e238]: 舒适
                            - combobox [ref=f1e245]
                        - generic [ref=f1e247] [cursor=pointer]:
                            - switch "扩展文本" [ref=f1e249]
                            - generic [ref=f1e250]:
                                - generic [ref=f1e251]: 扩展文本
                                - generic [ref=f1e252]: 切换到极长内容以验证传播范围。
                        - generic [ref=f1e256] [cursor=pointer]:
                            - switch "English Locale" [ref=f1e258]
                            - generic [ref=f1e259]:
                                - generic [ref=f1e260]: English Locale
                                - generic [ref=f1e261]: 切换中英文并观察文本扩张与布局。
                    - region "UI Elements 分类导航" [ref=f1e265]:
                        - generic [ref=f1e266]:
                            - generic [ref=f1e267]:
                                - paragraph [ref=f1e268]: 公开契约目录
                                - heading "Overlay 与 Floating Layer" [level=2] [ref=f1e269]
                                - paragraph [ref=f1e270]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                            - generic [ref=f1e271]: 8 / 公开 Element 46 / 46
                        - navigation "UI Elements 分类导航" [ref=f1e273]:
                            - link "操作与选择 · 3" [ref=f1e274] [cursor=pointer]:
                                - /url: /ui-elements/actions-selection
                            - link "反馈 · 4" [ref=f1e277] [cursor=pointer]:
                                - /url: /ui-elements/feedback
                            - link "状态与异步 · 7" [ref=f1e280] [cursor=pointer]:
                                - /url: /ui-elements/status-async
                            - link "身份与展示 · 4" [ref=f1e283] [cursor=pointer]:
                                - /url: /ui-elements/identity-display
                            - link "导航 · 7" [ref=f1e286] [cursor=pointer]:
                                - /url: /ui-elements/navigation
                            - link "数据展示 · 1" [ref=f1e289] [cursor=pointer]:
                                - /url: /ui-elements/data
                            - link "表面与卡片 · 2" [ref=f1e292] [cursor=pointer]:
                                - /url: /ui-elements/surfaces
                            - link "表单控件 · 10" [ref=f1e295] [cursor=pointer]:
                                - /url: /ui-elements/forms
                            - link "浮层与弹出界面 · 8" [ref=f1e298] [cursor=pointer]:
                                - /url: /ui-elements/overlays
                    - navigation "本页区段" [ref=f1e301]:
                        - link "Overlay 与 Floating Layer" [ref=f1e302] [cursor=pointer]:
                            - /url: /ui-elements/overlays#overlays
                        - link "MenuButton" [ref=f1e303] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-menubutton
                        - link "MenuButton · Groups / Submenu" [ref=f1e304] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-menubutton-groups-submenu
                        - link "PopoverCard" [ref=f1e305] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-popovercard
                        - link "TooltipAction" [ref=f1e306] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-tooltipaction
                        - link "DialogSurface" [ref=f1e307] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-dialogsurface
                        - link "ConfirmDialog" [ref=f1e308] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-confirmdialog
                        - link "DestructiveConfirmDialog" [ref=f1e309] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-destructiveconfirmdialog
                        - link "DrawerSurface" [ref=f1e310] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-drawersurface
                        - link "CommandMenu" [ref=f1e311] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-commandmenu
                    - generic [ref=f1e313]:
                        - generic [ref=f1e315]:
                            - heading "Overlay 与 Floating Layer" [level=2] [ref=f1e316]
                            - paragraph [ref=f1e317]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                        - generic [ref=f1e319]:
                            - generic [ref=f1e320]:
                                - generic [ref=f1e321]:
                                    - generic [ref=f1e322]:
                                        - heading "MenuButton" [level=3] [ref=f1e323]
                                        - generic "MenuButton 状态" [ref=f1e324]:
                                            - generic [ref=f1e325]: 默认
                                            - generic [ref=f1e327]: 图标
                                            - generic [ref=f1e329]: 说明
                                            - generic [ref=f1e331]: 禁用
                                            - generic [ref=f1e333]: 危险
                                            - generic [ref=f1e335]: 键盘
                                    - paragraph [ref=f1e337]: MenuButton 承载命令集合，区分普通、危险和不可用 Item。
                                - button "Reference 操作菜单" [ref=f1e339] [cursor=pointer]: Dropdown Menu
                            - generic [ref=f1e340]:
                                - generic [ref=f1e341]:
                                    - generic [ref=f1e342]:
                                        - heading "MenuButton · Groups / Submenu" [level=3] [ref=f1e343]
                                        - generic "MenuButton · Groups / Submenu 状态" [ref=f1e344]:
                                            - generic [ref=f1e345]: 分组
                                            - generic [ref=f1e347]: 选中
                                            - generic [ref=f1e349]: 二级菜单
                                            - generic [ref=f1e351]: 键盘
                                            - generic [ref=f1e353]: 触摸
                                            - generic [ref=f1e355]: 碰撞避让
                                    - paragraph [ref=f1e357]: 分组与二级菜单
                                - button "分组与二级菜单" [ref=f1e359] [cursor=pointer]
                            - generic [ref=f1e360]:
                                - generic [ref=f1e361]:
                                    - generic [ref=f1e362]:
                                        - heading "PopoverCard" [level=3] [ref=f1e363]
                                        - generic "PopoverCard 状态" [ref=f1e364]:
                                            - generic [ref=f1e365]: 触发器
                                            - generic [ref=f1e367]: 标题
                                            - generic [ref=f1e369]: 长内容
                                            - generic [ref=f1e371]: 焦点返回
                                            - generic [ref=f1e373]: 碰撞避让
                                    - paragraph [ref=f1e375]: PopoverCard 承载与 Trigger 相关的可交互短内容，不替代 Tooltip 或 Dialog。
                                - button "Popover" [ref=f1e377] [cursor=pointer]
                            - generic [ref=f1e378]:
                                - generic [ref=f1e379]:
                                    - generic [ref=f1e380]:
                                        - heading "TooltipAction" [level=3] [ref=f1e381]
                                        - generic "TooltipAction 状态" [ref=f1e382]:
                                            - generic [ref=f1e383]: 悬停
                                            - generic [ref=f1e385]: 焦点
                                            - generic [ref=f1e387]: 延迟
                                            - generic [ref=f1e389]: Escape 键
                                            - generic [ref=f1e391]: 非交互内容
                                    - paragraph [ref=f1e393]: Tooltip 只提供简短非交互说明，同时支持 Hover 与 Keyboard Focus。
                                - generic [ref=f1e394]:
                                    - button "Tooltip" [ref=f1e395]
                                    - generic [ref=f1e396]:
                                        - link "组合提示" [ref=f1e397] [cursor=pointer]:
                                            - /url: '#element-popovercard'
                                        - button "Overlay 与 Floating Layer" [ref=f1e401] [cursor=pointer]
                            - generic [ref=f1e408]:
                                - generic [ref=f1e409]:
                                    - generic [ref=f1e410]:
                                        - heading "DialogSurface" [level=3] [ref=f1e411]
                                        - generic "DialogSurface 状态" [ref=f1e412]:
                                            - generic [ref=f1e413]: 表单内容
                                            - generic [ref=f1e415]: 取消
                                            - generic [ref=f1e417]: 确认
                                            - generic [ref=f1e419]: 提交中
                                            - generic [ref=f1e421]: 失败
                                            - generic [ref=f1e423]: 焦点隔离
                                    - paragraph [ref=f1e425]: DialogSurface 承载普通表单决策，并统一焦点、Pending、失败与 Footer。
                                - button "Dialog" [ref=f1e427] [cursor=pointer]
                            - generic [ref=f1e428]:
                                - generic [ref=f1e429]:
                                    - generic [ref=f1e430]:
                                        - heading "ConfirmDialog" [level=3] [ref=f1e431]
                                        - generic "ConfirmDialog 状态" [ref=f1e432]:
                                            - generic [ref=f1e433]: 影响范围
                                            - generic [ref=f1e435]: 取消
                                            - generic [ref=f1e437]: 确认
                                            - generic [ref=f1e439]: 禁用
                                            - generic [ref=f1e441]: 提交中
                                            - generic [ref=f1e443]: 失败
                                    - paragraph [ref=f1e445]: ConfirmDialog 用于需要显式确认的普通决策，并呈现影响范围。
                                - button "普通确认" [ref=f1e447] [cursor=pointer]
                            - generic [ref=f1e448]:
                                - generic [ref=f1e449]:
                                    - generic [ref=f1e450]:
                                        - heading "DestructiveConfirmDialog" [level=3] [ref=f1e451]
                                        - generic "DestructiveConfirmDialog 状态" [ref=f1e452]:
                                            - generic [ref=f1e453]: 危险语义
                                            - generic [ref=f1e455]: 影响范围
                                            - generic [ref=f1e457]: 提交中
                                            - generic [ref=f1e459]: 失败
                                            - generic [ref=f1e461]: 焦点恢复
                                    - paragraph [ref=f1e463]: Destructive Confirm 以危险语义强调不可逆后果，不与普通确认共用视觉。
                                - button "危险确认" [ref=f1e465] [cursor=pointer]
                            - generic [ref=f1e466]:
                                - generic [ref=f1e467]:
                                    - generic [ref=f1e468]:
                                        - heading "DrawerSurface" [level=3] [ref=f1e469]
                                        - generic "DrawerSurface 状态" [ref=f1e470]:
                                            - generic [ref=f1e471]: 右侧抽屉
                                            - generic [ref=f1e473]: 标题与正文
                                            - generic [ref=f1e475]: 关闭
                                            - generic [ref=f1e477]: 滚动
                                            - generic [ref=f1e479]: 窄视口
                                    - paragraph [ref=f1e481]: Drawer 在侧边承载辅助任务，拥有独立 Header、Body、关闭和滚动边界。
                                - button "Drawer" [ref=f1e483] [cursor=pointer]
                            - generic [ref=f1e484]:
                                - generic [ref=f1e485]:
                                    - generic [ref=f1e486]:
                                        - heading "CommandMenu" [level=3] [ref=f1e487]
                                        - generic "CommandMenu 状态" [ref=f1e488]:
                                            - generic [ref=f1e489]: 搜索
                                            - generic [ref=f1e491]: 已筛选
                                            - generic [ref=f1e493]: 空状态
                                            - generic [ref=f1e495]: 键盘操作
                                            - generic [ref=f1e497]: 模态焦点
                                    - paragraph [ref=f1e499]: CommandMenu 组合搜索、过滤、空结果和键盘命令执行。
                                - button "Command" [expanded] [ref=f1e501] [cursor=pointer]
    - generic [ref=f1e502]:
        - generic:
            - generic:
                - button "取消"
            - dialog [ref=f1e503]:
                - heading "快速跳转" [level=2] [ref=f1e504]
                - generic [ref=f1e505]:
                    - group [ref=f1e508]:
                        - searchbox "搜索命令" [active] [ref=f1e509]: 状态
                        - button "Close" [ref=f1e510] [cursor=pointer]
                    - listbox "快速跳转" [ref=f1e511]:
                        - option "状态体系 跳转到状态体系验证场景。" [ref=f1e512]:
                            - generic [ref=f1e513]:
                                - generic: 状态体系
                                - generic [ref=f1e514]: 跳转到状态体系验证场景。
```

# Test source

```ts
  602 |   await page.getByRole('button', { name: '引导执行 Select' }).click();
  603 |   const selectListbox = page.getByRole('listbox');
  604 |   await expect(selectListbox).toBeVisible();
  605 |   await expect(page.getByRole('option', { name: '自动执行' })).toBeDisabled();
  606 |   await assertMatchesTriggerWidth(page, 'select-popover');
  607 |   await assertListboxScrolls(page);
  608 |   await expect(page.getByRole('option', { name: '执行队列 12' })).toBeVisible();
  609 |   await expect.soft(page).toHaveScreenshot('ui-elements-select-open.png');
  610 |   await page.keyboard.press('Enter');
  611 |   await expect(page.getByRole('button', { name: '执行队列 12 Select' })).toBeVisible();
  612 |
  613 |   const combo = page.getByRole('combobox', { name: 'Combobox' });
  614 |   await combo.click();
  615 |   await expect(page.getByRole('option', { name: 'Omar Haddad' })).toBeDisabled();
  616 |   await assertMatchesTriggerWidth(page, 'combo-box-popover');
  617 |   await assertListboxScrolls(page);
  618 |
  619 |   // ComboField 只有一个 Field Surface：InputGroup 不承担边框/阴影，边框落在内部 Input 上
  620 |   const comboInputGroup = page.locator('[data-slot="combo-box-input-group"]').first();
  621 |   await expect(comboInputGroup).not.toHaveClass(/ui-field-control/);
  622 |   const comboSurface = page
  623 |     .locator('[data-slot="combo-box-input-group"] [data-slot="input"]')
  624 |     .first();
  625 |   await expect(comboSurface).toHaveClass(/ui-field-control/);
  626 |
  627 |   await page.keyboard.press('Escape');
  628 |   await combo.click();
  629 |   await combo.fill('Mika');
  630 |   await expect(page.getByRole('option', { name: 'Mika Sato' })).toBeVisible();
  631 |   await assertMatchesTriggerWidth(page, 'combo-box-popover');
  632 |   await expect.soft(page).toHaveScreenshot('ui-elements-combobox-open.png');
  633 |   await page.keyboard.press('ArrowDown');
  634 |   await page.keyboard.press('Enter');
  635 |   await expect(combo).toHaveValue('Mika Sato');
  636 |   await assertOverlayAccessibility(page);
  637 | });
  638 |
  639 | test('Dropdown、Popover 与 Tooltip 展开面进入视觉回归', async ({ page }) => {
  640 |   await page.goto('/ui-elements/overlays');
  641 |   const menuTrigger = page.getByRole('button', { name: 'Reference 操作菜单' });
  642 |   await menuTrigger.click();
  643 |   await expect(page.getByRole('menu')).toBeVisible();
  644 |   await expect.soft(page).toHaveScreenshot('ui-elements-menu-open.png');
  645 |   await page.keyboard.press('Escape');
  646 |   await expect(menuTrigger).toBeFocused();
  647 |
  648 |   const popoverTrigger = page.getByRole('button', { name: 'Popover' });
  649 |   const pageHeightBeforeOpen = await page
  650 |     .locator('html')
  651 |     .evaluate((element) => element.scrollHeight);
  652 |   await popoverTrigger.click();
  653 |   const popover = page.getByRole('dialog', { name: '组合提示' });
  654 |   await expect(popover).toBeVisible();
  655 |   // The reference grows as capabilities are added; collision handling may flip the overlay above.
  656 |   await expect
  657 |     .poll(async () => {
  658 |       const anchor = await popoverTrigger.evaluate((element) => element.getBoundingClientRect());
  659 |       const overlay = await popover.evaluate((element) => element.getBoundingClientRect());
  660 |       const viewport = page.viewportSize();
  661 |       return (
  662 |         viewport !== null &&
  663 |         overlay.left >= 0 &&
  664 |         overlay.right <= viewport.width &&
  665 |         overlay.top >= 0 &&
  666 |         overlay.bottom <= viewport.height &&
  667 |         (overlay.top >= anchor.bottom || overlay.bottom <= anchor.top)
  668 |       );
  669 |     })
  670 |     .toBe(true);
  671 |   await expect(popover).toBeFocused();
  672 |   const pageHeightAfterOpen = await page
  673 |     .locator('html')
  674 |     .evaluate((element) => element.scrollHeight);
  675 |   expect(pageHeightAfterOpen).toBe(pageHeightBeforeOpen);
  676 |   await expect.soft(page).toHaveScreenshot('ui-elements-popover-open.png');
  677 |   await page.keyboard.press('Escape');
  678 |   await expect(popover).toBeHidden();
  679 |   await expect(popoverTrigger).toBeFocused();
  680 |
  681 |   const tooltipTrigger = page.getByRole('button', { name: 'Tooltip' });
  682 |   await tooltipTrigger.focus();
  683 |   await expect(page.getByRole('tooltip')).toBeVisible();
  684 |   await expect.soft(page).toHaveScreenshot('ui-elements-tooltip-open.png');
  685 | });
  686 |
  687 | test('DatePicker 与 Command 展开面支持键盘及无障碍扫描', async ({ page }) => {
  688 |   await page.goto('/ui-elements/forms');
  689 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  690 |   const datePickerTrigger = page.getByRole('button', { name: '日历 DatePicker' });
  691 |   // Focus entry stabilizes the project's Reveal before measuring the offscreen anchor.
  692 |   await datePickerTrigger.focus();
  693 |   // 触发元素位于首屏之外：先滚动进入视口再点击，避免打开弹层时的滚动定位竞态
  694 |   // （页面转场组件加入后，点击视口外触发器会偶发改变锚点测量结果）
  695 |   await datePickerTrigger.evaluate((element) =>
  696 |     element.scrollIntoView({ behavior: 'instant', block: 'center' }),
  697 |   );
  698 |   await datePickerTrigger.click();
  699 |   await expect(page.getByRole('dialog')).toBeVisible();
  700 |   await expect(page.getByRole('dialog').getByRole('grid')).toBeVisible();
  701 |   await waitForVisualReadiness(page);
> 702 |   await expect.soft(page).toHaveScreenshot('ui-elements-date-picker-open.png');
      |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
  703 |   await page.keyboard.press('Escape');
  704 |
  705 |   await page.goto('/ui-elements/overlays');
  706 |   await page.getByRole('button', { name: 'Command' }).click();
  707 |   const commandDialog = page.getByRole('dialog');
  708 |   await expect(commandDialog).toContainText('快速跳转');
  709 |   // CommandMenu 复用 SearchBox：输入框是 SearchField.Input，不再出现嵌套的通用 data-slot="input"
  710 |   await expect(commandDialog.locator('[data-slot="search-field-input"]')).toHaveCount(1);
  711 |   await expect(commandDialog.locator('[data-slot="input"]')).toHaveCount(0);
  712 |   await page.getByLabel('搜索命令').fill('状态');
  713 |   await expect(page.getByRole('option', { name: /状态体系/ })).toBeVisible();
  714 |   await assertOverlayAccessibility(page);
  715 |   await expect.soft(page).toHaveScreenshot('ui-elements-command-open.png');
  716 | });
  717 |
  718 | test('Dialog 与 Drawer 锁定焦点并支持 Escape 恢复 Trigger', async ({ page }) => {
  719 |   await page.goto('/ui-elements/overlays');
  720 |   const dialogTrigger = page.getByRole('button', { name: 'Dialog' });
  721 |   await dialogTrigger.click();
  722 |   const dialog = page.getByRole('dialog');
  723 |   await expect(dialog).toBeVisible();
  724 |   await page.keyboard.press('Tab');
  725 |   await expect(dialog.locator(':focus')).toHaveCount(1);
  726 |   await waitForVisualReadiness(page);
  727 |   await expect.soft(page).toHaveScreenshot('ui-elements-dialog-open.png');
  728 |   await page.keyboard.press('Escape');
  729 |   await expect(dialogTrigger).toBeFocused();
  730 |
  731 |   const drawerTrigger = page.getByRole('button', { name: 'Drawer' });
  732 |   await drawerTrigger.click();
  733 |   const drawer = page.getByRole('dialog');
  734 |   await expect(drawer).toContainText('辅助配置');
  735 |   await assertOverlayAccessibility(page);
  736 |   await expect.soft(page).toHaveScreenshot('ui-elements-drawer-open.png');
  737 |   await page.keyboard.press('Escape');
  738 |   await expect(drawerTrigger).toBeFocused();
  739 | });
  740 |
  741 | test('Overlay Trigger 交互状态不切换成 Brand Primary（idle/hover/pressed/focus-restored）', async ({
  742 |   page,
  743 | }) => {
  744 |   await page.goto('/ui-elements/overlays');
  745 |
  746 |   // 五类 trigger 的语义断言：底层必须是 ghost variant，绝不带 button--primary
  747 |   const triggerNames = ['Dialog', '普通确认', '危险确认', 'Drawer', 'Command'] as const;
  748 |   for (const name of triggerNames) {
  749 |     const trigger = page.getByRole('button', { name, exact: true });
  750 |     await expect(trigger).toBeVisible();
  751 |     const cls = (await trigger.getAttribute('class')) ?? '';
  752 |     expect(cls).toContain('button--ghost');
  753 |     expect(cls).not.toContain('button--primary');
  754 |     // 语义色断言：danger trigger 用 danger 语义，其它用中性（不用 bg-brand）
  755 |     if (name === '危险确认') {
  756 |       expect(cls).toContain('text-danger');
  757 |     } else {
  758 |       expect(cls).toContain('bg-surface');
  759 |       expect(cls).not.toContain('text-brand');
  760 |     }
  761 |   }
  762 |
  763 |   // Dialog：pressed（mouse down）与 focus-restored 后背景保持中性（非 accent 蓝填充）
  764 |   const dialogTrigger = page.getByRole('button', { name: 'Dialog', exact: true });
  765 |   const readBg = () =>
  766 |     dialogTrigger.evaluate((el) => {
  767 |       const cs = getComputedStyle(el);
  768 |       return {
  769 |         bg: cs.backgroundColor,
  770 |         cls: (el.getAttribute('class') ?? '').split(' ').filter((c) => c.includes('button--')),
  771 |       };
  772 |     });
  773 |
  774 |   const idle = await readBg();
  775 |   expect(idle.bg).toBe('rgb(255, 255, 255)');
  776 |
  777 |   // pressed：mouse down 不释放，背景不得变 accent 蓝（保持中性或 muted 反馈）
  778 |   const box = (await dialogTrigger.boundingBox())!;
  779 |   await page.mouse.move(box.x + 30, box.y + 15);
  780 |   await page.mouse.down();
  781 |   await page.waitForTimeout(120);
  782 |   const pressed = await readBg();
  783 |   // 允许中性按下反馈（surface-muted 灰），但绝不能是 HeroUI accent 蓝（oklch hue≈253 渲染值）
  784 |   expect(pressed.cls).not.toContain('button--primary');
  785 |   await page.mouse.up();
  786 |
  787 |   // 打开 Dialog 再 Escape 关闭（focus restore 到 trigger）：背景仍中性，无蓝色残留
  788 |   await dialogTrigger.click();
  789 |   await expect(page.getByRole('dialog')).toBeVisible();
  790 |   await page.keyboard.press('Escape');
  791 |   await expect(dialogTrigger).toBeFocused();
  792 |   await page.waitForTimeout(200);
  793 |   const restored = await readBg();
  794 |   expect(restored.cls).not.toContain('button--primary');
  795 |   // 中性 hover 反馈（surface-muted）或回到 idle 白皆可；绝不出现 brand 蓝实色
  796 |   const muted = await page.evaluate(() => {
  797 |     const probe = document.createElement('span');
  798 |     probe.style.backgroundColor = 'var(--color-surface-muted)';
  799 |     document.body.append(probe);
  800 |     const color = getComputedStyle(probe).backgroundColor;
  801 |     probe.remove();
  802 |     return color;
```
