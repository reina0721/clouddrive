# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settings-ux-review.spec.ts >> Sticky consumers resolve actual chrome height across live tabs and viewport changes
- Location: apps\web\e2e\settings-ux-review.spec.ts:276:1

# Error details

```
Error: UNKNOWN: unknown error, open 'D:\coder\i721\console-web\docs\changes\109-ui-ux-optimization\evidence\semantic-final\layout-2560-hidden.png'
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
                            - button "展开或收起UI Elements" [ref=f1e48]:
                                - generic [ref=f1e55]: UI Elements
                        - listitem [ref=f1e58]:
                            - button "展开或收起Page Patterns" [ref=f1e59]:
                                - generic [ref=f1e66]: Page Patterns
                        - listitem [ref=f1e69]:
                            - button "展开或收起Page Archetypes" [ref=f1e70]:
                                - generic [ref=f1e74]: Page Archetypes
                        - listitem [ref=f1e77]:
                            - link "参考资源" [ref=f1e78] [cursor=pointer]:
                                - /url: /reference-resources
                        - listitem [ref=f1e83]:
                            - link "Icon 大全" [ref=f1e84] [cursor=pointer]:
                                - /url: /system-tools/icons
                        - listitem [ref=f1e91]:
                            - link "基座能力" [ref=f1e92] [cursor=pointer]:
                                - /url: /foundations
                        - listitem [ref=f1e105]:
                            - link "Motion" [ref=f1e106] [cursor=pointer]:
                                - /url: /motion
                        - listitem [ref=f1e115]:
                            - link "状态体系" [ref=f1e116] [cursor=pointer]:
                                - /url: /states
        - generic [ref=f1e123]:
            - banner [ref=f1e125]:
                - button "收起侧栏" [ref=f1e127] [cursor=pointer]
                - button "按 Ctrl K 搜索" [ref=f1e129] [cursor=pointer]
                - generic [ref=f1e130]:
                    - generic [ref=f1e131]:
                        - button "切换语言" [ref=f1e132] [cursor=pointer]
                        - button "切换主题" [ref=f1e133] [cursor=pointer]
                    - button "通知" [ref=f1e134]
                    - button "当前用户" [ref=f1e138] [cursor=pointer]:
                        - generic [ref=f1e140]:
                            - generic "Rin" [ref=f1e143]: RI
                            - generic [ref=f1e144]: Rin
            - main [ref=f1e148]:
                - generic [ref=f1e150]:
                    - generic [ref=f1e153]:
                        - paragraph [ref=f1e154]: 个人偏好
                        - heading "导航" [level=1] [ref=f1e155]
                        - paragraph [ref=f1e156]: 页面访问、侧栏、滚动、面包屑与页面标签。 更改立即生效并保存在当前浏览器。
                    - generic [ref=f1e157]:
                        - complementary [ref=f1e158]:
                            - generic [ref=f1e160]:
                                - group [ref=f1e163]:
                                    - searchbox "搜索设置项" [ref=f1e164]
                                    - button "Close"
                                - navigation "设置分类" [ref=f1e165]:
                                    - generic [ref=f1e166]:
                                        - paragraph [ref=f1e167]: 显示与数据
                                        - link "外观" [ref=f1e168] [cursor=pointer]:
                                            - /url: /settings
                                        - link "导航" [ref=f1e176] [cursor=pointer]:
                                            - /url: /settings/navigation
                                        - link "数据展示" [ref=f1e185] [cursor=pointer]:
                                            - /url: /settings/data-display
                                    - generic [ref=f1e189]:
                                        - paragraph [ref=f1e190]: 偏好与反馈
                                        - link "操作偏好" [ref=f1e191] [cursor=pointer]:
                                            - /url: /settings/actions
                                        - link "语言与地区" [ref=f1e199] [cursor=pointer]:
                                            - /url: /settings/locale
                                        - link "通知" [ref=f1e204] [cursor=pointer]:
                                            - /url: /settings/notifications
                                    - generic [ref=f1e208]:
                                        - paragraph [ref=f1e209]: 辅助与输入
                                        - link "可访问性" [ref=f1e210] [cursor=pointer]:
                                            - /url: /settings/accessibility
                                        - link "快捷键" [ref=f1e218] [cursor=pointer]:
                                            - /url: /settings/shortcuts
                        - generic [ref=f1e223]:
                            - generic [ref=f1e225]:
                                - generic [ref=f1e226]:
                                    - heading "页面导航" [level=2] [ref=f1e229]
                                    - generic [ref=f1e232]:
                                        - generic [ref=f1e235] [cursor=pointer]:
                                            - switch "跳转后自动滚动到顶部" [checked] [ref=f1e237]
                                            - generic [ref=f1e238]: 跳转后自动滚动到顶部
                                        - generic [ref=f1e244] [cursor=pointer]:
                                            - switch "显示面包屑" [checked] [ref=f1e246]
                                            - generic [ref=f1e247]: 显示面包屑
                                        - radiogroup "新页面打开方式" [ref=f1e252]:
                                            - generic [ref=f1e256]:
                                                - generic [ref=f1e258] [cursor=pointer]:
                                                    - radio "当前页面" [checked] [ref=f1e260]
                                                    - generic [ref=f1e262]: 当前页面
                                                - generic [ref=f1e265] [cursor=pointer]:
                                                    - radio "浏览器新标签页" [ref=f1e267]
                                                    - generic [ref=f1e269]: 浏览器新标签页
                                                - generic [ref=f1e272] [cursor=pointer]:
                                                    - radio "顶部页面标签" [ref=f1e274]
                                                    - generic [ref=f1e276]: 顶部页面标签
                                            - generic [ref=f1e278]: 仅作用于声明允许的入口；Ctrl/Cmd 点击、下载与外链保持原生语义。
                                - generic [ref=f1e279]:
                                    - heading "页面标签" [level=2] [ref=f1e282]
                                    - generic [ref=f1e285]:
                                        - generic [ref=f1e288] [cursor=pointer]:
                                            - switch "顶部页面标签" [active] [ref=f1e290]
                                            - generic [ref=f1e291]: 顶部页面标签
                                        - generic [ref=f1e297] [cursor=pointer]:
                                            - switch "恢复上次打开的标签" [ref=f1e299]
                                            - generic [ref=f1e300]: 恢复上次打开的标签
                                        - generic [ref=f1e304]:
                                            - generic:
                                                - generic:
                                                    - generic:
                                                        - switch "固定页面标签" [disabled]
                                                    - generic:
                                                        - generic: 固定页面标签
                                                        - generic: 先启用顶部页面标签，即可选择是否固定。
                                        - generic [ref=f1e306]:
                                            - generic [ref=f1e307]: 关闭当前标签后跳转
                                            - button "最近使用 关闭当前标签后跳转" [ref=f1e308] [cursor=pointer]:
                                                - generic [ref=f1e309]: 最近使用
                                            - generic [ref=f1e314]: 关闭当前激活标签后前往的目标。
                                            - combobox [ref=f1e317]
                                - generic [ref=f1e318]:
                                    - heading "侧栏与工作记忆" [level=2] [ref=f1e321]
                                    - generic [ref=f1e324]:
                                        - generic [ref=f1e327] [cursor=pointer]:
                                            - switch "记住展开的侧栏菜单" [ref=f1e329]
                                            - generic [ref=f1e330]: 记住展开的侧栏菜单
                                        - generic [ref=f1e336] [cursor=pointer]:
                                            - switch "记录最近访问" [checked] [ref=f1e338]
                                            - generic [ref=f1e339]: 记录最近访问
                                        - generic [ref=f1e345] [cursor=pointer]:
                                            - switch "显示最近访问" [checked] [ref=f1e347]
                                            - generic [ref=f1e348]: 显示最近访问
                                        - generic [ref=f1e354] [cursor=pointer]:
                                            - switch "自动恢复未完成工作" [ref=f1e356]
                                            - generic [ref=f1e357]: 自动恢复未完成工作
                                        - radiogroup "侧边栏状态" [ref=f1e362]:
                                            - generic [ref=f1e366]:
                                                - generic [ref=f1e368] [cursor=pointer]:
                                                    - radio "展开" [ref=f1e370]
                                                    - generic [ref=f1e372]: 展开
                                                - generic [ref=f1e375] [cursor=pointer]:
                                                    - radio "紧凑" [ref=f1e377]
                                                    - generic [ref=f1e379]: 紧凑
                                                - generic [ref=f1e382] [cursor=pointer]:
                                                    - radio "记住上次使用状态" [checked] [ref=f1e384]
                                                    - generic [ref=f1e386]: 记住上次使用状态
                            - generic [ref=f1e388]:
                                - button "恢复默认" [ref=f1e389] [cursor=pointer]
                                - button "恢复全部默认" [ref=f1e390] [cursor=pointer]
```

