import { z } from 'zod';

const settingsValues = z.object({
  pagination: z.enum(['numbered', 'cursor']),
  maxPageSize: z.number().int().positive(),
  textBytes: z.number().int().positive(),
  batchEntries: z.number().int().positive(),
  historyEnabled: z.boolean(),
  historyPerFile: z.number().int().positive(),
  trashScanSeconds: z.number().positive(),
  blobScanSeconds: z.number().positive(),
  automaticBlob: z.boolean(),
});
const settingsOverrides = settingsValues.partial();
const settingsInput = z.object({
  revision: z.number().int().nonnegative(),
  overrides: settingsOverrides,
});
export const filesystemSettingsSchema = settingsInput.extend({
  defaults: settingsValues,
  configured: settingsValues,
  active: settingsValues,
  pendingRestart: z.boolean(),
  trashSchedulerAvailable: z.boolean(),
  blobSchedulerAvailable: z.boolean(),
  canSave: z.boolean(),
});

export type FilesystemSettings = z.infer<typeof filesystemSettingsSchema>;
export type FilesystemSettingsInput = z.infer<typeof settingsInput>;
