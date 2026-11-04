'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { FilesError } from '@clouddrive/surface/files';
import type { FileMediaProps } from '@clouddrive/surface/files/runtime';

// rasterType 只允许已核验签名的栅格图像，禁止将改名后的 SVG/HTML 作为图片装载。
async function rasterType(blob: Blob): Promise<string | undefined> {
  const header = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const starts = (signature: readonly number[]) =>
    signature.every((value, index) => header[index] === value);
  const text = (start: number, end: number) => String.fromCharCode(...header.slice(start, end));
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (starts([255, 216, 255])) return 'image/jpeg';
  if (text(0, 6) === 'GIF87a' || text(0, 6) === 'GIF89a') return 'image/gif';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
  if (text(4, 8) === 'ftyp' && ['avif', 'avis'].some((brand) => text(8, 32).includes(brand)))
    return 'image/avif';
  return undefined;
}
const waveMediaType = 'audio/wav';
const audioTypes = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  waveMediaType,
  'audio/x-wav',
  'audio/flac',
  'audio/aac',
]);
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/ogg']);

/** FileMediaView 拥有媒体 URL、请求和播放器关闭，不向 Surface 传递浏览器句柄。 */
export function FileMediaView({
  entry,
  mode,
  maxBytes,
  readContent,
  version,
  labels,
}: FileMediaProps &
  Readonly<{
    readContent: (
      id: string,
      expectedSizeBytes: number,
      signal: AbortSignal,
      version?: number,
    ) => Promise<Blob>;
  }>) {
  const { t } = useFrontendTranslation();
  const [url, setURL] = useState('');
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  const media = useRef<HTMLMediaElement | null>(null);
  // ref 可能先解绑，StrictMode 也会模拟解绑；保留最后的自有节点，交给 effect 真正释放。
  const attachMedia = useCallback((node: HTMLMediaElement | null) => {
    if (node) media.current = node;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let ownedURL = '';
    void (async () => {
      try {
        if (entry.sizeBytes > maxBytes) throw new FilesError('large');
        const rawType = entry.mediaType.split(';')[0]?.toLowerCase() ?? '';
        // Go 的字节识别返回 audio/wave；浏览器播放探针使用通行的 WAV 别名。
        const type = rawType === 'audio/wave' ? waveMediaType : rawType;
        const image = type.startsWith('image/');
        if (!image && (mode === 'thumbnail' || (!audioTypes.has(type) && !videoTypes.has(type))))
          throw new FilesError('unsupported');
        if (!image) {
          const probe = document.createElement(videoTypes.has(type) ? 'video' : 'audio');
          if (!probe.canPlayType(type)) throw new FilesError('unsupported');
        }
        const blob = await readContent(entry.id, entry.sizeBytes, controller.signal, version);
        if (blob.size > maxBytes) throw new FilesError('large');
        const safeType = image ? await rasterType(blob) : type;
        if (!safeType) throw new FilesError('unsupported');
        if (controller.signal.aborted) return;
        ownedURL = URL.createObjectURL(new Blob([blob], { type: safeType }));
        setURL(ownedURL);
      } catch (error) {
        if (!controller.signal.aborted)
          setFailure(
            error instanceof FilesError && error.code === 'large'
              ? (labels?.tooLarge ?? t('files.mediaTooLarge'))
              : (labels?.unsupported ?? t('files.mediaUnsupported')),
          );
      }
    })();
    return () => {
      controller.abort();
      const player = media.current;
      if (player) {
        player.pause();
        player.removeAttribute('src');
        player.load();
      }
      media.current = null;
      if (ownedURL) URL.revokeObjectURL(ownedURL);
    };
  }, [
    entry.id,
    entry.contentRevision,
    version,
    entry.sizeBytes,
    entry.mediaType,
    maxBytes,
    mode,
    readContent,
    labels?.tooLarge,
    labels?.unsupported,
    attempt,
    t,
  ]);
  if (failure)
    return (
      <div className="space-y-2 text-xs text-ink-muted">
        <p role="status">{failure}</p>
        {mode === 'preview' ? (
          <Action
            size="sm"
            variant="quiet"
            onPress={() => {
              setFailure('');
              setURL('');
              setAttempt((value) => value + 1);
            }}
          >
            {labels?.retry ?? t('files.retry')}
          </Action>
        ) : null}
      </div>
    );
  if (!url)
    return (
      <p role="status" className="text-xs text-ink-muted">
        {labels?.loading ?? t('files.mediaLoading')}
      </p>
    );
  if (entry.mediaType.startsWith('image/'))
    return (
      <img
        src={url}
        alt={entry.name}
        className={
          mode === 'thumbnail'
            ? 'h-40 w-full rounded-control object-contain'
            : 'max-h-screen w-full object-contain'
        }
        onError={() => setFailure(labels?.unsupported ?? t('files.mediaUnsupported'))}
      />
    );
  if (entry.mediaType.startsWith('video/'))
    return (
      // eslint-disable-next-line jsx-a11y-x/media-has-caption -- 原始上传媒体没有配套字幕；不伪造字幕，保留浏览器原生控制。
      <video
        ref={attachMedia}
        controls
        preload="metadata"
        src={url}
        aria-label={entry.name}
        className="max-h-screen w-full"
        onError={() => setFailure(t('files.mediaUnsupported'))}
      />
    );
  return (
    // eslint-disable-next-line jsx-a11y-x/media-has-caption -- 原始上传媒体没有配套字幕；不伪造字幕，保留浏览器原生控制。
    <audio
      ref={attachMedia}
      controls
      preload="metadata"
      src={url}
      aria-label={entry.name}
      className="w-full"
      onError={() => setFailure(t('files.mediaUnsupported'))}
    />
  );
}
