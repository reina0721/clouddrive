import type { Locator, Page } from '@playwright/test';

/** 管理动作位于每条链接自己的菜单，避免误操作同名文件的其它链接。 */
export async function shareMenuAction(page: Page, row: Locator, label: string) {
  await row.getByRole('button', { name: /的分享操作$|^Share actions for / }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
