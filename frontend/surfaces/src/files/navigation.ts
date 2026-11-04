import { z } from 'zod';
import { fileEntrySchema, type FileEntry } from './model';

export const shortcutStateSchema = z.object({
  status: z.enum(['active', 'revoked', 'expired', 'unavailable', 'paused', 'limited']),
  locked: z.boolean(),
});
export const shortcutListingSchema = z.object({
  items: z.array(
    z.object({
      entry: fileEntrySchema.extend({ kind: z.literal('shortcut') }),
      target: shortcutStateSchema,
    }),
  ),
  nextCursor: z.string(),
  pageSize: z.number().int().positive().max(20),
  shortcutLimit: z.number().int().positive().max(100),
});
export const pinSchema = z.object({
  id: z.string().uuid(),
  targetKind: z.enum(['folder', 'shared', 'shortcut']),
  targetId: z.string(),
  name: z.string(),
  position: z.number().int().nonnegative(),
  available: z.boolean(),
  locked: z.boolean(),
});
export const pinListingSchema = z.object({
  items: z.array(pinSchema).max(20),
  revision: z.number().int().nonnegative(),
  limit: z.number().int().positive().max(20),
  metadataLimited: z.boolean(),
});
export const navigationRevisionSchema = z.object({ revision: z.number().int().positive() });
export type ShortcutListing = z.infer<typeof shortcutListingSchema>;
export type ShortcutSummary = ShortcutListing['items'][number];
export type SavedShareFilter = '' | 'active' | 'protected' | 'unavailable';
export type Pin = z.infer<typeof pinSchema>;
export type PinListing = z.infer<typeof pinListingSchema>;
export type PinTarget = Readonly<{ targetKind: Pin['targetKind']; targetId: string }>;
export type NavigationPort = Readonly<{
  shortcuts(
    query: Readonly<{ search: string; cursor: string; state: SavedShareFilter }>,
    signal?: AbortSignal,
  ): Promise<ShortcutListing>;
  saveShortcut(
    input: Readonly<{ address: string; parentId: string; name: string }>,
  ): Promise<FileEntry>;
  purgeShortcut(entry: FileEntry): Promise<void>;
  shortcutHref(id: string): string;
  pinHref(pin: Pin): string;
  openShortcut(id: string): void;
  readSaveIntent(): string | null;
  clearSaveIntent(): void;
  pins(signal?: AbortSignal): Promise<PinListing>;
  addPin(snapshot: PinListing, target: PinTarget): Promise<void>;
  removePin(snapshot: PinListing, id: string): Promise<void>;
  reorderPins(snapshot: PinListing, ids: readonly string[]): Promise<void>;
}>;
