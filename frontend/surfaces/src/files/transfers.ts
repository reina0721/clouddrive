import { z } from 'zod';
import type { UploadCandidate } from './model';

export const maxTransferQueueEntries = 500;

export const transferSchema = z.object({
  id: z.string().uuid(),
  clientKey: z.string(),
  parentId: z.string(),
  destinationPath: z.string(),
  destinationAvailable: z.boolean(),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  offsetBytes: z.number().int().nonnegative(),
  state: z.enum([
    'preparing',
    'receiving',
    'paused',
    'publishing',
    'attention',
    'completed',
    'canceled',
    'expired',
  ]),
  failureCode: z.string(),
  entryId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(),
  revision: z.number().int().positive(),
  cleanupPending: z.boolean(),
});
export type ServerTransfer = z.infer<typeof transferSchema>;
export const transferListingSchema = z.object({
  items: z.array(transferSchema),
  nextCursor: z.string(),
  chunkBytes: z
    .number()
    .int()
    .positive()
    .max(4 * 1024 * 1024),
  maxFileBytes: z
    .number()
    .int()
    .positive()
    .max(512 * 1024 * 1024),
  maxQueueEntries: z.number().int().positive().max(500),
  concurrentUploads: z.number().int().positive().max(2),
});
export type TransferFilter = '' | 'active' | 'attention' | 'completed';
export type TransferPhase =
  | 'waiting'
  | 'hashing'
  | 'uploading'
  | 'paused'
  | 'needs-source'
  | 'publishing'
  | 'attention'
  | 'completed'
  | 'canceled'
  | 'expired'
  | 'failed';
// serverId 为空表示尚未建立服务端会话，remainingSeconds=null 表示当前不能估计。
export type TransferItem = Readonly<{
  id: string;
  serverId: string;
  parentId: string;
  destinationPath: string;
  destinationAvailable: boolean;
  name: string;
  sizeBytes: number;
  confirmedBytes: number;
  hashBytes: number;
  phase: TransferPhase;
  failure: string;
  entryId: string;
  expiresAt: string;
  bytesPerSecond: number;
  remainingSeconds: number | null;
  hasSource: boolean;
}>;
export type TransferSnapshot = Readonly<{
  items: readonly TransferItem[];
  loading: boolean;
  failure: string;
  nextCursor: string;
  filter: TransferFilter;
  completedRevision: number;
  persistenceFailure: boolean;
}>;

export type TransfersPort = Readonly<{
  getSnapshot(): TransferSnapshot;
  subscribe(listener: () => void): () => void;
  enqueue(candidates: readonly UploadCandidate[], parentId: string): Promise<void>;
  refresh(filter?: TransferFilter, cursor?: string): Promise<void>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  cancel(id: string): Promise<void>;
  reselect(id: string): Promise<void>;
  retarget(id: string, parentId: string, name: string): Promise<void>;
  pauseAll(): Promise<void>;
  resumeAll(): Promise<void>;
}>;

export function transferMatches(item: TransferItem, filter: TransferFilter): boolean {
  if (!filter) return true;
  if (filter === 'completed') return item.phase === 'completed';
  if (filter === 'attention')
    return ['attention', 'needs-source', 'failed', 'expired', 'canceled'].includes(item.phase);
  return ['waiting', 'hashing', 'uploading', 'paused', 'needs-source', 'publishing'].includes(
    item.phase,
  );
}
