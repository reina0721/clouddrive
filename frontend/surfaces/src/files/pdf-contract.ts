import { z } from 'zod';
import type { FileEntry } from './model';

export const pdfReaderLimitsSchema = z.object({
  maxBytes: z.number().int().positive().safe(),
  maxPages: z.number().int().positive().safe(),
  maxCanvasPixels: z.number().int().positive().safe(),
  maxImagePixels: z.number().int().positive().safe(),
  maxOutlineEntries: z.number().int().positive().safe(),
  maxOutlineDepth: z.number().int().positive().safe(),
  maxThumbnailPixels: z.number().int().positive().safe(),
  maxThumbnailBytes: z.number().int().positive().safe(),
  workTimeoutMs: z.number().int().positive().safe(),
  workerReadyTimeoutMs: z.number().int().positive().safe(),
});
export type PDFReaderLimits = z.infer<typeof pdfReaderLimitsSchema>;
export type FileDocumentProps = Readonly<{
  entry: Pick<FileEntry, 'id' | 'name' | 'mediaType' | 'sizeBytes' | 'contentRevision'>;
  limits: PDFReaderLimits;
  version?: number;
  onClose: () => void;
  closeRequestSequence: number;
}>;
/** isPDFDocument 只用于应用分派，读取后仍核验字节签名。 */
export const isPDFDocument = (entry: Pick<FileEntry, 'name' | 'mediaType'>) =>
  entry.mediaType.split(';')[0]?.toLowerCase() === 'application/pdf' || /\.pdf$/i.test(entry.name);
