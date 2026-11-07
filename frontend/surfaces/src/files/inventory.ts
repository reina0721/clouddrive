import { z } from 'zod';

export const inventorySorts = ['id', 'name', 'size', 'created'] as const;
export type InventorySort = (typeof inventorySorts)[number];
export const inventoryKinds = ['file', 'folder', 'shortcut'] as const;
export const inventoryTrashStates = ['any', 'direct', 'unmarked'] as const;
export const maxInventoryPage = 10000;

export type InventoryQuery = {
  ownerId: string;
  name: string;
  kind: '' | (typeof inventoryKinds)[number];
  trash: (typeof inventoryTrashStates)[number];
  hasShare: boolean;
  hasDirectLink: boolean;
  sort: InventorySort;
  direction: 'asc' | 'desc';
  page: number;
};

export const inventoryItemSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  parentId: z.string(),
  name: z.string(),
  kind: z.enum(inventoryKinds),
  sizeBytes: z.number().int().nonnegative(),
  quotaBytes: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  historyCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  trashedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  hasShare: z.boolean(),
  hasDirectLink: z.boolean(),
});
export const inventoryPageSchema = z.object({
  items: z.array(inventoryItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type InventoryPage = z.infer<typeof inventoryPageSchema>;
