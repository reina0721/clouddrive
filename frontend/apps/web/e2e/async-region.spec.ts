import { expect, test, type Page } from '@playwright/test';

// AsyncRegion（Async Content Transition，recipe: content.enter）验证：
// initial→ready 播放内容进场动画、refresh/background 保留内容、reduced-motion 无位移动画、
// initial 态 aria-busy 与 data-phase 语义。动画经页面内 rAF watcher 观察
// document.getAnimations() 中的 content-* keyframes（design-system motion.css 定义）。
type MotionRecord = {
  sawContentEnter: boolean;
  maxDurationMs: number;
  animationNames: string[];
};

async function startMotionWatcher(page: Page) {
  await page.evaluate(() => {
    const record: MotionRecord = { sawContentEnter: false, maxDurationMs: 0, animationNames: [] };
    (window as unknown as { __motionWatch?: MotionRecord }).__motionWatch = record;
    const startedAt = performance.now();
    const poll = () => {
      for (const animation of document.getAnimations()) {
        const name = (animation as CSSAnimation).animationName;
        if (!name || name === 'none') continue;
        if (!record.animationNames.includes(name)) record.animationNames.push(name);
        if (name.includes('content-')) record.sawContentEnter = true;
        const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
        if (Number.isFinite(duration)) {
          record.maxDurationMs = Math.max(record.maxDurationMs, duration);
        }
      }
      if (performance.now() - startedAt < 3000) requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });
}

async function readMotionRecord(page: Page): Promise<MotionRecord> {
  return page.evaluate(() => {
    return (
      (window as unknown as { __motionWatch?: MotionRecord }).__motionWatch ?? {
        sawContentEnter: false,
        maxDurationMs: 0,
        animationNames: [],
      }
    );
  });
}

// 场景状态选择器：按钮名随当前值变化，用"场景状态"后缀匹配
async function setSceneMode(page: Page, optionName: string) {
  await page.getByRole('button', { name: /场景状态$/ }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

const asyncRegion = (page: Page) => page.getByRole('region', { name: 'Reference 工作流数据表' });

test('AsyncRegion 数据就绪后播放内容进场动画并维持加载语义', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  await startMotionWatcher(page);
  await setSceneMode(page, 'Loading / Skeleton');

  // initial 态：data-phase 与 aria-busy 语义，区域内为 Skeleton 结构
  await expect(asyncRegion(page)).toHaveAttribute('data-phase', 'initial');
  await expect(asyncRegion(page)).toHaveAttribute('aria-busy', 'true');
  await expect(asyncRegion(page).locator('[data-slot="skeleton"]')).toHaveCount(8);

  // 数据就绪：内容进场动画（content.enter 配方）
  await setSceneMode(page, '正常');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(asyncRegion(page)).toHaveAttribute('data-phase', 'ready');
  await page.waitForTimeout(600);

  const record = await readMotionRecord(page);
  expect(record.sawContentEnter).toBe(true);
  expect(record.animationNames).toContain('content-fade-in');
  // fade 180ms 与 rise 180ms 均来自 token；动画时长必须可感知
  expect(record.maxDurationMs).toBeGreaterThanOrEqual(100);
});

test('减弱动态效果时 AsyncRegion 切换无位移动画', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  await startMotionWatcher(page);
  await setSceneMode(page, 'Loading / Skeleton');
  await setSceneMode(page, '正常');
  await expect(page.getByRole('grid')).toBeVisible();
  await page.waitForTimeout(600);

  const record = await readMotionRecord(page);
  // 即使观察到 content 动画，时长也必须被压低到 0.01ms 级
  if (record.sawContentEnter) {
    expect(record.maxDurationMs).toBeLessThan(50);
  }
});

test('AsyncRegion 快速连续切换后无动画残留与状态污染', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  // 连续快速切换：loading→ready→loading→ready（不等待中间完成）
  await setSceneMode(page, 'Loading / Skeleton');
  await setSceneMode(page, '正常');
  await setSceneMode(page, 'Loading / Skeleton');
  await setSceneMode(page, '正常');
  await expect(page.getByRole('grid')).toBeVisible();
  await page.waitForTimeout(600);

  await expect(asyncRegion(page)).toHaveAttribute('data-phase', 'ready');
  await expect(asyncRegion(page)).not.toHaveAttribute('aria-busy', 'true');

  const runningContent = await page.evaluate(() => {
    let count = 0;
    for (const animation of document.getAnimations()) {
      const name = (animation as CSSAnimation).animationName;
      if (name?.includes('content-') && animation.playState === 'running') count += 1;
    }
    return count;
  });
  expect(runningContent).toBe(0);
});

test('refreshing 保留旧内容并 busy，background 保留内容且静默', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('grid')).toBeVisible();

  await setSceneMode(page, '保留内容刷新');
  await expect(asyncRegion(page)).toHaveAttribute('data-phase', 'refreshing');
  await expect(asyncRegion(page)).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByText('保留内容刷新').last()).toBeVisible();

  await setSceneMode(page, '后台静默刷新');
  await expect(asyncRegion(page)).toHaveAttribute('data-phase', 'background');
  await expect(asyncRegion(page)).not.toHaveAttribute('aria-busy');
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(asyncRegion(page).getByText('保留内容刷新')).toHaveCount(0);
});
