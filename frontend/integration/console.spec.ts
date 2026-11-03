import { test, expect } from '@playwright/test';

test('empty SQLite setup, real business writes, protected native pages and logout', async ({
  page,
}) => {
  const token = process.env.CLOUDDRIVE_TEST_SETUP_TOKEN;
  const password = process.env.CLOUDDRIVE_TEST_PASSWORD;
  if (!token || !password)
    throw new Error('Run scripts/Test-Integration.ps1 to create an isolated backend.');
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('/setup');
  await page.getByLabel('姓名', { exact: true }).fill('验收管理员');
  await page.getByLabel('邮箱', { exact: true }).fill('acceptance@clouddrive.test');
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByLabel('设置令牌', { exact: true }).fill(token);
  await page.getByRole('button', { name: '创建管理员', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/users');
  await expect(
    page.getByRole('gridcell', { name: 'acceptance@clouddrive.test', exact: true }),
  ).toBeVisible();
  await page.goto('/workspace');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByRole('dialog').getByLabel('标题', { exact: true }).fill('浏览器真实待办');
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText('浏览器真实待办', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('浏览器真实待办', { exact: true })).toBeVisible();
  await page.goto('/system/departments');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('验收部门');
  await page.getByRole('dialog').getByLabel('编码', { exact: true }).fill('browser_department');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('rowheader', { name: '验收部门', exact: true })).toBeVisible();
  // Persist a real workspace, then execute from the actual browser editor and restore history.
  await page.evaluate(async () => {
    const base = '/api/console/v1';
    const csrf = (await fetch(base + '/auth/csrf').then((response) => response.json())) as {
      token: string;
    };
    const current = await fetch(base + '/api-workbench/workspace');
    const workspace = {
      version: 1,
      projects: [{ id: 'acceptance-project', name: '验收项目' }],
      collections: [
        { id: 'acceptance-collection', projectId: 'acceptance-project', name: '真实集合' },
      ],
      requests: [
        {
          id: 'acceptance-request',
          collectionId: 'acceptance-collection',
          name: '真实策略查询',
          method: 'GET',
          url: 'http://127.0.0.1:8088/api/console/v1/auth/registration-policy',
          params: [],
          headers: [],
          auth: { type: 'none' },
          body: { type: 'none' },
          disguise: { timeoutMs: 5000 },
          extractors: [],
          preScript: '',
          postScript: '',
        },
      ],
      environments: [],
      globals: [],
      tasks: [],
      history: [],
    };
    const saved = await fetch(base + '/api-workbench/workspace', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf.token,
        'If-Match': current.headers.get('ETag') ?? '',
      },
      body: JSON.stringify(workspace),
    });
    if (saved.status !== 204) throw new Error('Real workspace save failed: ' + saved.status);
  });
  await page.goto('/api-workbench');
  await expect(page.getByRole('textbox', { name: '请求 URL', exact: true })).toHaveValue(
    'http://127.0.0.1:8088/api/console/v1/auth/registration-policy',
  );
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '历史', exact: true }).click();
  await expect(page.getByRole('button', { name: /8088\/api\/console/ })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '历史', exact: true }).click();
  await expect(page.getByRole('button', { name: /8088\/api\/console/ })).toBeVisible();
  for (const route of [
    '/system/menus',
    '/system/dictionaries',
    '/analytics',
    '/account/security',
    '/account/tokens',
    '/system-tools/runtime',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
    // Wait for actual API completion rather than accepting a loading placeholder.
    await expect(
      page.getByRole('main').getByText('正在读取服务器数据…', { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('main').getByText('操作未完成', { exact: true })).toHaveCount(0);
  }
  const result = await page.evaluate(async () => {
    const csrf = (await fetch('/api/console/v1/auth/csrf').then((response) => response.json())) as {
      token: string;
    };
    const response = await fetch('/api/console/v1/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: '{}',
    });
    return response.status;
  });
  expect(result).toBe(204);
  await page.reload();
  await expect(page).toHaveURL(/login|session-expired/);
  expect(failures).toEqual([]);
});
