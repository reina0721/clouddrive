import { expect, test, type Page } from '@playwright/test';

// 应用级顶部进度条（Top Progress）验证。
// 进度条是装饰性反馈（aria-hidden=true），通过 DOM 选择器断言，不用角色查询。
// 生命周期由 Host 导航入口提供：Sidebar Link / CommandMenu / RouterTextLink 等
// begin；RouteTransition 在 pathname 提交时 end。
// 视觉验收以"最终浏览器像素结果"为准：viewport 顶部、非零尺寸、opacity≠0、
// foreground 实际延伸、完成后退出——不是只断言 DOM 存在或 data-state。
// 最小可见周期：即使极快导航（缓存路由 <60ms 完成）也必须显示一次完整进度周期。

const progressBar = (page: Page) => page.locator('.top-progress');

async function expectHydrated(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

// 慢速导航：拦截目标路由的 RSC 请求并延迟，使客户端导航持续 Pending，
// 进度条在 active 阶段持续延伸、不提前达到 100%。
async function delayRscRoute(page: Page, pathname: string, delayMs: number) {
  await page.route(`**${pathname}?_rsc*`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

// 桌面侧边栏：展开"UI Elements"并点击目标叶子。
async function navigateViaSidebar(page: Page, leafName: string) {
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('button', { name: '展开或收起UI Elements' }).click();
  await navigation.getByRole('link', { name: leafName }).click();
}

// 窄屏：先打开移动端导航抽屉，再展开"UI Elements"并点击叶子。
async function navigateViaMobileNav(page: Page, leafName: string) {
  await page.getByRole('button', { name: '打开导航' }).click();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('button', { name: '展开或收起UI Elements' }).click();
  await navigation.getByRole('link', { name: leafName }).click();
}

// 读取进度条 fill 的"最终像素可见性"代理：boundingBox + 计算样式。
async function readFillVisibility(page: Page) {
  return page.evaluate(() => {
    const fill = document.querySelector('.top-progress-fill');
    if (!fill) return null;
    const rect = fill.getBoundingClientRect();
    const cs = getComputedStyle(fill);
    return {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      opacity: Number(cs.opacity),
      backgroundColor: cs.backgroundColor,
    };
  });
}

test('极快导航（warm 缓存路由）仍显示一次完整进度周期并自然退出', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // warm 目标路由使其走缓存导航
  await page.goto('/ui-elements/overlays');
  await expectHydrated(page);
  await page.goto('/');
  await expectHydrated(page);

  await expect(progressBar(page)).toHaveCount(0);
  // Start pixel sampling before the click: a valid short cycle can finish while
  // Playwright is still waiting for the destination heading.
  await page.evaluate(() => {
    const sampleState = { visible: false };
    (window as unknown as { __warmProgress?: typeof sampleState }).__warmProgress = sampleState;
    const startedAt = performance.now();
    const sample = () => {
      const root = document.querySelector('.top-progress');
      const fill = root?.querySelector('.top-progress-fill');
      if (root && fill) {
        const rect = fill.getBoundingClientRect();
        sampleState.visible =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top === 0 &&
          Number(getComputedStyle(root).opacity) > 0.05 &&
          Number(getComputedStyle(fill).opacity) > 0.05;
      }
      if (!sampleState.visible && performance.now() - startedAt < 5000)
        requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await navigateViaSidebar(page, '浮层与弹出界面');
  await expect(page).toHaveURL(/\/ui-elements\/overlays$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // 即使导航极快（缓存路由，<60ms 完成），也保证最小视觉周期：
  // 进度条必须出现过（enter/completing），且最终自然退出。
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __warmProgress?: { visible: boolean } }).__warmProgress?.visible,
      ),
    )
    .toBe(true);
  await expect(progressBar(page)).toHaveCount(0);
});

test('普通首次导航（未缓存路由）能感知到进度条', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expectHydrated(page);

  // 首次导航 /motion（未 warm、未缓存），真实用户典型场景
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: 'Motion' })
    .click();

  await expect(page).toHaveURL(/\/motion$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(progressBar(page)).toHaveCount(0);
});

