import { expect, test } from '@playwright/test';

test('播放提示音：真实通知发布触发 AudioContext 提示音', async ({ page }) => {
  // 预装 AudioContext 探针：记录构造次数（WebAudio 无资源文件）。
  await page.addInitScript(() => {
    let calls = 0;
    // 用最小 stub 避免真实音频设备依赖；记录调用并保留接口形状。
    (window as unknown as { AudioContext: unknown }).AudioContext = class {
      constructor() {
        calls += 1;
      }
      createGain() {
        return {
          connect: () => undefined,
          gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        };
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: { value: 0 },
          connect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
        };
      }
      close() {
        return Promise.resolve();
      }
      currentTime = 0;
      destination = {};
      static get callCount() {
        return calls;
      }
    };
  });
  await page.goto('/settings/notifications');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 开启 播放提示音。
  await page.getByRole('heading', { name: '通知' }).first().scrollIntoViewIfNeeded();
  const sound = page.getByRole('switch', { name: '播放提示音' });
  await sound.focus();
  await page.keyboard.press('Space');
  await expect(sound).toBeChecked();
  await page.waitForTimeout(300);
  // 触发真实通知：编辑参考资源 → 保存发布通知。
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: /保存/ }).first().click();
  await page.waitForTimeout(800);
  const calls = await page.evaluate(() => {
    const ctor = (window as unknown as { AudioContext: { callCount?: number } }).AudioContext;
    return ctor?.callCount ?? 0;
  });
  expect(calls).toBeGreaterThan(0);
});

test('浏览器桌面通知：权限不可用时开启即回退并在通知中心呈现原因', async ({ page }) => {
  await page.goto('/settings/notifications');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // Playwright 默认 Notification 权限为 denied/default → 门禁应回退。
  await page.getByRole('heading', { name: '通知' }).first().scrollIntoViewIfNeeded();
  const desktop = page.getByRole('switch', { name: '浏览器桌面通知' });
  await desktop.focus();
  await page.keyboard.press('Space');
  // 请求权限（denied/default 快速 resolve）→ 回退为关。
  await page.waitForTimeout(600);
  await expect(desktop).not.toBeChecked();
  // 原因经真实通知管线呈现（通知中心收纳，不静默）。
  await page.getByRole('button', { name: /通知/ }).first().click();
  const drawer = page.locator('[role="dialog"], [role="alertdialog"]');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('无法开启浏览器桌面通知')).toBeVisible();
});
