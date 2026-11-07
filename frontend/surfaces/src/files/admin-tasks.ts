import { z } from 'zod';
import { backgroundTaskKinds, type BackgroundTaskQuery } from './background-tasks';

export const adminTaskKinds = [...backgroundTaskKinds, 'trash-expiry', 'blob-reclaim'] as const;
export const adminTaskOrigins = ['all', 'user', 'system'] as const;
export type AdminTaskFilters = Pick<BackgroundTaskQuery, 'status'> & {
  ownerId: string;
  kind: (typeof adminTaskKinds)[number];
  origin: (typeof adminTaskOrigins)[number];
};
export type AdminTaskQuery = AdminTaskFilters & {
  taskId: string;
  sort: 'id' | 'created';
  direction: 'asc' | 'desc';
  page: number;
};
export type AdminTaskPreviewQuery = AdminTaskFilters & { before: string };

const target = z.object({
  kind: z.enum(adminTaskKinds).exclude(['all']),
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export const adminTaskSchema = target.extend({
  ownerId: z.string(),
  name: z.string(),
  state: z.string(),
  failureCode: z.string(),
  nodeId: z.string(),
  createdAt: z.string(),
  durationMs: z.number().int().nonnegative().nullable(),
  cleanable: z.boolean(),
});
export const adminTaskPageSchema = z.object({
  items: z.array(adminTaskSchema).max(20),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export const adminTaskListSchema = adminTaskPageSchema.extend({ canCleanup: z.boolean() });
export const adminTaskCleanupSchema = z.object({
  items: z.array(target.extend({ status: z.number().int(), code: z.string().optional() })).max(20),
});

export type AdminTask = z.infer<typeof adminTaskSchema>;
export type AdminTaskTarget = z.infer<typeof target>;
export type AdminTaskPage = z.infer<typeof adminTaskPageSchema>;
export type AdminTaskList = z.infer<typeof adminTaskListSchema>;
export type AdminTaskCleanup = z.infer<typeof adminTaskCleanupSchema>;
