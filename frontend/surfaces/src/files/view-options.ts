import { z } from 'zod';

export const fileSortKeys = ['name', 'size', 'updated', 'created'] as const;
export const fileColumnKeys = ['size', 'kind', 'updated', 'created'] as const;
export const filePageSizes = [50, 100, 200] as const;
export type FileColumn = (typeof fileColumnKeys)[number];
export const defaultFileViewPreferences = {
  view: 'grid',
  sort: 'name',
  desc: false,
  foldersFirst: false,
  thumbnails: true,
  pageSize: 50,
  columns: ['size', 'updated'],
} as const;
export const fileViewPreferencesSchema = z
  .object({
    view: z.enum(['grid', 'list', 'gallery']),
    sort: z.enum(fileSortKeys),
    desc: z.boolean(),
    foldersFirst: z.boolean().default(defaultFileViewPreferences.foldersFirst),
    thumbnails: z.boolean().default(defaultFileViewPreferences.thumbnails),
    pageSize: z
      .union([
        z.literal(filePageSizes[0]),
        z.literal(filePageSizes[1]),
        z.literal(filePageSizes[2]),
      ])
      .default(defaultFileViewPreferences.pageSize),
    columns: z
      .array(z.enum(fileColumnKeys))
      .max(fileColumnKeys.length)
      .refine((values) => new Set(values).size === values.length)
      .default([...defaultFileViewPreferences.columns]),
  })
  .strict();
export type FileViewPreferences = z.infer<typeof fileViewPreferencesSchema>;
