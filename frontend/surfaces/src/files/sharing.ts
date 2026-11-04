import { z } from 'zod';

export const sharePermissionsSchema = z.object({
  browse: z.boolean(),
  preview: z.boolean(),
  download: z.boolean(),
  create: z.boolean(),
  upload: z.boolean(),
  modify: z.boolean(),
  rename: z.boolean(),
  move: z.boolean(),
  copy: z.boolean(),
  delete: z.boolean(),
});
export type SharePermissions = z.infer<typeof sharePermissionsSchema>;
export const readOnlySharePermissions: SharePermissions = Object.freeze({
  browse: true,
  preview: true,
  download: true,
  create: false,
  upload: false,
  modify: false,
  rename: false,
  move: false,
  copy: false,
  delete: false,
});
export const uploadOnlySharePermissions: SharePermissions = Object.freeze({
  ...readOnlySharePermissions,
  browse: false,
  preview: false,
  download: false,
  create: true,
  upload: true,
});
export const editorSharePermissions: SharePermissions = Object.freeze({
  browse: true,
  preview: true,
  download: true,
  create: true,
  upload: true,
  modify: true,
  rename: true,
  move: true,
  copy: true,
  delete: true,
});
export type SharePreset = 'read-only' | 'upload-only' | 'editor' | 'custom';
export function sharePermissionPreset(value: SharePermissions): SharePreset {
  for (const [preset, permissions] of [
    ['read-only', readOnlySharePermissions],
    ['upload-only', uploadOnlySharePermissions],
    ['editor', editorSharePermissions],
  ] as const) {
    if (
      (Object.keys(permissions) as (keyof SharePermissions)[]).every(
        (key) => value[key] === permissions[key],
      )
    )
      return preset;
  }
  if (
    (Object.keys(readOnlySharePermissions) as (keyof SharePermissions)[]).every(
      (key) => value[key] === (key === 'modify' ? true : readOnlySharePermissions[key]),
    )
  )
    return 'editor';
  return 'custom';
}
export function sharePermissionsValid(value: SharePermissions): boolean {
  return (
    Object.values(value).some(Boolean) &&
    (!value.modify || value.preview) &&
    (!(value.rename || value.move || value.copy || value.delete) || value.browse)
  );
}
export const fileShareSchema = z.object({
  id: z.string().uuid(),
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  rootId: z.string().uuid(),
  kind: z.enum(['file', 'folder']).nullable(),
  name: z.string(),
  title: z.string(),
  permissions: sharePermissionsSchema,
  revision: z.number().int().positive().safe(),
  enabled: z.boolean(),
  metadataLimited: z.boolean(),
  hasPassword: z.boolean(),
  createdAt: z.string(),
  expiresAt: z.string(),
  status: z.enum(['active', 'expired', 'revoked', 'unavailable', 'paused', 'limited']),
});
export type FileShare = z.infer<typeof fileShareSchema>;
export type ShareCreate = Readonly<{
  rootId: string;
  password: string;
  expiresAt?: string;
  title: string;
  permissions: SharePermissions;
}>;
export type ShareUpdate = Readonly<{
  title: string;
  expiresAt: string;
  permissions: SharePermissions;
  passwordAction: 'keep' | 'set' | 'remove';
  password: string;
}>;
export type ShareQuery = Readonly<{
  search: string;
  state: '' | 'active' | 'paused' | 'expired' | 'revoked';
  sort: 'newest' | 'oldest' | 'name';
  page: number;
}>;
export const shareListingSchema = z.object({
  items: z.array(fileShareSchema).max(20),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(20),
  metadataLimited: z.boolean(),
});
export type ShareListing = z.infer<typeof shareListingSchema>;

