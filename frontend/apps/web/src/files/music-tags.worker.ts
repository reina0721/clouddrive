import { parseBlob, selectCover } from 'music-metadata';
import type { MusicTags } from './music-tags';

const maxTagCharacters = 256;
const coverLimitBytes = 1024 * 1024;

function cleanTag(value?: string) {
  return value?.trim().slice(0, maxTagCharacters) || undefined;
}

self.addEventListener('message', (event: MessageEvent<Blob>) => {
  void (async () => {
    let tags: MusicTags | undefined;
    try {
      const { common } = await parseBlob(event.data, { duration: false });
      const title = cleanTag(common.title);
      const artist = cleanTag(common.artist);
      const album = cleanTag(common.album);
      const picture = selectCover(common.picture);
      const cover =
        picture && picture.data.byteLength <= coverLimitBytes
          ? new Blob([Uint8Array.from(picture.data)], { type: picture.format })
          : undefined;
      tags = {
        ...(title ? { title } : {}),
        ...(artist ? { artist } : {}),
        ...(album ? { album } : {}),
        ...(cover ? { cover } : {}),
      };
    } catch {
      // 标签不完整或损坏时，播放器使用原始文件名。
      tags = undefined;
    }
    self.postMessage(tags);
  })();
});
