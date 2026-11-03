import { expect, test } from '@playwright/test';

test('Pending export confirmation blocks early close and duplicate submission', async ({
  page,
}) => {
  let release: () => void = () => undefined;
  let held = false;
  let downloads = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  page.on('download', () => downloads++);
  // The actual export dependency is deferred to keep the real operation pending.
  await page.route(
    '**/surfaces_plugins_page-archetypes_src_browser-reference-export_ts_*.js',
    async (route) => {
      held = true;
      await gate;
      await route.continue();
    },
  );
  try {
    await page.goto('/page-archetypes/resource-list');
    const rows = page.getByRole('grid').getByRole('row');
    await rows.nth(1).click();
    await rows.nth(2).click();
    await page.getByRole('button', { name: '导出已选', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: '导出所选 2 条？', exact: true });
    const confirm = dialog.getByRole('button', { name: '确认', exact: true });
    await confirm.click();
    await expect.poll(() => held).toBe(true);
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await confirm.evaluate((button) => {
      if (!(button instanceof HTMLButtonElement)) throw new Error('Missing confirmation button');
      button.click();
      button.click();
    });
    await page.mouse.click(10, 10);
    await expect(dialog).toBeVisible();
    const downloaded = page.waitForEvent('download');
    release();
    expect((await downloaded).suggestedFilename()).toBe('frontend-reference-snapshot.json');
    await expect(dialog).not.toBeVisible();
    expect(downloads).toBe(1);
  } finally {
    release();
  }
});