export const shareDownloadGrantSchema = z.object({
  ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expiresAt: z.string(),
});
export const publicFileEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: z.enum(['file', 'folder', 'shortcut']),
  sizeBytes: z.number().int().nonnegative().safe(),
  mediaType: z.string(),
  updatedAt: z.string(),
  contentRevision: z.number().int().positive().safe(),
});
export type PublicFileEntry = z.infer<typeof publicFileEntrySchema>;
export const publicShareLimitsSchema = z.object({
  maxFileBytes: z.number().int().positive().max(536870912),
  maxTextBytes: z.number().int().positive().max(1048576),
  maxPreviewBytes: z.number().int().positive().max(33554432),
  batchEntries: z.number().int().positive().max(20),
});
export const publicShareSchema = z
  .object({
    locked: z.boolean(),
    root: publicFileEntrySchema.optional(),
    title: z.string().optional(),
    revision: z.number().int().positive().safe().optional(),
    permissions: sharePermissionsSchema.optional(),
    limits: publicShareLimitsSchema.optional(),
    expiresAt: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!value.locked && (!value.root || !value.permissions || !value.revision || !value.limits))
      ctx.addIssue({ code: 'custom', message: 'Unlocked share capabilities missing' });
    if (value.locked && (value.root || value.permissions || value.limits || value.revision))
      ctx.addIssue({ code: 'custom', message: 'Locked share disclosed capabilities' });
  });
export type PublicShare = z.infer<typeof publicShareSchema>;
export const publicFileListingSchema = z.object({
  items: z.array(publicFileEntrySchema).max(20),
  breadcrumbs: z.array(publicFileEntrySchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(20),
});
export type PublicFileListing = z.infer<typeof publicFileListingSchema>;
export const shareUnlockSchema = shareDownloadGrantSchema;
export const publicTextSchema = z.object({
  entry: publicFileEntrySchema,
  text: z.string().max(1048576),
});
export type PublicText = z.infer<typeof publicTextSchema>;
export type PublicFileQuery = Readonly<{
  parent: string;
  search: string;
  sort: 'name' | 'size' | 'updated' | 'created';
  desc: boolean;
  scope: 'folder' | 'tree';
  page: number;
}>;
export type SharedItemAction = 'rename' | 'move' | 'copy' | 'trash';
export const sharedItemErrorSchema = z.enum([
  '',
  'locked',
  'forbidden',
  'missing',
  'conflict',
  'quota',
  'busy',
  'large',
  'invalid',
  'unsupported',
  'canceled',
  'unavailable',
]);
export const sharedBatchSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        entry: publicFileEntrySchema.optional(),
        errorCode: sharedItemErrorSchema,
      }),
    )
    .max(20),
});
export type SharedBatchResult = z.infer<typeof sharedBatchSchema>;
export type PublicUploadCandidate = Readonly<{ id: string; name: string; sizeBytes: number }>;
export type PublicUploadProgress = Readonly<{
  phase: 'hashing' | 'uploading' | 'committing' | 'completed';
  processedBytes: number;
  totalBytes: number;
}>;
export const sharedTransferSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative().safe(),
  offsetBytes: z.number().int().nonnegative().safe(),
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
  entryId: z.string(),
  chunkBytes: z.number().int().positive().max(4194304),
  expiresAt: z.string(),
  cleanupPending: z.boolean(),
});
export type PublicFilesPort = Readonly<{
  saveShortcutHref(): string;
  newClientKey(): string;
  metadata(signal?: AbortSignal): Promise<PublicShare>;
  unlock(password: string, signal?: AbortSignal): Promise<void>;
  entries(query: PublicFileQuery, signal?: AbortSignal): Promise<PublicFileListing>;
  readText(entry: PublicFileEntry, signal?: AbortSignal): Promise<PublicText>;
  createFolder(parent: string, name: string): Promise<PublicFileEntry>;
  createText(
    input: Readonly<{ parentId: string; name: string; text: string; clientKey: string }>,
  ): Promise<PublicFileEntry>;
  replaceText(entry: PublicFileEntry, text: string): Promise<PublicFileEntry>;
  changeItem(
    entry: PublicFileEntry,
    action: SharedItemAction,
    options?: Readonly<{ name?: string; parentId?: string }>,
  ): Promise<PublicFileEntry>;
  batch(
    entries: readonly PublicFileEntry[],
    action: 'move' | 'copy' | 'trash',
    parentId: string,
  ): Promise<SharedBatchResult>;
  archive(entries: readonly PublicFileEntry[], signal?: AbortSignal): Promise<void>;
  chooseUploads(): Promise<readonly PublicUploadCandidate[]>;
  releaseUpload(id: string): void;
  upload(
    candidate: PublicUploadCandidate,
    parent: string,
    onProgress: (progress: PublicUploadProgress) => void,
    signal: AbortSignal,
  ): Promise<void>;
  download(entry: PublicFileEntry): Promise<void>;
}>;
