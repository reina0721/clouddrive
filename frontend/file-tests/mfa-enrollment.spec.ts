import { expect, test } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

test('双因素认证区分设置材料和恢复码，并保留失败确认中的材料', async ({ page }, info) => {
  const access = readPreviewAccess();
  let registered = false;
  let attempts = 0;
  const secret = 'TEST-ENROLLMENT-SECRET';
  const uri = 'otpauth://totp/Fixture?secret=TESTONLY';
  await page.route('**/native/iam/self/mfa', async (route) => {
    await route.fulfill({
      json: route.request().method() === 'GET' ? { registered } : { secret, uri },
    });
  });
  await page.route('**/native/iam/self/mfa/confirm', async (route) => {
    attempts += 1;
    expect(route.request().postDataJSON()).toEqual({ code: '123456' });
    if (attempts === 1) return route.fulfill({ status: 422, json: {} });
    registered = true;
    await route.fulfill({ json: { recoveryCodes: ['TEST-RECOVERY-ONE', 'TEST-RECOVERY-TWO'] } });
  });
  await page.route('**/native/iam/self/mfa/disable', async (route) => {
    registered = false;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/login?returnTo=%2Faccount%2Fsecurity');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '绑定认证器', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '确认绑定', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '绑定认证器', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText(secret, { exact: true })).toBeVisible();
  await expect(page.getByText(uri, { exact: true })).toBeVisible();
  await expect(page.getByText('恢复码仅显示一次，请妥善保存。', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '确认绑定', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '确认绑定', exact: true });
  await expect(confirm.getByRole('button', { name: '确认', exact: true })).toBeDisabled();
  await confirm.getByLabel('认证器生成的动态验证码', { exact: true }).fill('123456');
  await confirm.getByRole('button', { name: '确认', exact: true }).click();
  await expect(confirm.getByRole('alert')).toBeVisible();
  await expect(confirm.getByLabel('认证器生成的动态验证码', { exact: true })).toHaveValue('123456');
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByText(secret, { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 760 });
  await page.screenshot({ path: info.outputPath('mfa-setup-mobile.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '确认绑定', exact: true }).click();
  await confirm.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText('TEST-RECOVERY-ONE', { exact: true })).toBeVisible();
  await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
  await expect(page.getByText(uri, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '解除绑定', exact: true }).click();
  const disable = page.getByRole('dialog', { name: '解除绑定', exact: true });
  await disable.getByLabel('动态验证码或恢复码', { exact: true }).fill('TEST-RECOVERY-TWO');
  await disable.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: '绑定认证器', exact: true })).toBeVisible();
  await expect(page.getByText('TEST-RECOVERY-ONE', { exact: true })).toHaveCount(0);
});
