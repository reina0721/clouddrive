import { z } from 'zod';
import { fileEntrySchema, FilesError } from './model';
import {
  annotationDocumentSchema,
  annotationLimitsSchema,
  annotationSummarySchema,
  annotationValuesSchema,
  annotationEncodedBytes,
  fileAnnotationLimits,
  type FileAnnotationValues,
  type FileAnnotationLimits,
  type FileAnnotationDocument,
  type FileAnnotationTag,
} from './annotation-values';

export const annotationDetailSchema = z.object({
  entry: fileEntrySchema,
  breadcrumbs: z.array(fileEntrySchema),
  annotation: annotationDocumentSchema,
  limits: annotationLimitsSchema,
  statistics: z.object({
    files: z.number().int().nonnegative(),
    folders: z.number().int().nonnegative(),
    shortcuts: z.number().int().nonnegative(),
    logicalBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }),
});
export const annotationBatchResultSchema = z.object({
  items: z.array(annotationSummarySchema).max(fileAnnotationLimits.batchEntries),
});
export const annotationSummariesResultSchema = z.object({
  items: z.array(annotationSummarySchema).max(fileAnnotationLimits.summaryEntries),
});
export type FileAnnotationDetail = z.infer<typeof annotationDetailSchema>;
export type FileAnnotationUpdate = FileAnnotationValues & Readonly<{ expectedRevision: number }>;
export type FileTagBatch = Readonly<{
  targets: readonly Readonly<{ id: string; revision: number }>[];
  add: readonly FileAnnotationTag[];
  remove: readonly string[];
}>;
export type AnnotationsPort = Readonly<{
  read(id: string, signal?: AbortSignal): Promise<FileAnnotationDetail>;
  summaries(
    ids: readonly string[],
    visibility: 'active' | 'trash',
    signal?: AbortSignal,
  ): Promise<z.infer<typeof annotationSummariesResultSchema>>;
  replace(id: string, input: FileAnnotationUpdate): Promise<FileAnnotationDocument>;
  changeTags(input: FileTagBatch): Promise<z.infer<typeof annotationBatchResultSchema>>;
  copyText(value: string): Promise<void>;
}>;

export function validateAnnotationValues(
  value: FileAnnotationValues,
  limits: FileAnnotationLimits,
  kind: string,
): FileAnnotationValues {
  const parsed = annotationValuesSchema.safeParse(value);
  if (!parsed.success || (kind !== 'folder' && value.folderColor))
    throw new FilesError('invalid', { cause: parsed.success ? undefined : parsed.error });
  if (
    parsed.data.tags.length > limits.maxTags ||
    parsed.data.properties.length > limits.maxProperties ||
    annotationEncodedBytes(parsed.data) > limits.maxBytes
  )
    throw new FilesError('large');
  return parsed.data;
}
