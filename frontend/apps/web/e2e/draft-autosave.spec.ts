import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetAll(page: Page) {
  await page.goto('/reference-resources/create');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.workspace');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('本地草稿自动保存并恢复（操作偏好 autosaveDrafts 开）：输入 → 刷新恢复', async ({ page }) => {
  await resetAll(page);
  // 设置 → 操作偏好 → 本地草稿自动保存 = 开。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const autosave = page.getByRole('switch', { name: '本地草稿自动保存' });
  await autosave.focus();
  await page.keyboard.press('Space');
  await expect(autosave).toBeChecked();

  // 创建页输入（触发自动保存）。
  await page.goto('/reference-resources/create');
  await page.getByLabel('名称').fill('草稿测试 Alpha');
  await page.waitForTimeout(500); // 等 autosave 落盘

  // 刷新 → 草稿恢复（未提交语义保留）。
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByLabel('名称')).toHaveValue('草稿测试 Alpha');

  // 提交成功 → 草稿清除。
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page).toHaveURL(/\/reference-resources$/);
  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem('clouddrive.workspace');
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) return false;
    const state = parsed.state;
    if (!state || typeof state !== 'object' || !('records' in state)) return false;
    const records = state.records;
    return Boolean(
      records && typeof records === 'object' && 'reference-resources.create' in records,
    );
  });
  expect(stored).toBe(false);
});

test('autosaveDrafts 关（默认）：输入不写草稿', async ({ page }) => {
  await resetAll(page);
  await page.getByLabel('名称').fill('不应保存的草稿');
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem('clouddrive.workspace');
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) return false;
    const state = parsed.state;
    if (!state || typeof state !== 'object' || !('records' in state)) return false;
    const records = state.records;
    return Boolean(
      records && typeof records === 'object' && 'reference-resources.create' in records,
    );
  });
  expect(stored).toBe(false);
});
