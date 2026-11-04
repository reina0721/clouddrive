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
}>;
