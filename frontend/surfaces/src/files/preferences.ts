import { z } from 'zod';
import {
  defaultFileViewPreferences,
  fileViewPreferencesSchema,
  type FileViewPreferences,
} from './view-options';

export const maxPreferenceFolders = 200;
export const filePreferencesSchema = z
  .object({
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    rememberFolders: z.boolean(),
    folderClick: z.enum(['open', 'select']),
    defaults: fileViewPreferencesSchema,
    folders: z
      .array(
        z
          .object({ parentId: z.union([z.literal(''), z.uuid()]), view: fileViewPreferencesSchema })
          .strict(),
      )
      .max(maxPreferenceFolders)
      .refine(
        (folders) => new Set(folders.map((folder) => folder.parentId)).size === folders.length,
      ),
  })
  .strict();
export type FilePreferences = z.infer<typeof filePreferencesSchema>;
export const filePreferenceSnapshotSchema = z
  .object({ sync: z.boolean(), configuration: filePreferencesSchema })
  .strict();
export type FilePreferenceSnapshot = z.infer<typeof filePreferenceSnapshotSchema>;
export function defaultFilePreferences(): FilePreferences {
  return filePreferencesSchema.parse({
    revision: 0,
    rememberFolders: false,
    folderClick: 'open',
    defaults: defaultFileViewPreferences,
    folders: [],
  });
}
export function resolveFileView(
  preferences: FilePreferences,
  parentId?: string,
): FileViewPreferences {
  return (
    (preferences.rememberFolders && parentId !== undefined
      ? preferences.folders.find((folder) => folder.parentId === parentId)?.view
      : undefined) ?? preferences.defaults
  );
}
export function changeFileView(
  preferences: FilePreferences,
  view: FileViewPreferences,
  parentId?: string,
): FilePreferences {
  if (!preferences.rememberFolders || parentId === undefined)
    return { ...preferences, defaults: view };
  return filePreferencesSchema.parse({
    ...preferences,
    folders: [
      ...preferences.folders.filter((folder) => folder.parentId !== parentId),
      { parentId, view },
    ],
  });
}
