import { z } from 'zod';

export type FilesErrorCode =
  | 'unavailable'
  | 'unauthenticated'
  | 'forbidden'
  | 'missing'
  | 'conflict'
  | 'quota'
  | 'large'
  | 'busy'
  | 'unsupported'
  | 'canceled';
export class FilesError extends Error {
  constructor(
    public readonly code: FilesErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Files: ${code}`, options);
  }
}

export const fileEntrySchema = z.object({
  id: z.string(),
  parentId: z.string(),
  kind: z.enum(['file', 'folder']),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  mediaType: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  trashedAt: z.string().nullable(),
});
export type FileEntry = z.infer<typeof fileEntrySchema>;
export const fileListingSchema = z.object({
  items: z.array(fileEntrySchema),
  breadcrumbs: z.array(fileEntrySchema),
  usedBytes: z.number(),
  quotaBytes: z.number().positive(),
  maxFileBytes: z.number().positive(),
  concurrentUploads: z.number().int().positive(),
});
export type FileListing = z.infer<typeof fileListingSchema>;
export const fileDetailSchema = z.object({
  entry: fileEntrySchema,
  breadcrumbs: z.array(fileEntrySchema),
});
export type FileQuery = Readonly<{
  parent: string;
  search: string;
  category: string;
  trash: boolean;
  sort: string;
  desc: boolean;
}>;
export type UploadCandidate = Readonly<{ id: string; name: string; sizeBytes: number }>;
export type FileViewPreferences = Readonly<{ view: 'grid' | 'list'; sort: string; desc: boolean }>;
export type FilesPort = Readonly<{
  list(query: FileQuery, signal?: AbortSignal): Promise<FileListing>;
  folder(parentId: string, name: string): Promise<FileEntry>;
  update(id: string, change: { name?: string; parentId?: string }): Promise<FileEntry>;
  trash(id: string): Promise<FileEntry>;
  restore(id: string, parentId?: string): Promise<FileEntry>;
  detail(id: string): Promise<z.infer<typeof fileDetailSchema>>;
  chooseFiles(): Promise<readonly UploadCandidate[]>;
  subscribeDrop(listener: (candidates: readonly UploadCandidate[]) => void): () => void;
  upload(candidate: UploadCandidate, parentId: string, signal: AbortSignal): Promise<FileEntry>;
  releaseCandidate(id: string): void;
  download(entry: FileEntry): Promise<void>;
  preview(entry: FileEntry, signal?: AbortSignal): Promise<string>;
  loadPreferences(): FileViewPreferences;
  savePreferences(value: FileViewPreferences): void;
}>;
