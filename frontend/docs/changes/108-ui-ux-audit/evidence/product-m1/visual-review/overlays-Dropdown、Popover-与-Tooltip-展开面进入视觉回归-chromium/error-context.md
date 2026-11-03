# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: overlays.spec.ts >> Dropdown、Popover 与 Tooltip 展开面进入视觉回归
- Location: apps\web\e2e\overlays.spec.ts:639:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  10327 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: ui-elements-menu-open.png

Call log:
  - Expect "soft toHaveScreenshot(ui-elements-menu-open.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 10327 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 10327 pixels (ratio 0.02 of all image pixels) are different.

```

```
Error: expect(page).toHaveScreenshot(expected) failed

  10319 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: ui-elements-popover-open.png

Call log:
  - Expect "soft toHaveScreenshot(ui-elements-popover-open.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 10319 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 10319 pixels (ratio 0.02 of all image pixels) are different.

```

```
Error: expect(page).toHaveScreenshot(expected) failed

  10318 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: ui-elements-tooltip-open.png

Call log:
  - Expect "soft toHaveScreenshot(ui-elements-tooltip-open.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 10318 pixels (ratio 0.02 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 10318 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
                            - button "展开或收起UI Elements" [expanded] [ref=e48]:
                                - generic [ref=e55]: UI Elements
                            - list [ref=e58]:
                                - listitem [ref=e59]:
                                    - link "操作与选择" [ref=e60] [cursor=pointer]:
                                        - /url: /ui-elements/actions-selection
                                - listitem [ref=e69]:
                                    - link "反馈" [ref=e70] [cursor=pointer]:
                                        - /url: /ui-elements/feedback
                                - listitem [ref=e75]:
                                    - link "状态与异步" [ref=e76] [cursor=pointer]:
                                        - /url: /ui-elements/status-async
                                - listitem [ref=e81]:
                                    - link "身份与展示" [ref=e82] [cursor=pointer]:
                                        - /url: /ui-elements/identity-display
                                - listitem [ref=e89]:
                                    - link "导航" [ref=e90] [cursor=pointer]:
                                        - /url: /ui-elements/navigation
                                - listitem [ref=e100]:
                                    - link "数据展示" [ref=e101] [cursor=pointer]:
                                        - /url: /ui-elements/data
                                - listitem [ref=e106]:
                                    - link "表面与卡片" [ref=e107] [cursor=pointer]:
                                        - /url: /ui-elements/surfaces
                                - listitem [ref=e112]:
                                    - link "表单控件" [ref=e113] [cursor=pointer]:
                                        - /url: /ui-elements/forms
                                - listitem [ref=e119]:
                                    - link "浮层与弹出界面" [ref=e120] [cursor=pointer]:
                                        - /url: /ui-elements/overlays
                        - listitem [ref=e127]:
                            - button "展开或收起Page Patterns" [ref=e128]:
                                - generic [ref=e135]: Page Patterns
                        - listitem [ref=e138]:
                            - button "展开或收起Page Archetypes" [ref=e139]:
                                - generic [ref=e143]: Page Archetypes
                        - listitem [ref=e146]:
                            - link "参考资源" [ref=e147] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=e152]:
                            - link "Icon 大全" [ref=e153] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=e160]:
                            - link "基座能力" [ref=e161] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=e174]:
                            - link "Motion" [ref=e175] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=e184]:
                            - link "状态体系" [ref=e185] [cursor=pointer]:
                                - /url: /states
        - generic [ref=e192]:
            - banner [ref=e194]:
                - button "收起侧栏" [ref=e196] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=e198] [cursor=pointer]
                - generic [ref=e199]:
                    - generic [ref=e200]:
                        - button "切换语言" [ref=e201] [cursor=pointer]
                        - button "切换主题" [ref=e202] [cursor=pointer]
                    - button "通知" [ref=e203]
                    - button "当前用户" [ref=e207] [cursor=pointer]:
                        - generic [ref=e209]:
                            - generic "Rin" [ref=e212]: RI
                            - generic [ref=e213]: Rin
            - main [ref=e217]:
                - generic [ref=e219]:
                    - generic [ref=e220]:
                        - list "面包屑导航" [ref=e221]:
                            - listitem [ref=e222]:
                                - link "基座验证" [ref=e223] [cursor=pointer]
                                - generic [ref=e224]: /
                            - listitem [ref=e225]:
                                - link "UI Elements" [ref=e226] [cursor=pointer]
                                - generic [ref=e227]: /
                            - listitem [ref=e228]:
                                - link "Overlay 与 Floating Layer" [disabled]
                        - generic [ref=e230]:
                            - paragraph [ref=e231]: UI Elements · Catalog
                            - heading "Overlay 与 Floating Layer" [level=1] [ref=e232]
                            - paragraph [ref=e233]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                    - generic [ref=e234]:
                        - generic [ref=e235]:
                            - generic [ref=e236]: 展示密度
                            - button "舒适 展示密度" [ref=e237] [cursor=pointer]:
                                - generic [ref=e238]: 舒适
                            - combobox [ref=e245]
                        - generic [ref=e247] [cursor=pointer]:
                            - switch "扩展文本" [ref=e249]
                            - generic [ref=e250]:
                                - generic [ref=e251]: 扩展文本
                                - generic [ref=e252]: 切换到极长内容以验证传播范围。
                        - generic [ref=e256] [cursor=pointer]:
                            - switch "English Locale" [ref=e258]
                            - generic [ref=e259]:
                                - generic [ref=e260]: English Locale
                                - generic [ref=e261]: 切换中英文并观察文本扩张与布局。
                    - region "UI Elements 分类导航" [ref=e265]:
                        - generic [ref=e266]:
                            - generic [ref=e267]:
                                - paragraph [ref=e268]: 公开契约目录
                                - heading "Overlay 与 Floating Layer" [level=2] [ref=e269]
                                - paragraph [ref=e270]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                            - generic [ref=e271]: 8 / 公开 Element 46 / 46
                        - navigation "UI Elements 分类导航" [ref=e273]:
                            - link "操作与选择 · 3" [ref=e274] [cursor=pointer]:
                                - /url: /ui-elements/actions-selection
                            - link "反馈 · 4" [ref=e277] [cursor=pointer]:
                                - /url: /ui-elements/feedback
                            - link "状态与异步 · 7" [ref=e280] [cursor=pointer]:
                                - /url: /ui-elements/status-async
                            - link "身份与展示 · 4" [ref=e283] [cursor=pointer]:
                                - /url: /ui-elements/identity-display
                            - link "导航 · 7" [ref=e286] [cursor=pointer]:
                                - /url: /ui-elements/navigation
                            - link "数据展示 · 1" [ref=e289] [cursor=pointer]:
                                - /url: /ui-elements/data
                            - link "表面与卡片 · 2" [ref=e292] [cursor=pointer]:
                                - /url: /ui-elements/surfaces
                            - link "表单控件 · 10" [ref=e295] [cursor=pointer]:
                                - /url: /ui-elements/forms
                            - link "浮层与弹出界面 · 8" [ref=e298] [cursor=pointer]:
                                - /url: /ui-elements/overlays
                    - navigation "本页区段" [ref=e301]:
                        - link "Overlay 与 Floating Layer" [ref=e302] [cursor=pointer]:
                            - /url: /ui-elements/overlays#overlays
                        - link "MenuButton" [ref=e303] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-menubutton
                        - link "MenuButton · Groups / Submenu" [ref=e304] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-menubutton-groups-submenu
                        - link "PopoverCard" [ref=e305] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-popovercard
                        - link "TooltipAction" [ref=e306] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-tooltipaction
                        - link "DialogSurface" [ref=e307] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-dialogsurface
                        - link "ConfirmDialog" [ref=e308] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-confirmdialog
                        - link "DestructiveConfirmDialog" [ref=e309] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-destructiveconfirmdialog
                        - link "DrawerSurface" [ref=e310] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-drawersurface
                        - link "CommandMenu" [ref=e311] [cursor=pointer]:
                            - /url: /ui-elements/overlays#element-commandmenu
                    - generic [ref=e313]:
                        - generic [ref=e315]:
                            - heading "Overlay 与 Floating Layer" [level=2] [ref=e316]
                            - paragraph [ref=e317]: 每个 Trigger 与展开层均由 UI Adapter 组合 HeroUI，并纳入视觉回归。
                        - generic [ref=e319]:
                            - generic [ref=e320]:
                                - generic [ref=e321]:
                                    - generic [ref=e322]:
                                        - heading "MenuButton" [level=3] [ref=e323]
                                        - generic "MenuButton 状态" [ref=e324]:
                                            - generic [ref=e325]: 默认
                                            - generic [ref=e327]: 图标
                                            - generic [ref=e329]: 说明
                                            - generic [ref=e331]: 禁用
                                            - generic [ref=e333]: 危险
                                            - generic [ref=e335]: 键盘
                                    - paragraph [ref=e337]: MenuButton 承载命令集合，区分普通、危险和不可用 Item。
                                - button "Reference 操作菜单" [ref=e339] [cursor=pointer]: Dropdown Menu
                            - generic [ref=e340]:
                                - generic [ref=e341]:
                                    - generic [ref=e342]:
                                        - heading "MenuButton · Groups / Submenu" [level=3] [ref=e343]
                                        - generic "MenuButton · Groups / Submenu 状态" [ref=e344]:
                                            - generic [ref=e345]: 分组
                                            - generic [ref=e347]: 选中
                                            - generic [ref=e349]: 二级菜单
                                            - generic [ref=e351]: 键盘
                                            - generic [ref=e353]: 触摸
                                            - generic [ref=e355]: 碰撞避让
                                    - paragraph [ref=e357]: 分组与二级菜单
                                - button "分组与二级菜单" [ref=e359] [cursor=pointer]
                            - generic [ref=e360]:
                                - generic [ref=e361]:
                                    - generic [ref=e362]:
                                        - heading "PopoverCard" [level=3] [ref=e363]
                                        - generic "PopoverCard 状态" [ref=e364]:
                                            - generic [ref=e365]: 触发器
                                            - generic [ref=e367]: 标题
                                            - generic [ref=e369]: 长内容
                                            - generic [ref=e371]: 焦点返回
                                            - generic [ref=e373]: 碰撞避让
                                    - paragraph [ref=e375]: PopoverCard 承载与 Trigger 相关的可交互短内容，不替代 Tooltip 或 Dialog。
                                - button "Popover" [ref=e377] [cursor=pointer]
                            - generic [ref=e378]:
                                - generic [ref=e379]:
                                    - generic [ref=e380]:
                                        - heading "TooltipAction" [level=3] [ref=e381]
                                        - generic "TooltipAction 状态" [ref=e382]:
                                            - generic [ref=e383]: 悬停
                                            - generic [ref=e385]: 焦点
                                            - generic [ref=e387]: 延迟
                                            - generic [ref=e389]: Escape 键
                                            - generic [ref=e391]: 非交互内容
                                    - paragraph [ref=e393]: Tooltip 只提供简短非交互说明，同时支持 Hover 与 Keyboard Focus。
                                - generic [ref=e394]:
                                    - button "Tooltip" [active] [ref=e395]
                                    - generic [ref=e396]:
                                        - link "组合提示" [ref=e397] [cursor=pointer]:
                                            - /url: '#element-popovercard'
                                        - button "Overlay 与 Floating Layer" [ref=e401] [cursor=pointer]
                            - generic [ref=e408]:
                                - generic [ref=e409]:
                                    - generic [ref=e410]:
                                        - heading "DialogSurface" [level=3] [ref=e411]
                                        - generic "DialogSurface 状态" [ref=e412]:
                                            - generic [ref=e413]: 表单内容
                                            - generic [ref=e415]: 取消
                                            - generic [ref=e417]: 确认
                                            - generic [ref=e419]: 提交中
                                            - generic [ref=e421]: 失败
                                            - generic [ref=e423]: 焦点隔离
                                    - paragraph [ref=e425]: DialogSurface 承载普通表单决策，并统一焦点、Pending、失败与 Footer。
                                - button "Dialog" [ref=e427] [cursor=pointer]
                            - generic [ref=e428]:
                                - generic [ref=e429]:
                                    - generic [ref=e430]:
                                        - heading "ConfirmDialog" [level=3] [ref=e431]
                                        - generic "ConfirmDialog 状态" [ref=e432]:
                                            - generic [ref=e433]: 影响范围
                                            - generic [ref=e435]: 取消
                                            - generic [ref=e437]: 确认
                                            - generic [ref=e439]: 禁用
                                            - generic [ref=e441]: 提交中
                                            - generic [ref=e443]: 失败
                                    - paragraph [ref=e445]: ConfirmDialog 用于需要显式确认的普通决策，并呈现影响范围。
                                - button "普通确认" [ref=e447] [cursor=pointer]
                            - generic [ref=e448]:
                                - generic [ref=e449]:
                                    - generic [ref=e450]:
                                        - heading "DestructiveConfirmDialog" [level=3] [ref=e451]
                                        - generic "DestructiveConfirmDialog 状态" [ref=e452]:
                                            - generic [ref=e453]: 危险语义
                                            - generic [ref=e455]: 影响范围
                                            - generic [ref=e457]: 提交中
                                            - generic [ref=e459]: 失败
                                            - generic [ref=e461]: 焦点恢复
                                    - paragraph [ref=e463]: Destructive Confirm 以危险语义强调不可逆后果，不与普通确认共用视觉。
                                - button "危险确认" [ref=e465] [cursor=pointer]
                            - generic [ref=e466]:
                                - generic [ref=e467]:
                                    - generic [ref=e468]:
                                        - heading "DrawerSurface" [level=3] [ref=e469]
                                        - generic "DrawerSurface 状态" [ref=e470]:
                                            - generic [ref=e471]: 右侧抽屉
                                            - generic [ref=e473]: 标题与正文
                                            - generic [ref=e475]: 关闭
                                            - generic [ref=e477]: 滚动
                                            - generic [ref=e479]: 窄视口
                                    - paragraph [ref=e481]: Drawer 在侧边承载辅助任务，拥有独立 Header、Body、关闭和滚动边界。
                                - button "Drawer" [ref=e483] [cursor=pointer]
                            - generic [ref=e484]:
                                - generic [ref=e485]:
                                    - generic [ref=e486]:
                                        - heading "CommandMenu" [level=3] [ref=e487]
                                        - generic "CommandMenu 状态" [ref=e488]:
                                            - generic [ref=e489]: 搜索
                                            - generic [ref=e491]: 已筛选
                                            - generic [ref=e493]: 空状态
                                            - generic [ref=e495]: 键盘操作
                                            - generic [ref=e497]: 模态焦点
                                    - paragraph [ref=e499]: CommandMenu 组合搜索、过滤、空结果和键盘命令执行。
                                - button "Command" [ref=e501] [cursor=pointer]
    - tooltip "键盘聚焦与悬停均可访问" [ref=e502]
