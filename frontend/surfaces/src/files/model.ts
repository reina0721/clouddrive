import { z } from 'zod';
import { annotationSummarySchema, annotationLimitsSchema } from './annotation-values';
import type { AnnotationsPort } from './annotations';
import type { FileClipboardPort } from './clipboard';
import type { VersionsPort } from './versions';
import type { FileFilters } from './search';
import type { FileViewPreferences } from './view-options';
export type { FileViewPreferences } from './view-options';

export type FilesErrorCode =
  | 'history-full'
  | 'unavailable'
  | 'unauthenticated'
  | 'forbidden'
  | 'missing'
  | 'conflict'
  | 'quota'
  | 'large'
  | 'busy'
  | 'unsupported'
  | 'invalid'
  | 'locked'
  | 'checksum'
  | 'expired'
  | 'canceled';
export class FilesError extends Error {
  constructor(
    public readonly code: FilesErrorCode,
    options?: ErrorOptions,
  ) {
    super(`Files: ${code}`, options);
  }
}

export const fileKindSchema = z.enum(['file', 'folder', 'shortcut']);
export const fileEntrySchema = z.object({
  id: z.string(),
  parentId: z.string(),
  kind: fileKindSchema,
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  mediaType: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  trashedAt: z.string().nullable(),
  contentRevision: z.number().int().positive(),
});
export type FileEntry = z.infer<typeof fileEntrySchema>;
export const fileListingSchema = z.object({
  items: z.array(fileEntrySchema),
  breadcrumbs: z.array(fileEntrySchema),
  usedBytes: z.number(),
  quotaBytes: z.number().positive(),
  maxFileBytes: z.number().positive(),
  concurrentUploads: z.number().int().positive(),
  maxTextBytes: z.number().int().positive(),
  maxArchiveBytes: z.number().int().positive(),
  maxBatchEntries: z.number().int().positive(),
  maxMediaBytes: z.number().int().positive(),
  maxThumbnailBytes: z.number().int().positive(),
  maxGalleryEntries: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative(),
  pageSize: z.number().int().nonnegative(),
  defaultPageSize: z.number().int().positive(),
  maxPageSize: z.number().int().positive(),
  searchTreeEntries: z.number().int().positive(),
  maxKeywords: z.number().int().positive(),
  maxExtensions: z.number().int().positive(),
  annotationSummaries: z.array(annotationSummarySchema),
  annotationLimits: annotationLimitsSchema,
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
  filters?: FileFilters;
  foldersFirst?: boolean;
  page?: number;
  pageSize?: number;
}>;
export type UploadCandidate = Readonly<{
  id: string;
  name: string;
  sizeBytes: number;
  relativePath?: string;
}>;
export type FileShortcut =
  | 'copySelection'
  | 'cutSelection'
  | 'pasteSelection'
  | 'parentFolder'
  | 'search'
  | 'refresh'
  | 'selectAll'
  | 'clearSelection'
  | 'rename'
  | 'trash'
  | 'newFolder'
  | 'open'
  | 'openFocused'
  | 'next'
  | 'previous'
  | 'first'
  | 'last'
  | 'extendNext'
  | 'extendPrevious'
  | 'extendFirst'
  | 'extendLast';
export type FilesDestination =
  'files' | 'shares' | 'shared' | 'transfers' | 'connections' | 'workspace' | 'account';
export type FilesPort = Readonly<{
  clipboard: FileClipboardPort;
  versions: VersionsPort;
  annotations: AnnotationsPort;
  navigate(destination: FilesDestination): void;
  destinationHref(destination: FilesDestination): string;
  openFolder(parentId: string): void;
  list(query: FileQuery, signal?: AbortSignal): Promise<FileListing>;
  folder(parentId: string, name: string): Promise<FileEntry>;
  update(
    id: string,
    change: { name?: string; parentId?: string; expectedRevision?: number },
  ): Promise<FileEntry>;
  trash(id: string): Promise<FileEntry>;
  restore(id: string, parentId?: string): Promise<FileEntry>;
  copy(id: string, parentId: string, name: string): Promise<FileEntry>;
  createText(parentId: string, name: string, text: string): Promise<FileEntry>;
  textBytes(text: string): number;
  replaceText(id: string, expectedRevision: number, text: string): Promise<FileEntry>;
  archive(ids: readonly string[]): Promise<void>;
  shares(signal?: AbortSignal): Promise<readonly FileShare[]>;
  createShare(rootId: string, password: string, expiresAt?: string): Promise<FileShare>;
  revokeShare(id: string): Promise<FileShare>;
  shareLink(token: string): string;
  copyShareLink(token: string): Promise<void>;
  detail(id: string): Promise<z.infer<typeof fileDetailSchema>>;
  chooseFiles(): Promise<readonly UploadCandidate[]>;
  chooseDirectory(): Promise<readonly UploadCandidate[]>;
  subscribeShortcuts(listener: (shortcut: FileShortcut) => void): () => void;
  focusSearch(): void;
  focusFiles(): void;
  focusEntry(id: string): void;
  subscribeDrop(listener: (candidates: readonly UploadCandidate[]) => void): () => void;
  releaseCandidate(id: string): void;
  download(entry: FileEntry): Promise<void>;
  preview(entry: FileEntry, signal?: AbortSignal): Promise<string>;
  loadPreferences(): FileViewPreferences;
  savePreferences(value: FileViewPreferences): void;
}>;

export const fileShareSchema = z.object({
  id: z.string(),
  token: z.string(),
  rootId: z.string(),
  name: z.string(),
  hasPassword: z.boolean(),
  createdAt: z.string(),
  expiresAt: z.string(),
  status: z.enum(['active', 'expired', 'revoked', 'unavailable']),
});
export type FileShare = z.infer<typeof fileShareSchema>;

export const shareDownloadGrantSchema = z.object({
  ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expiresAt: z.string(),
});

export const publicFileEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['file', 'folder', 'shortcut']),
  sizeBytes: z.number().int().nonnegative(),
  mediaType: z.string(),
  updatedAt: z.string(),
});
export type PublicFileEntry = z.infer<typeof publicFileEntrySchema>;
export const publicShareSchema = z.object({
  locked: z.boolean(),
  root: publicFileEntrySchema.optional(),
  expiresAt: z.string(),
});
export const publicFileListingSchema = z.object({
  items: z.array(publicFileEntrySchema),
  breadcrumbs: z.array(publicFileEntrySchema),
});
export const shareUnlockSchema = z.object({ ticket: z.string(), expiresAt: z.string() });
export type PublicFilesPort = Readonly<{
  saveShortcutHref(): string;
  metadata(signal?: AbortSignal): Promise<z.infer<typeof publicShareSchema>>;
  unlock(password: string, signal?: AbortSignal): Promise<void>;
  entries(parent: string, signal?: AbortSignal): Promise<z.infer<typeof publicFileListingSchema>>;
  download(entry: PublicFileEntry): Promise<void>;
}>;
