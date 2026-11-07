import { z } from 'zod';
import type { FilesErrorCode } from './model';

export const downloadStateSchema = z.enum([
  'queued',
  'resolving',
  'selecting',
  'canceling',
  'fetching',
  'pausing',
  'paused',
  'publishing',
  'completed',
  'failed',
  'canceled',
  'expired',
]);
export const downloadSchema = z.object({
  metadataLimited: z.boolean(),
  id: z.string().uuid(),
  clientKey: z.string(),
  kind: z.enum(['http', 'bittorrent']),
  nodeId: z.string(),
  nodeName: z.string(),
  fileCount: z.number().int().nonnegative(),
  selectedCount: z.number().int().nonnegative(),
  resultIsFolder: z.boolean(),
  cancelRequested: z.boolean(),
  canCopySource: z.boolean(),
  origin: z.string(),
  name: z.string(),
  parentId: z.string(),
  destinationPath: z.string(),
  destinationAvailable: z.boolean(),
  state: downloadStateSchema,
  failureCode: z.string(),
  sourceStatus: z.number().int(),
  declaredBytes: z.number().int().nonnegative().nullable(),
  receivedBytes: z.number().int().nonnegative(),
  rateBytesPerSecond: z.number().finite().nonnegative(),
  progressAt: z.string().nullable(),
  resumable: z.boolean(),
  attempts: z.number().int().nonnegative(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  entryId: z.string(),
  resultAvailable: z.boolean(),
  cleanupPending: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  expiresAt: z.string(),
});
export type OfflineDownload = z.infer<typeof downloadSchema>;
export const torrentCapabilitiesSchema = z.object({
  available: z.boolean(),
  nodes: z.array(z.object({ id: z.string(), name: z.string() })).max(4),
  maxMetadataBytes: z.number().int().positive().max(1048576),
  maxFiles: z.number().int().positive().max(200),
});
export type TorrentCapabilities = z.infer<typeof torrentCapabilitiesSchema>;
export const torrentDetailSchema = z.object({
  task: downloadSchema,
  files: z
    .array(
      z.object({
        index: z.number().int().positive(),
        path: z.string(),
        sizeBytes: z.number().int().nonnegative(),
        selected: z.boolean(),
      }),
    )
    .max(200),
  totalBytes: z.number().int().nonnegative(),
  canSelect: z.boolean(),
});
export type TorrentDetail = z.infer<typeof torrentDetailSchema>;
export type TorrentCreate = Readonly<{
  uri: string;
  torrentBase64: string;
  nodeId: string;
  parentId: string;
  name: string;
  clientKey: string;
}>;
export const downloadListingSchema = z.object({
  metadataLimited: z.boolean(),
  items: z.array(downloadSchema),
  nextCursor: z.string(),
  activeCount: z.number().int().nonnegative(),
  finishedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  available: z.boolean(),
  torrent: torrentCapabilitiesSchema,
  batchEntries: z.number().int().positive().max(20),
  ownerRecords: z.number().int().positive().max(200),
});
export type DownloadListing = z.infer<typeof downloadListingSchema>;
export type DownloadFilter = Readonly<{
  section: 'active' | 'finished' | 'all';
  state: '' | OfflineDownload['state'];
  search: string;
  cursor: string;
}>;
export type DownloadCreate = Readonly<{
  uri: string;
  parentId: string;
  name: string;
  clientKey: string;
}>;
export type DownloadCommand = 'pause' | 'resume' | 'retry' | 'restart' | 'cancel';
export type DownloadBatchAction = 'pause' | 'resume' | 'cancel' | 'remove';
export const downloadBatchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      clientKey: z.string(),
      task: downloadSchema.optional(),
      errorCode: z.string(),
    }),
  ),
});
export type DownloadBatch = z.infer<typeof downloadBatchSchema>;

export function downloadBatchError(code: string): FilesErrorCode {
  const codes: Readonly<Record<string, FilesErrorCode>> = {
    files_offline_metadata_limited: 'metadata-limited',
    files_offline_unavailable: 'unavailable',
    files_offline_limit: 'busy',
    files_offline_permission: 'forbidden',
    files_offline_source_blocked: 'invalid',
    files_offline_resume_unsupported: 'unsupported',
    files_offline_node_unavailable: 'unavailable',
    files_offline_torrent_invalid: 'invalid',
    files_not_found: 'missing',
    files_invalid: 'invalid',
    files_conflict: 'conflict',
    files_quota: 'quota',
    files_busy: 'busy',
    files_canceled: 'canceled',
  };
  return codes[code] ?? 'unavailable';
}

/** DownloadsPort 把私有来源复制、可见性轮询和鉴权生命周期留给Host，Surface只持有有界视图。 */
export type DownloadsPort = Readonly<{
  newClientKey(): string;
  list(filter: DownloadFilter, signal?: AbortSignal): Promise<DownloadListing>;
  read(task: Pick<OfflineDownload, 'id'>, signal?: AbortSignal): Promise<OfflineDownload>;
  create(items: readonly DownloadCreate[], signal?: AbortSignal): Promise<DownloadBatch>;
  pickTorrent(maxBytes: number): Promise<Readonly<{ name: string; base64: string }> | undefined>;
  createTorrent(input: TorrentCreate): Promise<OfflineDownload>;
  torrentDetail(task: OfflineDownload, signal?: AbortSignal): Promise<TorrentDetail>;
  selectTorrent(task: OfflineDownload, indexes: readonly number[]): Promise<OfflineDownload>;
  command(task: OfflineDownload, command: DownloadCommand): Promise<OfflineDownload>;
  retarget(task: OfflineDownload, parentId: string, name: string): Promise<OfflineDownload>;
  remove(task: OfflineDownload): Promise<void>;
  batch(tasks: readonly OfflineDownload[], action: DownloadBatchAction): Promise<DownloadBatch>;
  copySource(task: OfflineDownload): Promise<void>;
  watch(refresh: () => void): () => void;
}>;

export function downloadFinished(task: OfflineDownload): boolean {
  return ['completed', 'failed', 'canceled', 'expired'].includes(task.state);
}
