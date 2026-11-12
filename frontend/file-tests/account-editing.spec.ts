import { expect, test } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

test('个人资料与偏好先显示摘要，取消重置草稿，保存失败保留输入', async ({ page }, info) => {
  const access = readPreviewAccess();
  let writes = 0;
  for (const resource of ['profile', 'preferences']) {
    await page.route(`**/native/iam/self/${resource}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      writes += 1;
      await route.fulfill({ status: 503, json: {} });
    });
  }
  await page.goto('/login?returnTo=%2Faccount');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const profile = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '扩展资料', exact: true }) });
  const preferences = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '跨设备账户偏好', exact: true }) });
  await expect(profile.getByLabel('扩展资料', { exact: true })).toBeVisible();
  await expect(preferences.getByLabel('跨设备账户偏好', { exact: true })).toBeVisible();
  await expect(preferences.getByText('语言', { exact: true })).toBeVisible();
  await profile.getByRole('button', { name: '编辑', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '扩展资料', exact: true });
  const nickname = editor.getByLabel('昵称', { exact: true });
  const original = await nickname.inputValue();
  await nickname.fill('未保存的资料');
  await editor.getByRole('button', { name: '取消', exact: true }).click();
  await profile.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(nickname).toHaveValue(original);
  await nickname.fill('保存失败的资料');
  await editor.getByRole('button', { name: '保存', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(nickname).toHaveValue('保存失败的资料');
  await editor.getByRole('button', { name: '取消', exact: true }).click();
  await preferences.getByRole('button', { name: '编辑', exact: true }).click();
  const preferenceEditor = page.getByRole('dialog', { name: '跨设备账户偏好', exact: true });
  const motion = preferenceEditor.getByRole('checkbox', { name: '减少动效', exact: true });
  const reduced = await motion.isChecked();
  await motion.press('Space');
  await preferenceEditor.getByRole('button', { name: '取消', exact: true }).click();
  await preferences.getByRole('button', { name: '编辑', exact: true }).click();
  await expect(motion).toBeChecked({ checked: reduced });
  await motion.press('Space');
  await preferenceEditor.getByRole('button', { name: '保存', exact: true }).click();
  await expect(preferenceEditor.getByRole('alert')).toBeVisible();
  await expect(motion).toBeChecked({ checked: !reduced });
  await preferenceEditor.getByRole('button', { name: '取消', exact: true }).click();
  expect(writes).toBe(2);
  await expect(preferenceEditor).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 760 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await preferences.screenshot({
    path: info.outputPath('account-preferences-summary.png'),
    animations: 'disabled',
  });
});
