import {
  FilesError,
  fileDetailSchema,
  type FileEntry,
  type FilesPort,
} from '@clouddrive/surface/files';
import type { FileMediaProps } from '@clouddrive/surface/files/runtime';
import type { createJsonClient } from '../api/json-client';
import { subtitleFormat, subtitleFormats, subtitleLimits } from './subtitle-contract';

type SubtitleLookup = Readonly<{ entries: readonly FileEntry[]; automaticId: string }>;
export type VideoSubtitleSource = Readonly<{
  list(entry: FileMediaProps['entry'], signal: AbortSignal): Promise<SubtitleLookup>;
  read(entry: FileEntry, signal: AbortSignal): Promise<ArrayBuffer>;
}>;

function stem(name: string) {
  return (name.lastIndexOf('.') > 0 ? name.slice(0, name.lastIndexOf('.')) : name)
    .normalize('NFC')
    .toLowerCase();
}

/** createVideoSubtitleSource 在本人文件客户端内发现和读取字幕，不向播放器暴露内容地址。 */
export function createVideoSubtitleSource(
  files: Pick<FilesPort, 'list'>,
  call: ReturnType<typeof createJsonClient>,
  assertCurrent: () => void,
): VideoSubtitleSource {
  const detail = async (id: string, signal: AbortSignal) =>
    fileDetailSchema.parse(await call('/' + encodeURIComponent(id), { signal })).entry;
  return {
    async list(video, signal) {
      const entry = await detail(video.id, signal);
      if (entry.contentRevision !== video.contentRevision || entry.kind !== 'file')
        throw new FilesError('conflict');
      const parent = entry.parentId;
      const listing = await files.list(
        {
          parent,
          category: '',
          search: '',
          trash: false,
          sort: 'name',
          desc: false,
          filters: { scope: 'folder', extensions: [...subtitleFormats], kinds: ['file'] },
          page: 1,
          pageSize: subtitleLimits.maxCandidates,
        },
        signal,
      );
      assertCurrent();
      signal.throwIfAborted();
      if (listing.total > listing.items.length) throw new FilesError('large');
      const entries = listing.items.filter(
        (file) =>
          file.kind === 'file' &&
          file.parentId === parent &&
          !file.trashedAt &&
          subtitleFormat(file.name),
      );
      const videoStem = stem(entry.name);
      const automaticId =
        subtitleFormats
          .map((format) =>
            entries.find(
              (file) => subtitleFormat(file.name) === format && stem(file.name) === videoStem,
            ),
          )
          .find((file) => file)?.id ?? '';
      return { entries, automaticId };
    },
    async read(entry, signal) {
      if (entry.sizeBytes > subtitleLimits.maxBytes) throw new FilesError('large');
      const verify = async () => {
        const current = await detail(entry.id, signal);
        if (
          current.kind !== 'file' ||
          current.parentId !== entry.parentId ||
          current.name !== entry.name ||
          current.sizeBytes !== entry.sizeBytes ||
          current.contentRevision !== entry.contentRevision ||
          current.trashedAt
        )
          throw new FilesError('conflict');
      };
      await verify();
      const response = await call('/' + encodeURIComponent(entry.id) + '/content', {
        signal,
        responseType: 'blob',
        maxBlobBytes: subtitleLimits.maxBytes,
      });
      if (!(response instanceof Blob)) throw new FilesError('unavailable');
      if (response.size !== entry.sizeBytes) throw new FilesError('conflict');
      const bytes = await response.arrayBuffer();
      await verify();
      assertCurrent();
      signal.throwIfAborted();
      return bytes;
    },
  };
}
