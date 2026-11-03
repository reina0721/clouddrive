import { expect, test, type Page } from '@playwright/test';

// 页面转场验证：Host 方向过渡由 data-route-kind + CSS animation 驱动（不依赖
// React ViewTransition 实验组件——stable react 不导出该 API，运行时为 undefined）。
// 页面内启动 rAF 轮询 watcher，记录实际发生的 CSS 动画（content-*/surface-enter-*）
// 的最大时长与动画名。
// 开始时先访问目标路由一次（warm）再回到起点导航：目标路由数据已缓存，导航会以
// 单次提交完成，方向过渡确定性播放；未缓存路由的首次导航可能拆帧
// （route data 迟到/useSearchParams Suspense），属于官方已说明的降级行为。
type TransitionRecord = {
  sawDirectionEnter: boolean;
  sawRouteContentEnter: boolean;
  maxDurationMs: number;
  animationNames: string[];
};

async function startTransitionWatcher(page: Page) {
  await page.evaluate(() => {
    const record: TransitionRecord = {
      sawDirectionEnter: false,
      sawRouteContentEnter: false,
      maxDurationMs: 0,
      animationNames: [],
    };
    (window as unknown as { __transitionWatch?: TransitionRecord }).__transitionWatch = record;
    const startedAt = performance.now();
    const poll = () => {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        const name = (animation as CSSAnimation).animationName;
        if (!name) continue;
        if (effect?.pseudoElement) continue; // 不再使用 View Transition pseudo 动画
        // 只观察页面内容转场动画（content-* / surface-enter-*），排除 progress-grow
        // 等非转场动画（Top Progress 1.1s 循环不属于页面过渡预算）。
        if (
          !name.includes('content-') &&
          !name.includes('surface-enter-') &&
          !name.includes('surface-screen-') &&
          name !== 'surface-item-enter'
        )
          continue;
        // 只记录实际播放中的动画：fill:both 的 finished 动画会残留在
        // getAnimations() 中，若计入会污染后续用例（如后退不应出现 forward 动画）。
        if (animation.playState === 'finished') continue;
        if (!record.animationNames.includes(name)) record.animationNames.push(name);
        if (name.includes('surface-enter-forward')) record.sawDirectionEnter = true;
        if (name.includes('content-') || name === 'surface-item-enter')
          record.sawRouteContentEnter = true;
        const duration = Number(effect?.getComputedTiming().duration ?? 0);
        if (Number.isFinite(duration)) {
          record.maxDurationMs = Math.max(record.maxDurationMs, duration);
        }
      }
      if (performance.now() - startedAt < 3000) requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

async function readTransitionRecord(page: Page): Promise<TransitionRecord> {
  return page.evaluate(() => {
    return (
      (window as unknown as { __transitionWatch?: TransitionRecord }).__transitionWatch ?? {
        sawDirectionEnter: false,
        sawRouteContentEnter: false,
        maxDurationMs: 0,
        animationNames: [],
      }
    );
  });
}

async function expectHydrated(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

// 先访问目标路由（warm 路由缓存），再回到起点，保证后续点击走缓存路由、
// 单次提交完成转场；随后在侧栏导航到目标。
async function warmAndNavigate(page: Page, targetUrl: string, leafName: string) {
  await page.goto(targetUrl);
  await expectHydrated(page);
  await page.goto('/');
  await expectHydrated(page);

  await startTransitionWatcher(page);
  await navigateViaSidebar(page, leafName);
}

async function navigateViaSidebar(page: Page, leafName: string) {
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('button', { name: '展开或收起UI Elements' }).click();
  await navigation.getByRole('link', { name: leafName }).click();
}

// 等待页面动画完全结束，保证后续导航从干净状态开始。
async function waitForTransitionsToSettle(page: Page) {
  await expect
    .poll(async () => {
      const running = await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          const effect = animation.effect as KeyframeEffect | null;
          if (effect?.pseudoElement) continue;
          const name = (animation as CSSAnimation).animationName ?? '';
          if (
            (name.includes('content-') ||
              name.includes('surface-enter-') ||
              name.includes('surface-screen-')) &&
            animation.playState === 'running'
          ) {
            return true;
          }
        }
        return false;
      });
      return !running;
    })
    .toBe(true);
}

test('无 Suspense 页面深入导航播放方向进入并恢复稳定', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // warm /foundations 使其走缓存路由，导航单次提交、方向过渡确定性播放
  await page.goto('/foundations');
  await expectHydrated(page);
  await page.goto('/');
  await expectHydrated(page);

  await startTransitionWatcher(page);
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '基座能力' })
    .click();

  await expect(page).toHaveURL(/\/foundations$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // 等待转场完整结束（stagger 最末 region delay ~360ms + 动画 180ms → 窗口 <600ms）
  await page.waitForTimeout(800);

  const record = await readTransitionRecord(page);
  // forward 导航播放方向进入动画（克制右入淡入，CSS token 驱动）
  expect(record.sawDirectionEnter).toBe(true);
  expect(record.animationNames).toContain('surface-enter-forward');
  expect(record.sawRouteContentEnter).toBe(true);
  expect(record.maxDurationMs).toBeLessThanOrEqual(500);

  // 转场结束后内容必须可见且无残留动画（不 opacity:0 卡死）。
  // Reveal 是默认可见增强：未滚入的 below-fold 区域同样不能被隐藏。
  const settled = await page.evaluate(() => {
    const rc = document.querySelector('.surface-route-content');
    const regions = rc ? [...rc.querySelectorAll(':scope > .surface-page-stack > *')] : [];
    return regions.every((r) => getComputedStyle(r).opacity === '1');
  });
  expect(settled).toBe(true);
});

