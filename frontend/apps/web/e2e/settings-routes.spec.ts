import { expect, test } from '@playwright/test';

/** 每个分类子路由应可达、PageHeader 为该分类标题、左导航对应项 active。 */
const CASES: ReadonlyArray<{
  path: string;
  heading: string;
  control: ReadonlyArray<{ kind: 'radiogroup' | 'switch' | 'select'; name: string | RegExp }>;
}> = [
  {
    path: '/settings',
    heading: '外观',
    control: [{ kind: 'radiogroup', name: '主题模式' }],
  },
  {
    path: '/settings/navigation',
    heading: '导航',
    control: [{ kind: 'switch', name: '记住展开的侧栏菜单' }],
  },
  {
    path: '/settings/data-display',
    heading: '数据展示',
    control: [{ kind: 'radiogroup', name: /表格密度|默认每页数量/ }],
  },
  {
    path: '/settings/actions',
    heading: '操作偏好',
    control: [{ kind: 'radiogroup', name: /编辑成功后去向|默认详情展示模式/ }],
  },
  {
    path: '/settings/locale',
    heading: '语言与地区',
    control: [{ kind: 'radiogroup', name: '界面语言' }],
  },
  {
    path: '/settings/notifications',
    heading: '通知',
    control: [{ kind: 'switch', name: '应用内通知' }],
  },
  {
    path: '/settings/accessibility',
    heading: '可访问性',
    control: [{ kind: 'switch', name: '增强焦点轮廓' }],
  },
  {
    path: '/settings/shortcuts',
    heading: '快捷键',
    control: [{ kind: 'switch', name: '启用快捷键' }],
  },
];

for (const entry of CASES) {
  test(`${entry.heading}独立页：${entry.path} 可达且左导航 active`, async ({ page }) => {
    await page.goto(entry.path);
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(entry.heading);
    for (const c of entry.control) {
      const locator =
        c.kind === 'radiogroup'
          ? page.getByRole('radiogroup', { name: c.name })
          : c.kind === 'switch'
            ? page.getByRole('switch', { name: c.name })
            : page.getByRole('combobox', { name: c.name });
      await expect(locator.first()).toBeVisible();
    }
    // 左导航当前项高亮。
    await expect(page.getByRole('link', { name: entry.heading, exact: true })).toHaveAttribute(
      'class',
      /bg-brand-soft/,
    );
    // 刷新保持（独立 URL）。
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(entry.heading);
  });
}

test('左导航含全部 8 分类（外观=根），点击可跳转', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nav = page.getByRole('navigation', { name: '设置分类' });
  const headings = [
    '外观',
    '导航',
    '数据展示',
    '操作偏好',
    '语言与地区',
    '通知',
    '可访问性',
    '快捷键',
  ];
  for (const heading of headings) {
    await expect(nav.getByRole('link', { name: heading, exact: true })).toBeVisible();
  }
  // 外观(根) active；点导航分类跳子路由。
  await expect(nav.getByRole('link', { name: '外观', exact: true })).toHaveAttribute(
    'class',
    /bg-brand-soft/,
  );
  await nav.getByRole('link', { name: '导航', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/navigation/);
});

test('内页壳持久化：切换分类不重建侧边栏，搜索输入与结果保留（SET-011）', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 搜索固定在侧边栏顶部（Panel 内、分类导航上方）。
  const sidebar = page.getByRole('navigation', { name: '设置分类' });
  const search = page.getByRole('searchbox', { name: '搜索设置项' });
  await expect(search).toBeVisible();
  await search.fill('记住');
  // 切到另一分类：URL 变、标题变，但搜索输入保留（壳未重挂）。
  await sidebar.getByRole('link', { name: '导航', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/navigation/);
  await expect(page.getByRole('heading', { level: 1, name: '导航' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: '搜索设置项' })).toHaveValue('记住');
});

test('侧边栏：搜索顶置 + 分组导航 + 每分类语义图标（SET-011）', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const sidebar = page.getByRole('navigation', { name: '设置分类' });
  // 分组标题。
  await expect(sidebar.getByText('显示与数据', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('偏好与反馈', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('辅助与输入', { exact: true })).toBeVisible();
  // 每分类项带语义 svg 图标。
  for (const heading of [
    '外观',
    '导航',
    '数据展示',
    '操作偏好',
    '语言与地区',
    '通知',
    '可访问性',
    '快捷键',
  ]) {
    const item = sidebar.getByRole('link', { name: heading, exact: true });
    await expect(item.locator('svg')).toBeVisible();
  }
  // 当前分类（外观=根）active。
  await expect(sidebar.getByRole('link', { name: '外观', exact: true })).toHaveAttribute(
    'class',
    /bg-brand-soft/,
  );
});

test('分类切换复用主 Shell route-enter 动效：内容区段淡入、壳静止（SET-012）', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(700);
  // 路由内容容器存在（layout 壳页面契约）。
  expect(await page.evaluate(() => Boolean(document.querySelector('[data-route-content]')))).toBe(
    true,
  );
  // 切到另一分类：动画采样期直接语义区段应命中 route-enter recipe，
  // 壳（PageHeader）opacity 恒 1（不参与 route-enter、不闪）。
  let sawFade = false;
  const shellOpacities: number[] = [];
  await page.getByRole('link', { name: '导航', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/navigation/);
  await expect(page.getByRole('heading', { level: 1, name: '导航' })).toBeVisible();
  for (let i = 0; i < 40; i++) {
    const sample = await page.evaluate(() => {
      const content = document.querySelector('[data-route-content]');
      const stack = content?.querySelector(':scope > .surface-page-stack');
      const first = stack?.querySelector('[id^=settings-][data-reveal]');
      const header = document.querySelector('.surface-route-region');
      return {
        anim: first ? getComputedStyle(first).animationName : '',
        stackAnim: stack ? getComputedStyle(stack).animationName : '',
        op: header ? parseFloat(getComputedStyle(header).opacity) : -1,
      };
    });
    if (sample.anim.includes('surface-item-enter')) sawFade = true;
    expect(sample.stackAnim).toBe('none');
    shellOpacities.push(sample.op);
    await page.waitForTimeout(16);
  }
  expect(sawFade).toBe(true);
  expect(Math.min(...shellOpacities)).toBeGreaterThan(0.99);
});
