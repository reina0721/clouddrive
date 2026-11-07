import type { DownloadsPort, OfflineDownload } from '../../../src/files/downloads';
import { FilesError, type FilesPort } from '../../../src/files/model';

export async function openDownloadResult(
  files: FilesPort,
  downloads: DownloadsPort,
  task: Pick<OfflineDownload, 'id'>,
) {
  const current = await downloads.read(task);
  if (!current.resultAvailable || !current.entryId) throw new FilesError('missing');
  const { entry } = await files.detail(current.entryId);
  files.openFolder(current.resultIsFolder ? entry.id : entry.parentId);
}
