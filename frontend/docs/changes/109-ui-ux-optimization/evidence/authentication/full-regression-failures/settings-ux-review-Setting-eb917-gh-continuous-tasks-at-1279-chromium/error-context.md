# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-ux-review.spec.ts >> Settings category navigation stays reachable through continuous tasks at 1279
- Location: apps\web\e2e\settings-ux-review.spec.ts:435:3

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 210
Received:   295
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
                    - paragraph [ref=e19]: Community
                    - paragraph [ref=e20]: 统一前端基座
            - navigation "主导航" [ref=e21]:
                - generic [ref=e22]:
                    - paragraph [ref=e23]: Universal Foundation
                    - list [ref=e24]:
                        - listitem [ref=e25]:
                            - link "总览" [ref=e26] [cursor=pointer]:
                                - /url: /
                - generic [ref=e33]:
                    - paragraph [ref=e34]: 系统
                    - list [ref=e35]:
                        - listitem [ref=e36]:
                            - link "设置" [ref=e37] [cursor=pointer]:
                                - /url: /settings
                        - listitem [ref=e42]:
                            - link "Icon 大全" [ref=e43] [cursor=pointer]:
                                - /url: /system-tools/icons
                - generic [ref=e48]:
                    - paragraph [ref=e49]: 参考资源
                    - list [ref=e50]:
                        - listitem [ref=e51]:
                            - link "参考资源" [ref=e52] [cursor=pointer]:
                                - /url: /reference-resources
                - generic [ref=e56]:
                    - paragraph [ref=e57]: 开发
                    - list [ref=e58]:
                        - listitem [ref=e59]:
                            - link "基座能力" [ref=e60] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=e72]:
                            - link "Motion" [ref=e73] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=e77]:
                            - button "展开或收起Page Archetypes" [ref=e78]:
                                - generic [ref=e81]: Page Archetypes
                        - listitem [ref=e84]:
                            - button "展开或收起Page Patterns" [ref=e85]:
                                - generic [ref=e91]: Page Patterns
                        - listitem [ref=e94]:
                            - link "状态体系" [ref=e95] [cursor=pointer]:
                                - /url: /states
                        - listitem [ref=e101]:
                            - button "展开或收起UI Elements" [ref=e102]:
                                - generic [ref=e108]: UI Elements
            - generic [ref=e111]:
                - generic [ref=e112]: Architecture Preview
                - paragraph [ref=e117]: React 19 · HeroUI · Tailwind CSS v4
        - generic [ref=e118]:
            - generic [ref=e119]:
                - banner [ref=e120]:
                    - button "收起侧栏" [ref=e122] [cursor=pointer]
                    - button "按 Ctrl K 搜索" [ref=e124] [cursor=pointer]
                    - generic [ref=e125]:
                        - generic [ref=e126]:
                            - button "切换语言" [ref=e127] [cursor=pointer]
                            - button "切换主题" [ref=e128] [cursor=pointer]
                        - button "通知" [ref=e129]
                        - button "当前用户" [ref=e133] [cursor=pointer]:
                            - generic [ref=e135]:
                                - generic "Rin" [ref=e138]: RI
                                - generic [ref=e139]: Rin
                - navigation "页面标签" [ref=e143]:
                    - generic [ref=e145]:
                        - button "操作偏好" [ref=e146]
                        - button "关闭 操作偏好" [ref=e148] [cursor=pointer]
                    - button "页面标签" [ref=e152] [cursor=pointer]: 更多页面（1）
            - main [ref=e153]:
                - generic [ref=e155]:
                    - generic [ref=e158]:
                        - paragraph [ref=e159]: 系统
                        - heading "操作偏好" [level=1] [ref=e160]
                        - paragraph [ref=e161]: 提交去向、草稿、确认、聚焦、刷新与搜索行为。 更改立即生效并保存在当前浏览器。
                    - generic [ref=e162]:
                        - complementary [ref=e163]:
                            - button "切换分类与搜索" [ref=e165] [cursor=pointer]
                        - generic [ref=e168]:
                            - generic [ref=e170]:
                                - generic [ref=e171]:
                                    - heading "提交后的去向" [level=2] [ref=e174]
                                    - generic [ref=e177]:
                                        - radiogroup "编辑成功后去向" [ref=e179]:
                                            - generic [ref=e183]:
                                                - generic [ref=e185] [cursor=pointer]:
                                                    - radio "留在当前页" [checked] [ref=e187]
                                                    - generic [ref=e189]: 留在当前页
                                                - generic [ref=e192] [cursor=pointer]:
                                                    - radio "返回列表" [ref=e194]
                                                    - generic [ref=e196]: 返回列表
                                                - generic [ref=e199] [cursor=pointer]:
                                                    - radio "进入详情" [ref=e201]
                                                    - generic [ref=e203]: 进入详情
                                        - radiogroup "创建成功后去向" [ref=e206]:
                                            - generic [ref=e210]:
                                                - generic [ref=e212] [cursor=pointer]:
                                                    - radio "返回列表" [checked] [ref=e214]
                                                    - generic [ref=e216]: 返回列表
                                                - generic [ref=e219] [cursor=pointer]:
                                                    - radio "继续创建" [ref=e221]
                                                    - generic [ref=e223]: 继续创建
                                                - generic [ref=e226] [cursor=pointer]:
                                                    - radio "进入详情" [ref=e228]
                                                    - generic [ref=e230]:
                                                        - generic [ref=e231]: 进入详情
                                                        - generic [ref=e232]: 仅对创建后存在详情页面的场景适用；本参考场景无此目标。
                                - generic [ref=e233]:
                                    - heading "草稿与操作确认" [level=2] [ref=e236]
                                    - generic [ref=e239]:
                                        - generic [ref=e242] [cursor=pointer]:
                                            - switch "本地草稿自动保存" [ref=e244]
                                            - generic [ref=e245]: 本地草稿自动保存
                                        - generic [ref=e251] [cursor=pointer]:
                                            - switch "离开未保存内容时提醒" [checked] [ref=e253]
                                            - generic [ref=e254]: 离开未保存内容时提醒
                                        - generic [ref=e260] [cursor=pointer]:
                                            - switch "重置前确认" [checked] [ref=e262]
                                            - generic [ref=e263]: 重置前确认
                                        - generic [ref=e269] [cursor=pointer]:
                                            - switch "删除前二次确认" [checked] [ref=e271]
                                            - generic [ref=e272]: 删除前二次确认
                                        - generic [ref=e278] [cursor=pointer]:
                                            - switch "批量操作前确认" [checked] [ref=e280]
                                            - generic [ref=e281]: 批量操作前确认
                                - generic [ref=e285]:
                                    - heading "聚焦与详情展示" [level=2] [ref=e288]
                                    - generic [ref=e291]:
                                        - generic [ref=e294] [cursor=pointer]:
                                            - switch "自动聚焦第一个可编辑字段" [ref=e296]
                                            - generic [ref=e297]: 自动聚焦第一个可编辑字段
                                        - generic [ref=e303] [cursor=pointer]:
                                            - switch "定位首个错误字段" [checked] [ref=e305]
                                            - generic [ref=e306]: 定位首个错误字段
                                        - generic [ref=e312] [cursor=pointer]:
                                            - switch "复制后显示反馈" [checked] [ref=e314]
                                            - generic [ref=e315]: 复制后显示反馈
                                        - generic [ref=e321] [cursor=pointer]:
                                            - switch "自动展开详情附加信息" [ref=e323]
                                            - generic [ref=e324]: 自动展开详情附加信息
                                        - radiogroup "默认详情展示模式" [ref=e329]:
                                            - generic [ref=e333]:
                                                - generic [ref=e335] [cursor=pointer]:
                                                    - radio "简洁" [checked] [ref=e337]
                                                    - generic [ref=e339]: 简洁
                                                - generic [ref=e342] [cursor=pointer]:
                                                    - radio "完整" [ref=e344]
                                                    - generic [ref=e346]: 完整
                                            - generic [ref=e348]: 仅作用于有完整/简洁模式区分的页面。
                                - generic [ref=e349]:
                                    - heading "刷新与搜索" [level=2] [ref=e352]
                                    - generic [ref=e355]:
                                        - radiogroup "自动刷新数据" [ref=e357]:
                                            - generic [ref=e361]:
                                                - generic [ref=e363] [cursor=pointer]:
                                                    - radio "关闭" [checked] [ref=e365]
                                                    - generic [ref=e367]: 关闭
                                                - generic [ref=e370] [cursor=pointer]:
                                                    - radio "仅页面重新进入时" [ref=e372]
                                                    - generic [ref=e374]: 仅页面重新进入时
                                                - generic [ref=e377] [cursor=pointer]:
                                                    - radio "定期刷新" [ref=e379]
                                                    - generic [ref=e381]: 定期刷新
                                        - radiogroup "搜索时机" [ref=e384]:
                                            - generic [ref=e388]:
                                                - generic [ref=e390] [cursor=pointer]:
                                                    - radio "输入后自动搜索" [ref=e392]
                                                    - generic [ref=e394]: 输入后自动搜索
                                                - generic [ref=e397] [cursor=pointer]:
                                                    - radio "Enter 后搜索" [checked] [ref=e399]
                                                    - generic [ref=e401]: Enter 后搜索
                                        - generic [ref=e405] [cursor=pointer]:
                                            - switch "保留最近搜索" [ref=e407]
                                            - generic [ref=e408]: 保留最近搜索
                                        - generic [ref=e414] [cursor=pointer]:
                                            - switch "显示搜索历史" [ref=e416]
                                            - generic [ref=e417]: 显示搜索历史
                                        - generic [ref=e423] [cursor=pointer]:
                                            - switch "显示搜索建议" [checked] [ref=e425]
                                            - generic [ref=e426]: 显示搜索建议
                                        - generic [ref=e432] [cursor=pointer]:
                                            - switch "保留各页面最近搜索" [ref=e434]
                                            - generic [ref=e435]: 保留各页面最近搜索
                            - generic [ref=e439]:
                                - button "恢复默认" [ref=e440] [cursor=pointer]
                                - button "恢复全部默认" [ref=e441] [cursor=pointer]
