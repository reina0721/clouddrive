import { z } from 'zod';
import { archiveTaskSchema } from './archives';
import { downloadStateSchema } from './downloads';

export const backgroundTaskKinds = ['all', 'zip', 'extract', 'http', 'bittorrent'] as const;
export const backgroundTaskStatuses = [
  'all',
  'active',
  'completed',
  'failed',
  'canceled',
  'expired',
] as const;
export type BackgroundTaskQuery = Readonly<{
  kind: (typeof backgroundTaskKinds)[number];
  status: (typeof backgroundTaskStatuses)[number];
  search: string;
  page: number;
}>;

const downloadBriefSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['http', 'bittorrent']),
  sourceName: z.string(),
  state: downloadStateSchema,
  failureCode: z.string(),
  sourceStatus: z.number().int().nonnegative(),
  declaredBytes: z.number().int().nonnegative().nullable(),
  receivedBytes: z.number().int().nonnegative(),
  rateBytesPerSecond: z.number().finite().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BackgroundDownload = z.infer<typeof downloadBriefSchema>;
export const backgroundTaskListingSchema = z.object({
  items: z.array(z.union([archiveTaskSchema, downloadBriefSchema])).max(20),
  archiveAvailable: z.boolean(),
  total: z.number().int().nonnegative().max(250),
  unfilteredTotal: z.number().int().nonnegative().max(250),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(20),
});
export type BackgroundTaskListing = z.infer<typeof backgroundTaskListingSchema>;

export function isBackgroundDownload(
  task: BackgroundTaskListing['items'][number],
): task is BackgroundDownload {
  return task.kind === 'http' || task.kind === 'bittorrent';
}
