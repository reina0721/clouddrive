import { z } from 'zod';
import { FilesError, fileKindSchema } from './model';

export const fileSearchLimits = {
  keywords: 8,
  extensions: 16,
  wordRunes: 255,
  extensionBytes: 32,
  filterChars: 8192,
  encodedFilterBytes: 4096,
  maxPage: 10000,
} as const;
const keyword = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      [...value].length <= fileSearchLimits.wordRunes &&
      ![...value].some((character) => {
        const code = character.codePointAt(0)!;
        return code < 32 || (code >= 127 && code <= 159);
      }),
  );
const extension = z
  .string()
  .trim()
  .transform((value) => value.replace(/^\./, '').toLowerCase())
  .pipe(
    z
      .string()
      .min(1)
      .max(fileSearchLimits.extensionBytes)
      .regex(/^[a-z0-9_+-]+$/),
  );
// 视图日期只表达UTC整日；协议本身仍支持任意RFC3339时刻，避免编辑时悄悄取整。
const instant = z.iso
  .datetime()
  .refine((value) => value.endsWith('T00:00:00.000Z') && Number(value.slice(0, 4)) >= 1);
export const fileFiltersSchema = z
  .object({
    keywords: z.array(keyword).min(1).max(fileSearchLimits.keywords).optional(),
    caseSensitive: z.boolean().optional(),
    match: z.enum(['all', 'any']).optional(),
    scope: z.enum(['folder', 'tree', 'all']).optional(),
    kinds: z
      .array(fileKindSchema)
      .min(1)
      .max(3)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
    extensions: z.array(extension).min(1).max(fileSearchLimits.extensions).optional(),
    minBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    maxBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
    createdFrom: instant.optional(),
    createdTo: instant.optional(),
    modifiedFrom: instant.optional(),
    modifiedTo: instant.optional(),
  })
  .strict()
  .superRefine((filter, ctx) => {
    if (
      filter.minBytes !== undefined &&
      filter.maxBytes !== undefined &&
      filter.minBytes > filter.maxBytes
    )
      ctx.addIssue({ code: 'custom', path: ['maxBytes'], message: 'invalid bounds' });
    for (const [from, to] of [
      ['createdFrom', 'createdTo'],
      ['modifiedFrom', 'modifiedTo'],
    ] as const) {
      if (filter[from] && filter[to] && Date.parse(filter[from]) >= Date.parse(filter[to]))
        ctx.addIssue({ code: 'custom', path: [to], message: 'invalid interval' });
    }
  });
export type FileFilters = z.infer<typeof fileFiltersSchema>;
export const fileFilterKeys = [
  'keywords',
  'caseSensitive',
  'match',
  'scope',
  'kinds',
  'extensions',
  'minBytes',
  'maxBytes',
  'createdFrom',
  'createdTo',
  'modifiedFrom',
  'modifiedTo',
] as const;

/** decodeFileFilters 对畸形深链接明确失败，不默默改成无限制查询。 */
export function decodeFileFilters(value: string | null): FileFilters {
  if (value === null || value === '') return {};
  if (
    value.length > fileSearchLimits.filterChars ||
    encodeURIComponent(value).length > fileSearchLimits.encodedFilterBytes
  )
    throw new FilesError('invalid');
  try {
    const parsed = fileFiltersSchema.parse(JSON.parse(value));
    encodeFileFilters(parsed);
    return parsed;
  } catch (error) {
    throw new FilesError('invalid', { cause: error });
  }
}
export function encodeFileFilters(value: FileFilters): string {
  const parsed = fileFiltersSchema.parse(value),
    ordered: Partial<FileFilters> = {};
  for (const key of fileFilterKeys) {
    const field = parsed[key];
    if (field !== undefined) Object.assign(ordered, { [key]: field });
  }
  const result = JSON.stringify(ordered);
  if (
    result.length > fileSearchLimits.filterChars ||
    encodeURIComponent(result).length > fileSearchLimits.encodedFilterBytes
  )
    throw new FilesError('large');
  return result === '{}' ? '' : result;
}

/** utcDateBoundary 结束日转换为次日零点，保持日期上界排除且覆盖完整当天。 */
export function utcDateBoundary(value: string, boundary: 'from' | 'through'): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FilesError('invalid');
  const instant = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== value)
    throw new FilesError('invalid');
  if (boundary === 'through') instant.setUTCDate(instant.getUTCDate() + 1);
  const result = instant.toISOString();
  if (!/^\d{4}-/.test(result)) throw new FilesError('invalid');
  return result;
}
export function utcInputDate(value: string | undefined, boundary: 'from' | 'through'): string {
  if (!value) return '';
  const instant = new Date(value);
  if (boundary === 'through') instant.setUTCDate(instant.getUTCDate() - 1);
  return instant.toISOString().slice(0, 10);
}

export const fileSizeUnits = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 } as const;
export type FileSizeUnit = keyof typeof fileSizeUnits;
export function fileSizeInput(value: string, unit: FileSizeUnit): number | undefined {
  if (value.trim() === '') return undefined;
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new FilesError('invalid');
  const size = Number(value) * fileSizeUnits[unit];
  if (!Number.isSafeInteger(size) || size < 0) throw new FilesError('invalid');
  return size;
}