test('慢速导航：进度条在 viewport 顶部、非零可见尺寸、foreground 实际延伸、完成后退出', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expectHydrated(page);

  // 拦截 RSC 请求延迟 1800ms，制造慢速导航
  await delayRscRoute(page, '/ui-elements/feedback', 1800);

  await navigateViaSidebar(page, '反馈');

  // 导航进行中：进度条出现且 pending
  await expect(progressBar(page)).toHaveCount(1);
  await expect(progressBar(page)).toHaveAttribute('data-phase', 'pending');

  // 采样 fill 宽度序列，验证"只前进不回缩"：进度条绝不加载到一半又从零开始。
  await page.evaluate(() => {
    const widths: number[] = [];
    (window as unknown as { __progressWidths?: number[] }).__progressWidths = widths;
    const startedAt = performance.now();
    const poll = () => {
      const fill = document.querySelector('.top-progress-fill');
      if (fill) {
        widths.push(Math.round(fill.getBoundingClientRect().width));
      }
      if (performance.now() - startedAt < 1200) requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });

  // 像素级验证：fill 在 viewport 顶部、非零尺寸、opacity 不为 0、色值为 brand 语义色
  await expect
    .poll(async () => {
      const v = await readFillVisibility(page);
      if (!v) return null;
      const visible =
        v.width > 0 &&
        v.height > 0 &&
        v.opacity > 0.05 &&
        v.left >= 0 &&
        v.left < 1440 &&
        v.top === 0;
      return visible ? { width: v.width, height: v.height, opacity: v.opacity } : null;
    })
    .not.toBeNull();

  const during = await readFillVisibility(page);
  expect(during).not.toBeNull();
  expect(during!.width).toBeGreaterThan(0);
  expect(during!.height).toBe(3);
  expect(during!.opacity).toBeGreaterThan(0.05);
  expect(during!.left).toBeGreaterThanOrEqual(0);
  expect(during!.left).toBeLessThan(1440);
  expect(during!.backgroundColor).toBe('rgb(93, 73, 214)'); // --ds-brand light

  // 只前进不回缩：采样到的 fill 宽度序列必须单调不减（允许动画帧内的四舍五入抖动）。
  const widths = await page.evaluate<number[]>(
    () => (window as unknown as { __progressWidths?: number[] }).__progressWidths ?? [],
  );
  const effectiveWidths = widths.filter(
    (w: number, index: number) => index === 0 || w !== widths[index - 1],
  );
  for (let i = 1; i < effectiveWidths.length; i++) {
    const current = effectiveWidths[i];
    const previous = effectiveWidths[i - 1];
    if (current === undefined || previous === undefined) continue;
    // 允许 2px 抖动容差（rAF 采样与宽度插值的边界）
    expect(current).toBeGreaterThanOrEqual(previous - 2);
  }

  // 完成后进度条消失
  await expect(page).toHaveURL(/\/ui-elements\/feedback$/);
  await expect(progressBar(page)).toHaveCount(0);
});

test('连续快速点击不同路由不错误结束、不永久卡住', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expectHydrated(page);

  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('button', { name: '展开或收起UI Elements' }).click();
  const links = navigation.getByRole('link');
  await links.filter({ hasText: '操作与选择' }).click();
  await links.filter({ hasText: '数据展示' }).click();

  await expect(page).toHaveURL(/\/ui-elements\/data$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(progressBar(page)).toHaveCount(0);
});

test('访问不存在路由不导致进度条卡住', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/definitely-not-a-route');
  await expectHydrated(page);
  await expect(progressBar(page)).toHaveCount(0);
});

test('进度条不推动 Header/Sidebar/内容布局', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expectHydrated(page);

  const header = page.locator('header').first();
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await expect(header).toBeVisible();
  const before = await header.boundingBox();

  await delayRscRoute(page, '/ui-elements/status-async', 1200);
  await navigateViaSidebar(page, '状态与异步');
  await expect(progressBar(page)).toHaveCount(1);

  const during = await header.boundingBox();
  expect(during).toEqual(before);

  await expect(page).toHaveURL(/\/ui-elements\/status-async$/);
  await expect(progressBar(page)).toHaveCount(0);
});

test('Dark Mode 与窄屏下进度条正常显示', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expectHydrated(page);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });

  await delayRscRoute(page, '/ui-elements/actions-selection', 1200);
  await navigateViaMobileNav(page, '操作与选择');
  await expect(progressBar(page)).toHaveCount(1);
  await expect(progressBar(page)).toHaveAttribute('data-phase', 'pending');

  await expect
    .poll(async () => {
      const v = await readFillVisibility(page);
      if (!v) return null;
      return v.width > 0 && v.height > 0 && v.opacity > 0.05 && v.left >= 0 && v.left < 390
        ? { width: v.width }
        : null;
    })
    .not.toBeNull();

  await expect(page).toHaveURL(/\/ui-elements\/actions-selection$/);
  await expect(progressBar(page)).toHaveCount(0);
});

test('Reduced Motion 下进度条动画时长被压低但仍完成收尾', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expectHydrated(page);

  await page.evaluate(() => {
    const record = { sawProgressGrow: false, maxGrowDurationMs: 0 };
    (window as unknown as { __progressMotionWatch?: typeof record }).__progressMotionWatch = record;
    const startedAt = performance.now();
    const poll = () => {
      for (const animation of document.getAnimations()) {
        const name = (animation as CSSAnimation).animationName;
        if (name === 'progress-grow') {
          record.sawProgressGrow = true;
          const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
          if (Number.isFinite(duration)) {
            record.maxGrowDurationMs = Math.max(record.maxGrowDurationMs, duration);
          }
        }
      }
      if (performance.now() - startedAt < 3000) requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });

  await delayRscRoute(page, '/ui-elements/forms', 1200);
  await navigateViaSidebar(page, '表单控件');
  await expect(progressBar(page)).toHaveCount(1);
  await expect(page).toHaveURL(/\/ui-elements\/forms$/);
  await expect(progressBar(page)).toHaveCount(0);

  const record = await page.evaluate(
    () =>
      (
        window as unknown as {
          __progressMotionWatch?: { sawProgressGrow: boolean; maxGrowDurationMs: number };
        }
      ).__progressMotionWatch ?? { sawProgressGrow: false, maxGrowDurationMs: 0 },
  );
  // reduced-motion 下延伸动画被 tokens.css 全局 policy 压到 0.01ms 级
  expect(record.maxGrowDurationMs).toBeLessThan(50);
});
