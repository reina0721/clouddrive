import { z } from 'zod';

export type TrashPurgeSelection =
  | Readonly<{ scope: 'all'; ids: readonly [] }>
  | Readonly<{ scope: 'selection'; ids: readonly string[] }>;

export const trashPurgePreviewSchema = z.object({
  rootCount: z.number().int().nonnegative(),
  entryCount: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  snapshot: z.string().regex(/^[a-f0-9]{64}$/),
});
export type TrashPurgePreview = z.infer<typeof trashPurgePreviewSchema>;
