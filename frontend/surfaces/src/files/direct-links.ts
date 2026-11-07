import { z } from 'zod';

export const directLinkBatchLimit = 10;
export const directLinkTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const directLinkSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  token: z.string().regex(directLinkTokenPattern),
  createdAt: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export const directLinkPageSchema = z.object({
  items: z.array(directLinkSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export const directLinkIssueSchema = z.object({
  results: z.array(
    z.union([
      z.object({ entryId: z.string(), link: directLinkSchema }),
      z.object({ entryId: z.string(), failure: z.enum(['unavailable', 'limit']) }),
    ]),
  ),
});
export type DirectLink = z.infer<typeof directLinkSchema>;
export type DirectLinkPage = z.infer<typeof directLinkPageSchema>;
export type DirectLinkResult = z.infer<typeof directLinkIssueSchema>['results'][number];
export type DirectLinkDelivery = 'view' | 'download';
