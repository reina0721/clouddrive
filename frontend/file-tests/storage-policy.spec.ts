import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { StoragePolicy } from '../surfaces/src/files/storage-policy';
import {
  customizeLimit,
  loginStorage,
  selectStorageUnit,
  storageRequest,
  storageSection,
} from './storage-fixture';

test('存储摘要显示真实用量，大小单位精确往返并保存待生效限额', async ({ page }, info) => {
  test.skip(!process.env.CLOUDDRIVE_FILE_TEST_ACCESS, '写入只使用显式指定的隔离预览。');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginStorage(page);
  const initial = await storageRequest<StoragePolicy>(page);
  const main = page.getByRole('main');
  const limits = storageSection(page, '上传限额');
  await expect(main.getByRole('textbox')).toHaveCount(0);
  await expect(main.getByText('本机存储', { exact: true })).toBeVisible();
  await main.getByRole('button', { name: '计算内容用量', exact: true }).click();
  await expect(main.getByText('已引用内容', { exact: true })).toBeVisible();
  await expect(main.getByText('统计时间', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('storage-overview-desktop.png'), fullPage: true });
  try {
    await limits.getByRole('button', { name: '编辑上传限额', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '编辑上传限额', exact: true });
    const save = dialog.getByRole('button', { name: '保存限额', exact: true });
    await expect(save).toBeDisabled();
    const group = await customizeLimit(page, dialog, '上传分片上限', '0');
    const amount = group.getByRole('textbox', { name: '上传分片上限', exact: true });
    await amount.press('Enter');
    await expect(group.getByText(/请输入 1 B 至/)).toBeVisible();
    await expect(amount).toBeFocused();
    await amount.fill('1.5');
    await selectStorageUnit(page, group, '上传分片上限', 'GiB');
    await expect(amount).toHaveValue('0.00146484375');
    await selectStorageUnit(page, group, '上传分片上限', 'MiB');
    await expect(amount).toHaveValue('1.5');
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(
      dialog.getByRole('textbox', { name: '上传分片上限', exact: true }),
    ).toHaveAttribute('inputmode', 'decimal');
    await expect
      .poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth))
      .toBe(true);
    await expect
      .poll(
        async () =>
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      )
      .toEqual([]);
    await page.screenshot({ path: info.outputPath('storage-limits-mobile.png') });
    await save.click();
    await expect(dialog).toHaveCount(0);
    await expect(limits).toContainText('已保存，等待服务重启');
    const saved = await storageRequest<StoragePolicy>(page);
    expect(saved.overrides.chunkBytes).toBe(1572864);
    expect(saved.active).toEqual(initial.active);
    await page.reload();
    await expect(limits).toContainText('1.5 MiB');
    await limits.getByRole('button', { name: '编辑上传限额', exact: true }).click();
    const restored = page.getByRole('dialog', { name: '编辑上传限额', exact: true });
    const inherit = restored
      .getByRole('group', { name: '上传分片上限', exact: true })
      .getByRole('checkbox');
    if (!(await inherit.isChecked())) await inherit.press('Space');
    await restored.getByRole('button', { name: '保存限额', exact: true }).click();
    await expect(restored).toHaveCount(0);
    expect((await storageRequest<StoragePolicy>(page)).overrides.chunkBytes).toBeUndefined();
  } finally {
    const latest = await storageRequest<StoragePolicy>(page);
    await storageRequest(page, '', 'PUT', {
      revision: latest.revision,
      overrides: initial.overrides,
    });
  }
});
