import {
  epubBookmarkLimit,
  epubFontScales,
  FilesError,
  type EpubReadingPort,
} from '@clouddrive/surface/files';
import { z } from 'zod';

const historyLimit = 64;
const positionSchema = z.object({
  chapter: z.number().int().nonnegative(),
  ratio: z.number().min(0).max(1),
});
const recordSchema = z.object({
  revision: z.number().int().positive(),
  updatedAtMs: z.number().int().nonnegative(),
  reading: z.object({
    position: positionSchema,
    fontIndex: z
      .number()
      .int()
      .min(0)
      .max(epubFontScales.length - 1),
    layout: z.enum(['scroll', 'pages']),
    bookmarks: z.array(positionSchema).max(epubBookmarkLimit),
  }),
});

function readRecord(storage: Storage, key: string) {
  const value = storage.getItem(key);
  if (value === null) return undefined;
  try {
    const parsed = recordSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return undefined;
  }
}

/** createEpubReadingPreferences 管理当前账号在当前浏览器内的阅读位置。 */
export function createEpubReadingPreferences(
  account: string | null,
  assertCurrent: () => void,
): EpubReadingPort {
  const prefix = 'clouddrive.files.epub.v1.' + encodeURIComponent(account ?? '') + ':';
  return {
    load(entry) {
      assertCurrent();
      try {
        const saved = readRecord(localStorage, prefix + entry.id);
        return saved?.revision === entry.contentRevision ? saved.reading : undefined;
      } catch (error) {
        throw new FilesError('unavailable', { cause: error });
      }
    },
    save(entry, reading) {
      assertCurrent();
      try {
        const storage = localStorage;
        const key = prefix + entry.id;
        const previous = readRecord(storage, key);
        if (previous && previous.revision > entry.contentRevision) return;
        const record = recordSchema.parse({
          revision: entry.contentRevision,
          updatedAtMs: Date.now(),
          reading,
        });
        storage.setItem(key, JSON.stringify(record));
        if (previous) return;
        const others: { key: string; updatedAtMs: number }[] = [];
        for (let index = 0; index < storage.length; index += 1) {
          const candidate = storage.key(index);
          if (candidate?.startsWith(prefix) && candidate !== key) {
            others.push({
              key: candidate,
              updatedAtMs: readRecord(storage, candidate)?.updatedAtMs ?? 0,
            });
          }
        }
        others.sort((left, right) => right.updatedAtMs - left.updatedAtMs);
        for (const old of others.slice(historyLimit - 1)) storage.removeItem(old.key);
      } catch (error) {
        throw new FilesError('unavailable', { cause: error });
      }
    },
  };
}