```

# Test source

```ts
  584 |   });
  585 |   expect(multiGeom.length).toBeGreaterThanOrEqual(2);
  586 |   for (const item of multiGeom) {
  587 |     // 独立几何：四边 border 完整、radius 完整（无 attached 中间项/首尾裁剪）
  588 |     expect(item.borderTop).not.toBe('0px');
  589 |     expect(item.borderRight).not.toBe('0px');
  590 |     expect(item.borderBottom).not.toBe('0px');
  591 |     expect(item.borderLeft).not.toBe('0px');
  592 |     expect(item.radius).not.toBe('0px');
  593 |   }
  594 |   // items 之间有 semantic gap（> 0）
  595 |   for (let i = 1; i < multiGeom.length; i += 1) {
  596 |     expect(multiGeom[i]?.gapToPrev ?? 0).toBeGreaterThan(0);
  597 |   }
  598 | });
  599 |
  600 | test('Select 与 Combobox 使用统一 Popup、键盘和选中状态', async ({ page }) => {
  601 |   await page.goto('/ui-elements/forms');
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
> 684 |   await expect.soft(page).toHaveScreenshot('ui-elements-tooltip-open.png');
      |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
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
  702 |   await expect.soft(page).toHaveScreenshot('ui-elements-date-picker-open.png');
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
```
