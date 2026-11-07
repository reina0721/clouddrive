import { z } from 'zod';

export const adminShareStatuses = ['active', 'paused', 'expired', 'revoked'] as const;
export const adminShareSorts = ['id', 'created', 'views', 'downloads'] as const;
export type AdminShareQuery = {
  ownerId: string;
  rootId: string;
  status: '' | (typeof adminShareStatuses)[number];
  sort: (typeof adminShareSorts)[number];
  direction: 'asc' | 'desc';
  page: number;
};

export const adminShareItemSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  rootId: z.string(),
  rootName: z.string().nullable(),
  title: z.string(),
  status: z.enum(adminShareStatuses),
  hasPassword: z.boolean(),
  views: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
});

export const adminSharePageSchema = z.object({
  items: z.array(adminShareItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  canRevoke: z.boolean(),
});

export const adminShareRevokeSchema = z.object({ revoked: z.number().int().nonnegative() });
export type AdminShareItem = z.infer<typeof adminShareItemSchema>;
export type AdminSharePage = z.infer<typeof adminSharePageSchema>;
export type AdminShareTarget = Pick<AdminShareItem, 'id' | 'revision'>;
