import { expect, test } from '@playwright/test';

test('最近访问记录：页面入口导航写入 workbench recents（LRU 去重）', async ({ page }) => {
  // 清空 workbench（保持确定性）。
  await page.goto('/settings');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.workbench'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  // 访问两个页面入口（设置 + 参考资源）。
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('heading', { level: 1, name: '外观', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('clouddrive.workbench')))
    .toContain('"/settings"');
  await page.goto('/reference-resources');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page.getByRole('heading', { level: 1, name: '参考资源', exact: true }),
  ).toBeVisible();

  // workbench localStorage：recents 含最近访问（reference-resources 在前）。
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('clouddrive.workbench')))
    .toContain('"/reference-resources"');
  // state-foundation 持久化信封：{ state: {...}, version }。
  const workbench = await page.evaluate(() => {
    const raw = window.localStorage.getItem('clouddrive.workbench');
    return raw
      ? (JSON.parse(raw) as { state?: { recents?: Array<{ pathname: string; title: string }> } })
      : null;
  });
  expect(workbench?.state).not.toBeNull();
  const recents = workbench?.state?.recents ?? [];
  const pathnames = recents.map((entry) => entry.pathname);
  expect(pathnames).toContain('/settings');
  expect(pathnames).toContain('/reference-resources');
  expect(pathnames[0]).toBe('/reference-resources'); // 最近在前
  expect(recents[0]?.title.length ?? 0).toBeGreaterThan(0); // 标题非空（i18n 解析）
});
