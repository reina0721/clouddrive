# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-ux-review.spec.ts >> Settings category navigation stays reachable through continuous tasks at 430
- Location: apps\web\e2e\settings-ux-review.spec.ts:435:3

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 210
Received:   311
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
    - alert [ref=e11]
    - link "跳到主要内容 / Skip to content" [ref=e12] [cursor=pointer]:
        - /url: '#main-content'
    - generic [ref=e14]:
        - generic [ref=e15]:
            - banner [ref=e16]:
                - button "打开导航" [ref=e18] [cursor=pointer]
                - button "搜索页面与操作" [ref=e20] [cursor=pointer]
                - button "通知" [ref=e22]
            - navigation "页面标签" [ref=e27]:
                - generic [ref=e29]:
                    - button "操作偏好" [ref=e30]
                    - button "关闭 操作偏好" [ref=e32] [cursor=pointer]
                - button "页面标签" [ref=e36] [cursor=pointer]: 更多页面（1）
        - main [ref=e37]:
            - generic [ref=e39]:
                - generic [ref=e42]:
                    - paragraph [ref=e43]: 系统
                    - heading "操作偏好" [level=1] [ref=e44]
                    - paragraph [ref=e45]: 提交去向、草稿、确认、聚焦、刷新与搜索行为。 更改立即生效并保存在当前浏览器。
                - generic [ref=e46]:
                    - complementary [ref=e47]:
                        - button "切换分类与搜索" [ref=e49] [cursor=pointer]
                    - generic [ref=e52]:
                        - generic [ref=e54]:
                            - generic [ref=e55]:
                                - heading "提交后的去向" [level=2] [ref=e58]
                                - generic [ref=e61]:
                                    - radiogroup "编辑成功后去向" [ref=e63]:
                                        - generic [ref=e67]:
                                            - generic [ref=e69] [cursor=pointer]:
                                                - radio "留在当前页" [checked] [ref=e71]
                                                - generic [ref=e73]: 留在当前页
                                            - generic [ref=e76] [cursor=pointer]:
                                                - radio "返回列表" [ref=e78]
                                                - generic [ref=e80]: 返回列表
                                            - generic [ref=e83] [cursor=pointer]:
                                                - radio "进入详情" [ref=e85]
                                                - generic [ref=e87]: 进入详情
                                    - radiogroup "创建成功后去向" [ref=e90]:
                                        - generic [ref=e94]:
                                            - generic [ref=e96] [cursor=pointer]:
                                                - radio "返回列表" [checked] [ref=e98]
                                                - generic [ref=e100]: 返回列表
                                            - generic [ref=e103] [cursor=pointer]:
                                                - radio "继续创建" [ref=e105]
                                                - generic [ref=e107]: 继续创建
                                            - generic [ref=e110] [cursor=pointer]:
                                                - radio "进入详情" [ref=e112]
                                                - generic [ref=e114]:
                                                    - generic [ref=e115]: 进入详情
                                                    - generic [ref=e116]: 仅对创建后存在详情页面的场景适用；本参考场景无此目标。
                            - generic [ref=e117]:
                                - heading "草稿与操作确认" [level=2] [ref=e120]
                                - generic [ref=e123]:
                                    - generic [ref=e126] [cursor=pointer]:
                                        - switch "本地草稿自动保存" [ref=e128]
                                        - generic [ref=e129]: 本地草稿自动保存
                                    - generic [ref=e135] [cursor=pointer]:
                                        - switch "离开未保存内容时提醒" [checked] [ref=e137]
                                        - generic [ref=e138]: 离开未保存内容时提醒
                                    - generic [ref=e144] [cursor=pointer]:
                                        - switch "重置前确认" [checked] [ref=e146]
                                        - generic [ref=e147]: 重置前确认
                                    - generic [ref=e153] [cursor=pointer]:
                                        - switch "删除前二次确认" [checked] [ref=e155]
                                        - generic [ref=e156]: 删除前二次确认
                                    - generic [ref=e162] [cursor=pointer]:
                                        - switch "批量操作前确认" [checked] [ref=e164]
                                        - generic [ref=e165]: 批量操作前确认
                            - generic [ref=e169]:
                                - heading "聚焦与详情展示" [level=2] [ref=e172]
                                - generic [ref=e175]:
                                    - generic [ref=e178] [cursor=pointer]:
                                        - switch "自动聚焦第一个可编辑字段" [ref=e180]
                                        - generic [ref=e181]: 自动聚焦第一个可编辑字段
                                    - generic [ref=e187] [cursor=pointer]:
                                        - switch "定位首个错误字段" [checked] [ref=e189]
                                        - generic [ref=e190]: 定位首个错误字段
                                    - generic [ref=e196] [cursor=pointer]:
                                        - switch "复制后显示反馈" [checked] [ref=e198]
                                        - generic [ref=e199]: 复制后显示反馈
                                    - generic [ref=e205] [cursor=pointer]:
                                        - switch "自动展开详情附加信息" [ref=e207]
                                        - generic [ref=e208]: 自动展开详情附加信息
                                    - radiogroup "默认详情展示模式" [ref=e213]:
                                        - generic [ref=e217]:
                                            - generic [ref=e219] [cursor=pointer]:
                                                - radio "简洁" [checked] [ref=e221]
                                                - generic [ref=e223]: 简洁
                                            - generic [ref=e226] [cursor=pointer]:
                                                - radio "完整" [ref=e228]
                                                - generic [ref=e230]: 完整
                                        - generic [ref=e232]: 仅作用于有完整/简洁模式区分的页面。
                            - generic [ref=e233]:
                                - heading "刷新与搜索" [level=2] [ref=e236]
                                - generic [ref=e239]:
                                    - radiogroup "自动刷新数据" [ref=e241]:
                                        - generic [ref=e245]:
                                            - generic [ref=e247] [cursor=pointer]:
                                                - radio "关闭" [checked] [ref=e249]
                                                - generic [ref=e251]: 关闭
                                            - generic [ref=e254] [cursor=pointer]:
                                                - radio "仅页面重新进入时" [ref=e256]
                                                - generic [ref=e258]: 仅页面重新进入时
                                            - generic [ref=e261] [cursor=pointer]:
                                                - radio "定期刷新" [ref=e263]
                                                - generic [ref=e265]: 定期刷新
                                    - radiogroup "搜索时机" [ref=e268]:
                                        - generic [ref=e272]:
                                            - generic [ref=e274] [cursor=pointer]:
                                                - radio "输入后自动搜索" [ref=e276]
                                                - generic [ref=e278]: 输入后自动搜索
                                            - generic [ref=e281] [cursor=pointer]:
                                                - radio "Enter 后搜索" [checked] [ref=e283]
                                                - generic [ref=e285]: Enter 后搜索
                                    - generic [ref=e289] [cursor=pointer]:
                                        - switch "保留最近搜索" [ref=e291]
                                        - generic [ref=e292]: 保留最近搜索
                                    - generic [ref=e298] [cursor=pointer]:
                                        - switch "显示搜索历史" [ref=e300]
                                        - generic [ref=e301]: 显示搜索历史
                                    - generic [ref=e307] [cursor=pointer]:
                                        - switch "显示搜索建议" [checked] [ref=e309]
                                        - generic [ref=e310]: 显示搜索建议
                                    - generic [ref=e316] [cursor=pointer]:
                                        - switch "保留各页面最近搜索" [ref=e318]
                                        - generic [ref=e319]: 保留各页面最近搜索
                        - generic [ref=e323]:
                            - button "恢复默认" [ref=e324] [cursor=pointer]
                            - button "恢复全部默认" [ref=e325] [cursor=pointer]
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