test('Family 页面导航在拆帧场景下保持功能正确且动画不失控', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // warm /ui-elements/overlays；Family 页含 useSearchParams/Suspense，
  // 即使走缓存路由也可能在首帧后补挂内容，方向动画“整体必现”不作强制断言
  await warmAndNavigate(page, '/ui-elements/overlays', '浮层与弹出界面');

  await expect(page).toHaveURL(/\/ui-elements\/overlays$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overlay 与 Floating Layer');
  await page.waitForTimeout(600);

  const record = await readTransitionRecord(page);
  // 导航功能正确（URL/标题断言已覆盖）；任何被观察到的动画时长都处于预算内（≤500ms）
  if (record.animationNames.length > 0) {
    expect(record.maxDurationMs).toBeLessThanOrEqual(500);
  }
});

test('减弱动态效果时方向过渡时长接近零', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await warmAndNavigate(page, '/ui-elements/overlays', '浮层与弹出界面');

  await expect(page).toHaveURL(/\/ui-elements\/overlays$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overlay 与 Floating Layer');
  await page.waitForTimeout(600);

  const record = await readTransitionRecord(page);
  // 即使观察到动画，时长也必须被压低（reduced-motion 降级）
  if (record.animationNames.length > 0) {
    expect(record.maxDurationMs).toBeLessThan(50);
  }
});

test('浏览器后退不播放方向进入并正确恢复页面', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // 保持简单历史栈：goto '/' 后前进到 overlays，再后退回 '/'；
  // 前进段不承担方向断言，无需预热
  await page.goto('/');
  await expectHydrated(page);
  await navigateViaSidebar(page, '浮层与弹出界面');
  await expect(page).toHaveURL(/\/ui-elements\/overlays$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overlay 与 Floating Layer');
  // 等上一转场完全结束，避免快速后退时动画上下文尚未释放
  await waitForTransitionsToSettle(page);

  await startTransitionWatcher(page);
  await page.goBack();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(600);

  const record = await readTransitionRecord(page);
  // 浏览器后退不携带 forward 意图：绝不出现 surface-enter-forward 方向进入
  expect(record.animationNames).not.toContain('surface-enter-forward');
});
