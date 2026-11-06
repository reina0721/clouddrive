import { z } from 'zod';

export const fileSidebarPreferencesSchema = z
  .object({ collapsed: z.boolean(), autoExpandTree: z.boolean() })
  .strict();
export type FileSidebarPreferences = z.infer<typeof fileSidebarPreferencesSchema>;
export const defaultFileSidebarPreferences: FileSidebarPreferences = {
  collapsed: false,
  autoExpandTree: true,
};
