import type { HistoryPreferences } from './history-preferences';
import type { FileAccessPort } from './access';
import { pdfReaderLimitsSchema } from './pdf-contract';
import { z } from 'zod';
import { annotationLimitsSchema, annotationSummarySchema } from './annotation-values';
import type { AnnotationsPort } from './annotations';
import type { FileClipboardPort } from './clipboard';
import type { FileFilters } from './search';
import type { FileShare, ShareCreate, ShareListing, ShareQuery, ShareUpdate } from './sharing';
import type { VersionsPort } from './versions';
import type { FilePreferenceSnapshot } from './preferences';
import type { FileSidebarPreferences } from './sidebar-preferences';
export * from './sharing';
export type { FileViewPreferences } from './view-options';

export type FilesErrorCode =
  | 'archive-password'
  | 'archive-checksum'
  | 'archive-worker'
  | 'timeout'
  | 'metadata-limited'
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
  pdfReader: pdfReaderLimitsSchema,
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
export type FileBrowseQuery = Readonly<{
  parent?: string;
  category?: string;
  trash?: string;
  search?: string;
  filter?: string;
  page?: string;
}>;
export type FilesDestination =
  | 'files'
  | 'shares'
  | 'shared'
  | 'transfers'
  | 'downloads'
  | 'connections'
  | 'workspace'
  | 'account';
export type FilesPort = Readonly<{
  access: FileAccessPort;
  clipboard: FileClipboardPort;
  versions: VersionsPort;
  annotations: AnnotationsPort;
  navigate(destination: FilesDestination, query?: FileBrowseQuery): void;
  destinationHref(destination: FilesDestination, query?: FileBrowseQuery): string;
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
  shares(query: ShareQuery, signal?: AbortSignal): Promise<ShareListing>;
  readShare(id: string, signal?: AbortSignal): Promise<FileShare>;
  updateShare(share: FileShare, input: ShareUpdate): Promise<FileShare>;
  setShareEnabled(share: FileShare, enabled: boolean): Promise<FileShare>;
  createShare(input: ShareCreate): Promise<FileShare>;
  revokeShare(id: string): Promise<FileShare>;
  shareLink(token: string): string;
  copyShareLink(token: string): Promise<void>;
  detail(id: string): Promise<z.infer<typeof fileDetailSchema>>;
  chooseFiles(): Promise<readonly UploadCandidate[]>;
  chooseDirectory(): Promise<readonly UploadCandidate[]>;
  subscribeShortcuts(
    listener: (shortcut: FileShortcut) => void,
    accepted?: readonly FileShortcut[],
  ): () => void;
  focusSearch(): void;
  focusFiles(): void;
  focusEntry(id: string): void;
  subscribeDrop(listener: (candidates: readonly UploadCandidate[]) => void): () => void;
  releaseCandidate(id: string): void;
  download(entry: FileEntry): Promise<void>;
  preview(entry: FileEntry, signal?: AbortSignal): Promise<string>;
  loadSidebarPreferences(): FileSidebarPreferences;
  saveSidebarPreferences(value: FileSidebarPreferences): void;
  loadPreferences(
    signal?: AbortSignal,
    source?: 'current' | 'server',
  ): Promise<FilePreferenceSnapshot>;
  savePreferences(value: FilePreferenceSnapshot): Promise<FilePreferenceSnapshot>;
  loadHistoryPreferences(signal?: AbortSignal): Promise<HistoryPreferences>;
  saveHistoryPreferences(
    value: HistoryPreferences,
    signal?: AbortSignal,
  ): Promise<HistoryPreferences>;
}>;