```

# Test source

```ts
  347 |     )
  348 |     .toBe(16);
  349 |   await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  350 |   const tabs = await page.getByRole('navigation', { name: '页面标签' }).boundingBox();
  351 |   const bounds = await detail.boundingBox();
  352 |   expect(bounds?.y).toBeGreaterThanOrEqual((tabs?.y ?? 0) + (tabs?.height ?? 0));
  353 | });
  354 |
  355 | test('Short desktop window retains access to the last settings category', async ({ page }) => {
  356 |   await page.setViewportSize({ width: 1440, height: 500 });
  357 |   await setup(page);
  358 |   await page.goto('/settings/actions');
  359 |   await page.evaluate(() => window.scrollTo(0, 800));
  360 |   const nav = page.locator('.surface-settings-nav');
  361 |   await expect
  362 |     .poll(() => nav.evaluate((element) => element.clientHeight < element.scrollHeight))
  363 |     .toBe(true);
  364 |   await nav.getByRole('link', { name: '快捷键', exact: true }).focus();
  365 |   const target = await nav.getByRole('link', { name: '快捷键', exact: true }).boundingBox();
  366 |   expect(target?.y).toBeGreaterThanOrEqual(139);
  367 |   expect((target?.y ?? 500) + (target?.height ?? 0)).toBeLessThanOrEqual(500);
  368 |   await page.keyboard.press('Enter');
  369 |   await expect(page).toHaveURL('/settings/shortcuts');
  370 |   await expect(page.getByRole('heading', { name: '快捷键', level: 2, exact: true })).toBeVisible();
  371 |   await page.screenshot({
  372 |     animations: 'disabled',
  373 |     path: 'docs/changes/109-ui-ux-optimization/evidence/semantic-final/layout-short-desktop.png',
  374 |   });
  375 | });
  376 |
  377 | test('Settings switches share one pointer and keyboard press boundary', async ({ page }) => {
  378 |   await page.goto('/settings/navigation');
  379 |   const input = page.getByRole('switch', { name: '顶部页面标签', exact: true });
  380 |   const label = page.locator('label').filter({ has: input });
  381 |   await label.locator('[data-slot="switch-control"]').click();
  382 |   await expect(input).toBeChecked();
  383 |   await label.getByText('顶部页面标签', { exact: true }).click();
  384 |   await expect(input).not.toBeChecked();
  385 |   await label.click({ position: { x: 5, y: 5 } });
  386 |   await expect(input).toBeChecked();
  387 |   await input.focus();
  388 |   await page.keyboard.press('Space');
  389 |   await expect(input).not.toBeChecked();
  390 |   await expect(page.getByRole('switch', { name: '固定页面标签', exact: true })).toBeDisabled();
  391 |   await expect(page.getByText('先启用顶部页面标签，即可选择是否固定。')).toBeVisible();
  392 | });
  393 |
  394 | test('Radio indicator and card edge select the same option and arrows retain selection', async ({
  395 |   page,
  396 | }) => {
  397 |   await page.goto('/ui-elements/forms#element-radiogroupfield');
  398 |   const group = page.getByRole('radiogroup', { name: '反馈密度', exact: true });
  399 |   const compact = group.getByRole('radio', { name: '仅观察', exact: true });
  400 |   const compactLabel = group
  401 |     .locator('label')
  402 |     .filter({ has: page.getByRole('radio', { name: '仅观察', exact: true }) });
  403 |   await compactLabel.locator('[data-slot="radio-control"]').click();
  404 |   await expect(compact).toBeChecked();
  405 |   const comfortable = group.getByRole('radio', { name: '引导执行', exact: true });
  406 |   const card = group
  407 |     .locator('label')
  408 |     .filter({ has: page.getByRole('radio', { name: '引导执行', exact: true }) });
  409 |   const size = await card.boundingBox();
  410 |   expect(size).not.toBeNull();
  411 |   await card.click({ position: { x: (size?.width ?? 30) - 5, y: 5 } });
  412 |   await expect(comfortable).toBeChecked();
  413 |   await comfortable.focus();
  414 |   await page.keyboard.press('ArrowLeft');
  415 |   await expect(compact).toBeChecked();
  416 | });
  417 |
  418 | test('Checkbox indicator works in the shared form authority and disabled option stays disabled', async ({
  419 |   page,
  420 | }) => {
  421 |   await page.goto('/ui-elements/forms');
  422 |   const input = page.getByRole('checkbox', { name: '复选项', exact: true });
  423 |   const initial = await input.isChecked();
  424 |   const label = page.locator('label').filter({ has: input });
  425 |   await label.locator('[data-slot="checkbox-control"]').click();
  426 |   await expect(input).toBeChecked({ checked: !initial });
  427 |   await input.focus();
  428 |   await page.keyboard.press('Space');
  429 |   await expect(input).toBeChecked({ checked: initial });
  430 |   const disabled = page.getByRole('checkbox', { name: '禁用复选项', exact: true });
  431 |   await expect(disabled).toBeDisabled();
  432 | });
  433 |
  434 | for (const width of [320, 390, 430, 768, 1024, 1279]) {
  435 |   test(`Settings category navigation stays reachable through continuous tasks at ${width}`, async ({
  436 |     page,
  437 |   }) => {
  438 |     await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
  439 |     await setup(page);
  440 |     await page.goto('/settings/actions');
  441 |     await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  442 |     for (const offset of [650, 1600, 3000]) {
  443 |       await page.evaluate((y) => window.scrollTo(0, y), offset);
  444 |       const position = await page.locator('.surface-settings-nav').boundingBox();
  445 |       const tabs = await page.getByRole('navigation', { name: '页面标签' }).boundingBox();
  446 |       expect(position?.y).toBeGreaterThanOrEqual((tabs?.y ?? 0) + (tabs?.height ?? 0) - 1);
> 447 |       expect(position?.y).toBeLessThan(210);
      |                           ^ Error: expect(received).toBeLessThan(expected)
  448 |     }
  449 |     await chooseCategory(page, '通知');
  450 |     await page.evaluate(() => window.scrollTo(0, 800));
  451 |     await chooseCategory(page, '可访问性');
  452 |     await page.getByRole('link', { name: '前往外观分类' }).click();
  453 |     await expect(page).toHaveURL('/settings');
  454 |     await page.evaluate(() => window.scrollTo(0, 1200));
  455 |     await chooseCategory(page, '操作偏好');
  456 |     await page.getByRole('button', { name: /切换分类与搜索/ }).click();
  457 |     await page.keyboard.press('Escape');
  458 |     await expect(page.getByRole('button', { name: /切换分类与搜索/ })).toBeFocused();
  459 |     expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
  460 |       width,
  461 |     );
  462 |     await page.screenshot({
  463 |       path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/settings-${width}.png`,
  464 |     });
  465 |   });
  466 | }
  467 |
  468 | test('Pinned page tabs track the header; unpinned tabs scroll and persist after reload', async ({
  469 |   page,
  470 | }) => {
  471 |   await page.setViewportSize({ width: 1440, height: 900 });
  472 |   await setup(page);
  473 |   await page.goto('/settings/navigation');
  474 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  475 |   await expect(page.getByRole('switch', { name: '顶部页面标签', exact: true })).toBeChecked();
  476 |   const pinned = page.getByRole('switch', { name: '固定页面标签', exact: true });
  477 |   await expect(pinned).toBeChecked();
  478 |   const tabs = page.getByRole('navigation', { name: '页面标签' });
  479 |   await expect(tabs).toBeVisible();
  480 |   await page.evaluate(() => window.scrollTo(0, 700));
  481 |   const pinnedBounds = await tabs.boundingBox();
  482 |   expect(pinnedBounds?.y).toBe(80);
  483 |   await pinned.focus();
  484 |   await page.keyboard.press('Space');
  485 |   await expect(pinned).not.toBeChecked();
  486 |   await page.evaluate(() => window.scrollTo(0, 900));
  487 |   expect((await tabs.boundingBox())?.y).toBeLessThan(0);
  488 |   await page.reload();
  489 |   await expect(pinned).not.toBeChecked();
  490 | });
  491 |
  492 | test('All page tabs stay manageable on desktop and closing active restores useful focus', async ({
  493 |   page,
  494 | }) => {
  495 |   await page.setViewportSize({ width: 1440, height: 900 });
  496 |   await setup(page);
  497 |   await page.goto('/settings');
  498 |   const nav = page.getByRole('navigation', { name: '设置分类', exact: true });
  499 |   for (const name of ['导航', '数据展示', '操作偏好', '语言与地区', '通知', '可访问性', '快捷键']) {
  500 |     await nav.getByRole('link', { name, exact: true }).click();
  501 |     await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  502 |   }
  503 |   const tabs = page.getByRole('navigation', { name: '页面标签' });
  504 |   const active = tabs.locator('[aria-current="page"]');
  505 |   const bounds = await active.boundingBox();
  506 |   expect(bounds?.x).toBeGreaterThanOrEqual(0);
  507 |   expect((bounds?.x ?? 2000) + (bounds?.width ?? 0)).toBeLessThan(1440);
  508 |   await tabs.getByRole('button', { name: '关闭 快捷键', exact: true }).click();
  509 |   await expect(page).toHaveURL('/settings/accessibility');
  510 |   await expect(tabs.locator('[aria-current="page"]')).toBeFocused();
  511 |   await tabs.getByRole('button', { name: '页面标签', exact: true }).click();
  512 |   await page.getByRole('menuitem', { name: '关闭其他页面标签', exact: true }).click();
  513 |   await expect(tabs.getByRole('button', { name: /^关闭 / })).toHaveCount(1);
  514 | });
  515 |
  516 | test('Settings drawer and form authority retain WCAG AA semantics in dark English', async ({
  517 |   page,
  518 | }) => {
  519 |   await page.setViewportSize({ width: 390, height: 844 });
  520 |   await setup(page);
  521 |   await page.goto('/settings');
  522 |   await page.getByRole('button', { name: /切换分类与搜索/ }).click();
  523 |   expect(
  524 |     (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
  525 |       .violations,
  526 |   ).toEqual([]);
  527 |   await page.keyboard.press('Escape');
  528 |   await page
  529 |     .getByRole('radiogroup', { name: '主题模式' })
  530 |     .getByText('深色主题', { exact: true })
  531 |     .click();
  532 |   await chooseCategory(page, '语言与地区');
  533 |   await page
  534 |     .getByRole('radiogroup', { name: '界面语言' })
  535 |     .getByText('English', { exact: true })
  536 |     .click();
  537 |   expect(
  538 |     (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
  539 |       .violations,
  540 |   ).toEqual([]);
  541 |   await page.screenshot({
  542 |     path: 'docs/changes/109-ui-ux-optimization/evidence/semantic-final/settings-dark-en.png',
  543 |   });
  544 | });
  545 |
  546 | test.describe('Touch settings tasks', () => {
  547 |   test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
```