# Test source

```ts
  222 |           await expect(input).toBeChecked({ checked: !before });
  223 |           await expectSwitchGeometry(page);
  224 |         }
  225 |       }
  226 |       await page.getByRole('heading', { level: 1 }).click();
  227 |       await page.screenshot({
  228 |         animations: 'disabled',
  229 |         path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/switch-geometry-${width}-${colorScheme}.png`,
  230 |       });
  231 |     }
  232 |   }
  233 | });
  234 |
  235 | for (const width of [1440, 390, 320]) {
  236 |   for (const density of ['紧凑', '标准', '宽松']) {
  237 |     test(`Switch row hover encloses text and control with clickable inset: ${width}, ${density}`, async ({
  238 |       page,
  239 |     }) => {
  240 |       await page.setViewportSize({ width, height: 900 });
  241 |       await page.goto('/settings');
  242 |       await page
  243 |         .getByRole('radiogroup', { name: '界面密度', exact: true })
  244 |         .getByText(density, { exact: true })
  245 |         .click();
  246 |       await page.goto('/settings/navigation');
  247 |       const input = page.getByRole('switch', { name: '跳转后自动滚动到顶部', exact: true });
  248 |       const row = page.locator('label').filter({ has: input });
  249 |       await row.hover();
  250 |       await expect(row).toHaveAttribute('data-hovered', 'true');
  251 |       const surface = await row.boundingBox();
  252 |       const text = await row.getByText('跳转后自动滚动到顶部', { exact: true }).boundingBox();
  253 |       const control = await row.locator('[data-slot="switch-control"]').boundingBox();
  254 |       expect((text?.x ?? 0) - (surface?.x ?? 0)).toBeGreaterThanOrEqual(10);
  255 |       expect(
  256 |         (surface?.x ?? 0) + (surface?.width ?? 0) - (control?.x ?? 0) - (control?.width ?? 0),
  257 |       ).toBeGreaterThanOrEqual(10);
  258 |       const before = await input.isChecked();
  259 |       await expectSwitchGeometry(page);
  260 |       await row.click({ position: { x: 5, y: (surface?.height ?? 44) / 2 } });
  261 |       await expect(input).toBeChecked({ checked: !before });
  262 |       await expectSwitchGeometry(page);
  263 |       await input.focus();
  264 |       await page.keyboard.press('Space');
  265 |       await expect(input).toBeChecked({ checked: before });
  266 |       await page.getByRole('heading', { level: 1, name: '导航', exact: true }).click();
  267 |       await row.hover();
  268 |       await page.screenshot({
  269 |         animations: 'disabled',
  270 |         path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/switch-row-hover-${width}-${density}.png`,
  271 |       });
  272 |     });
  273 |   }
  274 | }
  275 |
  276 | test('Sticky consumers resolve actual chrome height across live tabs and viewport changes', async ({
  277 |   page,
  278 | }) => {
  279 |   await setup(page);
  280 |   for (const width of [1440, 2560, 390, 768, 1280]) {
  281 |     await page.setViewportSize({ width, height: 900 });
  282 |     await page.goto('/settings/navigation');
  283 |     const enabled = page.getByRole('switch', { name: '顶部页面标签', exact: true });
  284 |     const pinned = page.getByRole('switch', { name: '固定页面标签', exact: true });
  285 |     for (const state of ['pinned', 'unpinned', 'hidden'] as const) {
  286 |       if (state === 'pinned') {
  287 |         if (!(await enabled.isChecked()))
  288 |           await page.locator('label').filter({ has: enabled }).click();
  289 |         if (!(await pinned.isChecked()))
  290 |           await page.locator('label').filter({ has: pinned }).click();
  291 |       } else if (state === 'unpinned') await page.locator('label').filter({ has: pinned }).click();
  292 |       else await page.locator('label').filter({ has: enabled }).click();
  293 |       await expect
  294 |         .poll(() =>
  295 |           page.locator('.surface-settings-nav').evaluate((nav) => {
  296 |             const style = getComputedStyle(nav);
  297 |             const chrome = Number.parseFloat(style.getPropertyValue('--shell-chrome-height'));
  298 |             const gap =
  299 |               innerWidth >= 1280
  300 |                 ? Number.parseFloat(
  301 |                     getComputedStyle(document.documentElement).getPropertyValue('--spacing'),
  302 |                   ) *
  303 |                   Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
  304 |                   4
  305 |                 : 0;
  306 |             return Math.abs(Number.parseFloat(style.top) - chrome - gap);
  307 |           }),
  308 |         )
  309 |         .toBeLessThan(1);
  310 |       await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  311 |       const nav = await page.locator('.surface-settings-nav').boundingBox();
  312 |       const header = await page.getByRole('banner').boundingBox();
  313 |       expect(nav?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
  314 |       if (state === 'pinned') {
  315 |         const tabs = await page.getByRole('navigation', { name: '页面标签' }).boundingBox();
  316 |         expect(nav?.y).toBeGreaterThanOrEqual((tabs?.y ?? 0) + (tabs?.height ?? 0) - 1);
  317 |       }
  318 |       await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  319 |       expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
  320 |         width,
  321 |       );
> 322 |       await page.screenshot({
      |       ^ Error: UNKNOWN: unknown error, open 'D:\coder\i721\console-web\docs\changes\109-ui-ux-optimization\evidence\semantic-final\layout-2560-hidden.png'
  323 |         path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/layout-${width}-${state}.png`,
  324 |       });
  325 |       await page.evaluate(() => window.scrollTo(0, 0));
  326 |     }
  327 |   }
  328 | });
  329 |
  330 | test('Split detail shares the dynamic sticky contract without settings-specific offsets', async ({
  331 |   page,
  332 | }) => {
  333 |   await page.setViewportSize({ width: 1440, height: 900 });
  334 |   await setup(page);
  335 |   await page.goto('/page-archetypes/create-edit');
  336 |   const detail = page.locator('.surface-split-detail');
  337 |   await expect(detail).toBeVisible();
  338 |   await expect
  339 |     .poll(() =>
  340 |       detail.evaluate((element) => {
  341 |         const style = getComputedStyle(element);
  342 |         return (
  343 |           Number.parseFloat(style.top) -
  344 |           Number.parseFloat(style.getPropertyValue('--shell-chrome-height'))
  345 |         );
  346 |       }),
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
```
