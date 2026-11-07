import { z } from 'zod';
import { fileEntrySchema } from './model';
const archiveMemberSchema = z.object({
  path: z.string().min(1).max(4096),
  kind: z.enum(['file', 'folder']),
  sizeBytes: z.number().int().nonnegative(),
});
export type ArchiveMember = z.infer<typeof archiveMemberSchema>;
export const archiveManifestSchema = z.object({
  entry: fileEntrySchema,
  format: z.enum(['zip', '7z']),
  members: z.array(archiveMemberSchema).max(500),
  totalBytes: z.number().int().nonnegative(),
  maxBytes: z.number().int().positive(),
  maxMembers: z.number().int().positive(),
  maxTextBytes: z.number().int().positive(),
  maxImageBytes: z.number().int().positive(),
});
export type ArchiveManifest = z.infer<typeof archiveManifestSchema>;
export const archiveReceiptSchema = z.object({
  destinationId: z.string(),
  created: z.array(fileEntrySchema).max(500),
  skipped: z.array(z.string()).max(500),
  renamed: z.array(z.object({ path: z.string(), name: z.string() })).max(500),
});
export type ArchiveReceipt = z.infer<typeof archiveReceiptSchema>;
export type ArchiveAccess = Readonly<{ id: string; expectedRevision: number; password: string }>;
export type ArchiveSelection = Readonly<{ mode: 'all' | 'selected'; paths: readonly string[] }>;
export type ArchiveConflict = 'reject' | 'skip' | 'rename';
export type ArchiveExtract = Readonly<{
  selection: ArchiveSelection;
  parentId: string;
  folderName: string;
  conflict: ArchiveConflict;
}>;
const archiveTaskCount = z.number().int().nonnegative().max(500);
export const archiveTaskSchema = z.object({
  id: z.string().uuid(),
  sourceName: z.string(),
  destinationId: z.string(),
  state: z.enum(['queued', 'running', 'publishing', 'completed', 'failed', 'canceled']),
  failureCode: z.enum([
    '',
    'archive_interrupted',
    'timeout',
    'archive_forbidden',
    'archive_password',
    'archive_checksum',
    'archive_worker_unavailable',
    'not_found',
    'quota',
    'write_locked',
    'conflict',
    'too_large',
    'unsupported',
    'invalid',
    'unavailable',
  ]),
  createdCount: archiveTaskCount,
  skippedCount: archiveTaskCount,
  renamedCount: archiveTaskCount,
  cleanupPending: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const archiveTaskListingSchema = z.object({
  available: z.boolean(),
  items: z.array(archiveTaskSchema).max(50),
});
export type ArchiveTask = z.infer<typeof archiveTaskSchema>;
export type ArchiveTaskListing = z.infer<typeof archiveTaskListingSchema>;
export type ArchiveTaskSource = Readonly<{ id: string; expectedRevision: number }>;
// ArchiveImageLease 的浏览器资源只由Host创建，调用方在关闭预览时归还。
export type ArchiveImageLease = Readonly<{ url: string; release: () => void }>;
export type ArchivesPort = Readonly<{
  inspect(access: ArchiveAccess, signal?: AbortSignal): Promise<ArchiveManifest>;
  text(
    access: ArchiveAccess,
    member: ArchiveMember,
    maxBytes: number,
    signal: AbortSignal,
  ): Promise<string>;
  image(
    access: ArchiveAccess,
    member: ArchiveMember,
    maxBytes: number,
    signal: AbortSignal,
  ): Promise<ArchiveImageLease>;
  download(access: ArchiveAccess, member: ArchiveMember, signal?: AbortSignal): Promise<void>;
  downloadSelection(
    access: ArchiveAccess,
    selection: ArchiveSelection,
    signal?: AbortSignal,
  ): Promise<void>;
  extract(
    access: ArchiveAccess,
    input: ArchiveExtract,
    signal?: AbortSignal,
  ): Promise<ArchiveReceipt>;
  newTaskKey(): string;
  queue(
    source: ArchiveTaskSource,
    input: ArchiveExtract,
    key: string,
    signal?: AbortSignal,
  ): Promise<ArchiveTask>;
  listTasks(signal: AbortSignal): Promise<ArchiveTaskListing>;
  cancelTask(id: string, signal: AbortSignal): Promise<void>;
  removeTask(id: string, signal: AbortSignal): Promise<void>;
  watchTasks(refresh: () => void): () => void;
}>;
