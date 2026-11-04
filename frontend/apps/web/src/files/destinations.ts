import type { FilesDestination } from '@clouddrive/surface/files';

/** fileDestinationHrefs 由Host统一拥有文件工作区的链接位置。 */
export const fileDestinationHrefs = {
  files: '/home',
  shares: '/home/shares',
  shared: '/home/shared',
  transfers: '/home/transfers',
  connections: '/home/connections',
  workspace: '/workspace',
  account: '/account',
} as const satisfies Record<FilesDestination, string>;
