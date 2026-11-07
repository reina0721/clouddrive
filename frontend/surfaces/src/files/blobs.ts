import { z } from 'zod';
import type { InventoryQuery } from './inventory';

export const blobSorts = ['id', 'size', 'references', 'first-file'] as const;
export const blobReferenceFilters = ['any', 'current', 'history', 'history-only'] as const;
export const blobStorageFilters = ['any', 'primary'] as const;

export type BlobQuery = Pick<InventoryQuery, 'ownerId' | 'direction' | 'page'> & {
  reference: (typeof blobReferenceFilters)[number];
  storage: (typeof blobStorageFilters)[number];
  sort: (typeof blobSorts)[number];
};

const blobItemSchema = z.object({
  id: z.string(),
  storage: z.literal('primary'),
  sizeBytes: z.number().int().nonnegative(),
  referenceCount: z.number().int().positive(),
  currentCount: z.number().int().nonnegative(),
  historyCount: z.number().int().nonnegative(),
  ownerCount: z.number().int().positive(),
  firstFileCreated: z.string(),
});
const blobPagination = {
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
};
export const blobPageSchema = z.object({
  items: z.array(blobItemSchema),
  total: z.number().int().nonnegative(),
  ...blobPagination,
});
export const blobDetailSchema = z.object({
  blob: blobItemSchema,
  references: z.array(
    z.object({
      fileId: z.string(),
      ownerId: z.string(),
      name: z.string(),
      revision: z.number().int().positive(),
      current: z.boolean(),
      trashed: z.boolean(),
    }),
  ),
  exists: z.boolean(),
  ...blobPagination,
});
export type BlobItem = z.infer<typeof blobItemSchema>;
export type BlobPage = z.infer<typeof blobPageSchema>;
export type BlobDetail = z.infer<typeof blobDetailSchema>;
