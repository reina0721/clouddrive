import { z } from 'zod';

export const maxHistoryExtensions = 32;
export const maxHistoryVersions = 20;
export const historyPreferencesSchema = z
  .object({
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    enabled: z.boolean(),
    extensions: z
      .array(
        z
          .string()
          .min(1)
          .max(32)
          .regex(/^[a-z0-9][a-z0-9_-]*$/),
      )
      .max(maxHistoryExtensions)
      .refine((values) => new Set(values).size === values.length),
    maxVersions: z.number().int().min(0).max(maxHistoryVersions),
  })
  .strict();
export type HistoryPreferences = z.infer<typeof historyPreferencesSchema>;

/** parseHistoryDraft 规范输入后严格校验，不默默移除重复值或非法规则。 */
export function parseHistoryDraft(
  current: HistoryPreferences,
  extensions: string,
  maxVersions: string,
) {
  const values = extensions.trim()
    ? extensions
        .trim()
        .split(/[\s,，;；]+/)
        .map((value) => value.replace(/^\./, '').toLowerCase())
    : [];
  return historyPreferencesSchema.safeParse({
    ...current,
    extensions: values,
    maxVersions: /^(0|[1-9]\d*)$/.test(maxVersions) ? Number(maxVersions) : Number.NaN,
  });
}
