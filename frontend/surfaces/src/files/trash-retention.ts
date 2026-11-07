import { z } from 'zod';

export const maxTrashRetentionDays = 365;
export const trashRetentionSchema = z.object({
  days: z.number().int().min(0).max(maxTrashRetentionDays),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});
export type TrashRetention = z.infer<typeof trashRetentionSchema>;
