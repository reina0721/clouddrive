import type { FileBrowseQuery, FilesDestination } from '@clouddrive/surface/files';

/** fileDestinationHrefs 由Host统一拥有文件工作区的链接位置。 */
export const fileDestinationHrefs = {
  files: '/home',
  shares: '/home/shares',
  shared: '/home/shared',
  transfers: '/home/transfers',
  downloads: '/home/downloads',
  tasks: '/home/tasks',
  connections: '/home/connections',
  workspace: '/workspace',
  account: '/account',
} as const satisfies Record<FilesDestination, string>;

/** fileDestinationHref 集中编码浏览条件，导航和原生链接共用。 */
export function fileDestinationHref(
  destination: FilesDestination,
  query?: FileBrowseQuery,
): string {
  const params = new URLSearchParams();
  if (destination === 'files' && query)
    for (const [key, value] of Object.entries(query))
      if (key !== 'task' && value) params.set(key, value);
  if (destination === 'downloads' && query?.task) params.set('task', query.task);
  return fileDestinationHrefs[destination] + (params.size ? '?' + params.toString() : '');
}
