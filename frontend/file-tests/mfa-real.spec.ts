import { createHmac, randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

test.use({ actionTimeout: 15_000 });

// Independent authenticator calculation for the server's SHA1 / 30s / 6 digit URI.
function authenticatorCode(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secret) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid enrollment encoding');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', bytes).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login?returnTo=%2Faccount%2Fsecurity');
  await page.getByLabel('邮箱', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

async function write(page: Page, path: string, method: string, body: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const csrf = await fetch('/api/console/v1/auth/csrf');
      if (!csrf.ok) throw new Error('Fixture CSRF failed');
      const { token } = (await csrf.json()) as { token: string };
      const response = await fetch('/api/console/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Fixture HTTP ' + response.status);
      return response.status === 204 ? null : ((await response.json()) as unknown);
    },
    { path, method, body },
  );
}

test('独立账户完成真实 TOTP 绑定、恢复码登录和解除绑定', async ({ page, browser }) => {
  const access = readPreviewAccess();
  await login(page, access.username, access.password);
  await expect(page).toHaveURL(/\/account\/security$/);
  // Recover only this test's earlier interrupted fixtures, never other preview accounts.
  const priorFixtures = await page.evaluate(async () => {
    const response = await fetch(
      '/api/console/v1/native/iam/accounts?query=MFA%20%E7%8B%AC%E7%AB%8B%E9%AA%8C%E6%94%B6&limit=100',
    );
    if (!response.ok) throw new Error('Fixture inventory failed');
    return (await response.json()) as {
      items: { id: string; username: string; displayName: string; status: string }[];
    };
  });
  for (const fixture of priorFixtures.items) {
    if (
      fixture.displayName === 'MFA 独立验收' &&
      /^mfa-[a-f0-9-]{36}@clouddrive\.test$/.test(fixture.username) &&
      fixture.status === 'active'
    ) {
      await write(page, `/native/iam/accounts/${fixture.id}/status`, 'PATCH', {
        status: 'disabled',
      });
    }
  }
  const email = `mfa-${randomUUID()}@clouddrive.test`;
  const password = randomUUID();
  const role = (await write(page, '/roles', 'POST', {
    name: 'MFA 验收-' + randomUUID().slice(0, 8),
    permissions: [],
  })) as { role: { id: string } };
  await write(page, `/native/iam/roles/${role.role.id}/permissions`, 'PUT', {
    expectedRoleVersion: 1,
    permissionKeys: ['iam:account:self:read', 'iam:account:self:password:write'],
  });
  const created = (await write(page, '/users', 'POST', {
    email,
    password,
    name: 'MFA 独立验收',
    roleIds: [role.role.id],
    status: 'active',
  })) as { user: { id: string } };
  const context = await browser.newContext({ baseURL: access.origin, locale: 'zh-CN' });
  try {
    const member = await context.newPage();
    await login(member, email, password);
    await member.getByRole('button', { name: '绑定认证器', exact: true }).click();
    const enrollmentResponse = member.waitForResponse(
      (response) =>
        response.url().endsWith('/native/iam/self/mfa') && response.request().method() === 'POST',
    );
    await member.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
    const enrollment = (await (await enrollmentResponse).json()) as { secret: string; uri: string };
    const uri = new URL(enrollment.uri);
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.searchParams.get('period')).toBe('30');
    expect(uri.searchParams.get('digits')).toBe('6');
    await member.getByRole('button', { name: '确认绑定', exact: true }).click();
    const confirm = member.getByRole('dialog', { name: '确认绑定', exact: true });
    await confirm
      .getByLabel('认证器生成的动态验证码', { exact: true })
      .fill(authenticatorCode(enrollment.secret));
    const confirmed = member.waitForResponse((response) =>
      response.url().endsWith('/native/iam/self/mfa/confirm'),
    );
    await confirm.getByRole('button', { name: '确认', exact: true }).click();
    const confirmation = await confirmed;
    expect(confirmation.ok()).toBe(true);
    const { recoveryCodes } = (await confirmation.json()) as { recoveryCodes: string[] };
    expect(recoveryCodes).toHaveLength(10);
    await expect(member.getByRole('heading', { name: '恢复码', exact: true })).toBeVisible();
    await expect(member.getByRole('button', { name: '解除绑定', exact: true })).toBeVisible();
    await member.getByRole('button', { name: '已保存，收起恢复码', exact: true }).click();
    await expect(member.getByRole('heading', { name: '恢复码', exact: true })).toHaveCount(0);
    await write(member, '/auth/logout', 'POST', { logout: true });
    await login(member, email, password);
    await expect(member.getByLabel('动态验证码或恢复码', { exact: true })).toBeVisible();
    await member.getByLabel('动态验证码或恢复码', { exact: true }).fill(recoveryCodes[0]!);
    await member.getByRole('button', { name: '登录', exact: true }).click();
    await expect(member).toHaveURL(/\/account\/security$/);
    await member.getByRole('button', { name: '解除绑定', exact: true }).click();
    const disable = member.getByRole('dialog', { name: '解除绑定', exact: true });
    await disable.getByLabel('动态验证码或恢复码', { exact: true }).fill(recoveryCodes[1]!);
    await disable.getByRole('button', { name: '确认', exact: true }).click();
    await expect(member.getByRole('button', { name: '绑定认证器', exact: true })).toBeVisible();
    // The browser permits HTTP-valid input; the deployment owns password strength.
    await member.goto('/account');
    await member.getByLabel('当前密码', { exact: true }).fill(password);
    await member.getByLabel('新密码', { exact: true }).fill('Policy12!abc');
    const rejected = member.waitForResponse(
      (response) =>
        response.url().endsWith('/auth/password') && response.request().method() === 'POST',
    );
    await member.getByRole('button', { name: '修改密码', exact: true }).click();
    expect((await rejected).status()).toBe(422);
    await expect(member.getByLabel('新密码', { exact: true })).toHaveValue('Policy12!abc');
  } finally {
    await write(page, `/native/iam/accounts/${created.user.id}/status`, 'PATCH', {
      status: 'disabled',
    });
    const disabled = await page.evaluate(async (email) => {
      const response = await fetch(
        '/api/console/v1/native/iam/accounts?query=' + encodeURIComponent(email),
      );
      if (!response.ok) throw new Error('Fixture cleanup verification failed');
      return (await response.json()) as { items: { status: string }[] };
    }, email);
    expect(disabled.items).toHaveLength(1);
    expect(disabled.items[0]?.status).toBe('disabled');
    await context.close();
  }
});
