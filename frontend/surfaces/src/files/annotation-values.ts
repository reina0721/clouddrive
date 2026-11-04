import { z } from 'zod';

export const fileAnnotationLimits = {
  maxBytes: 2048,
  tags: 8,
  properties: 8,
  tagRunes: 32,
  keyRunes: 64,
  valueRunes: 256,
  emojiRunes: 16,
  emojiBytes: 64,
  batchEntries: 100,
  summaryEntries: 200,
} as const;
const validCharacters = (value: string, multiline = false) =>
  [...value].every((character) => {
    const code = character.codePointAt(0)!;
    return (
      !(code >= 0xd800 && code <= 0xdfff) &&
      (!(code < 32 || (code >= 127 && code <= 159)) || (multiline && [9, 10, 13].includes(code)))
    );
  });
export const annotationColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase());
export const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.normalize('NFC'))
  .refine((value) => [...value].length <= fileAnnotationLimits.tagRunes && validCharacters(value));
export const annotationTagSchema = z
  .object({ name: tagNameSchema, color: annotationColorSchema })
  .strict();
export const annotationPropertyKeySchema = z
  .string()
  .min(1)
  .transform((value) => value.normalize('NFC'))
  .refine(
    (value) =>
      [...value].length <= fileAnnotationLimits.keyRunes && /^[\p{L}\p{N}_.-]+$/u.test(value),
  );
export const annotationPropertyValueSchema = z
  .string()
  .transform((value) => value.normalize('NFC'))
  .refine(
    (value) => [...value].length <= fileAnnotationLimits.valueRunes && validCharacters(value, true),
  );
export const annotationTagNamesSchema = z
  .array(tagNameSchema)
  .min(1)
  .max(fileAnnotationLimits.tags)
  .refine((names) => new Set(names.map((name) => name.toLowerCase())).size === names.length);

const annotationShape = {
  tags: z
    .array(annotationTagSchema)
    .max(fileAnnotationLimits.tags)
    .refine((tags) => new Set(tags.map((tag) => tag.name.toLowerCase())).size === tags.length),
  properties: z
    .array(
      z.object({ key: annotationPropertyKeySchema, value: annotationPropertyValueSchema }).strict(),
    )
    .max(fileAnnotationLimits.properties)
    .refine(
      (properties) =>
        new Set(properties.map((property) => property.key)).size === properties.length,
    ),
  emoji: z
    .string()
    .refine(
      (value) =>
        value.trim() === value &&
        [...value].length <= fileAnnotationLimits.emojiRunes &&
        new TextEncoder().encode(value).byteLength <= fileAnnotationLimits.emojiBytes &&
        validCharacters(value),
    ),
  folderColor: z.union([z.literal(''), annotationColorSchema]),
};
export const annotationValuesSchema = z.object(annotationShape).strict();
export type FileAnnotationValues = z.infer<typeof annotationValuesSchema>;

// 对齐Go标准JSON的omitempty与HTML转义预算，不把UTF16字符长度当作编码字节。
export function annotationEncodedBytes(value: FileAnnotationValues): number {
  const json = JSON.stringify({
    ...(value.tags.length ? { tags: value.tags } : {}),
    ...(value.properties.length ? { properties: value.properties } : {}),
    ...(value.emoji ? { emoji: value.emoji } : {}),
    ...(value.folderColor ? { folderColor: value.folderColor } : {}),
  });
  return new TextEncoder().encode(
    json.replace(
      /[<>&\u2028\u2029]/g,
      (character) => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'),
    ),
  ).byteLength;
}
export const annotationDocumentSchema = z.object({
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.string(),
  ...annotationShape,
});
export const annotationSummarySchema = z.object({
  entryId: z.string(),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  tags: annotationShape.tags,
  emoji: annotationShape.emoji,
  folderColor: annotationShape.folderColor,
});
export const annotationLimitsSchema = z.object({
  maxBytes: z.number().int().positive().max(fileAnnotationLimits.maxBytes),
  maxTags: z.number().int().positive().max(fileAnnotationLimits.tags),
  maxProperties: z.number().int().positive().max(fileAnnotationLimits.properties),
  maxBatchEntries: z.number().int().positive().max(fileAnnotationLimits.batchEntries),
  maxTagNameRunes: z.number().int().positive(),
  maxPropertyKeyRunes: z.number().int().positive(),
  maxPropertyValueRunes: z.number().int().positive(),
  maxEmojiRunes: z.number().int().positive(),
  maxPathBytes: z.number().int().positive(),
  defaultTagColor: annotationColorSchema,
});
export type FileAnnotationDocument = z.infer<typeof annotationDocumentSchema>;
export type FileAnnotationSummary = z.infer<typeof annotationSummarySchema>;
export type FileAnnotationLimits = z.infer<typeof annotationLimitsSchema>;
export type FileAnnotationTag = z.infer<typeof annotationTagSchema>;

export const annotationPropertyFilterSchema = z
  .object({
    key: annotationPropertyKeySchema,
    match: z.enum(['exists', 'equals', 'contains']),
    value: annotationPropertyValueSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.match === 'exists' && value.value !== undefined && value.value !== '')
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'exists does not accept a value' });
  });
