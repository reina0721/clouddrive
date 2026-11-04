import { z } from 'zod';
import { fileEntrySchema, type FileEntry } from './model';
export const fileHistoryMaxVersions = 20;
export const fileHistoryTextMaxBytes = 1 << 20;
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const fileVersionSchema = z.object({
  revision,
  current: z.boolean(),
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  mediaType: z.string(),
  updatedAt: z.string(),
});
export type FileVersion = z.infer<typeof fileVersionSchema>;
export type VersionOrder = 'newest' | 'oldest';
export const fileVersionPageSchema = z
  .object({
    entry: fileEntrySchema,
    items: z.array(fileVersionSchema).max(fileHistoryMaxVersions + 1),
    page: z.number().int().positive(),
    pageSize: z
      .number()
      .int()
      .positive()
      .max(fileHistoryMaxVersions + 1),
    total: z
      .number()
      .int()
      .positive()
      .max(fileHistoryMaxVersions + 1),
    contentRevision: revision,
    historyRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    historyEnabled: z.boolean(),
    perFile: z.number().int().positive().max(fileHistoryMaxVersions),
    perOwner: z.number().int().positive().max(1000),
    fileHistoryBytes: z.number().int().nonnegative(),
    ownerHistoryBytes: z.number().int().nonnegative(),
    ownerUsedBytes: z.number().int().nonnegative(),
    quotaBytes: z.number().int().positive(),
    maxTextBytes: z.number().int().positive().max(fileHistoryTextMaxBytes),
    maxMediaBytes: z
      .number()
      .int()
      .positive()
      .max(32 << 20),
  })
  .superRefine((page, ctx) => {
    if (
      new Set(page.items.map((v) => v.revision)).size !== page.items.length ||
      page.items.some(
        (v) =>
          v.revision > page.contentRevision || v.current !== (v.revision === page.contentRevision),
      ) ||
      page.fileHistoryBytes > page.ownerHistoryBytes ||
      page.ownerHistoryBytes > page.ownerUsedBytes
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid file version page' });
  });
export type FileVersionPage = z.infer<typeof fileVersionPageSchema>;
export type VersionMutation = Readonly<{
  expectedContentRevision: number;
  expectedHistoryRevision: number;
}>;
export type VersionsPort = Readonly<{
  read(
    id: string,
    page: number,
    order: VersionOrder,
    signal?: AbortSignal,
  ): Promise<FileVersionPage>;
  text(id: string, version: FileVersion, maxBytes: number, signal?: AbortSignal): Promise<string>;
  download(id: string, version: FileVersion): Promise<void>;
  restore(id: string, revision: number, input: VersionMutation): Promise<FileEntry>;
  copy(id: string, revision: number, parentId: string, name: string): Promise<FileEntry>;
  remove(
    id: string,
    input: VersionMutation & { mode: 'selected' | 'all-history'; revisions: readonly number[] },
  ): Promise<void>;
}>;
