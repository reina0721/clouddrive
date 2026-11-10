'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { FilesError, type FilesErrorCode } from '@clouddrive/surface/files';
import type { FileMediaProps } from '@clouddrive/surface/files/runtime';

import { rasterType } from './media-signatures';
import { editableImageType, type ImageSize } from './image-edit';
import { audioMediaType } from './audio-format';
const videoTypes = new Set(['video/mp4', 'video/webm', 'video/ogg']);

export type VideoToolsProps = Readonly<{
  entry: FileMediaProps['entry'];
  media: RefObject<HTMLMediaElement | null>;
  presentation?: 'toolbar';
}>;

export type ImageToolsProps = Readonly<{
  entry: FileMediaProps['entry'];
  parentId: string;
  source: Blob;
  size: ImageSize;
  maxBytes: number;
}>;

/** FileMediaView 拥有媒体 URL、请求和播放器关闭，不向 Surface 传递浏览器句柄。 */
export function FileMediaView({
  entry,
  mode,
  alt,
  maxBytes,
  readContent,
  version,
  labels,
  imageCopyParentId,
  videoTools: VideoTools,
  imageTools: ImageTools,
}: FileMediaProps &
  Readonly<{
    readContent: (
      id: string,
      expectedSizeBytes: number,
      signal: AbortSignal,
      version?: number,
    ) => Promise<Blob>;
    videoTools?: ComponentType<VideoToolsProps>;
    imageTools?: ComponentType<ImageToolsProps>;
  }>) {
  const { t } = useFrontendTranslation();
  const [result, setResult] = useState<
    Readonly<{
      key: string;
      reader: typeof readContent;
      url: string;
      failure: FilesErrorCode | '';
      editable?: Blob;
    }>
  >();
  const [naturalSize, setNaturalSize] = useState<{ url: string; size: ImageSize }>();
  const [attempt, setAttempt] = useState(0);
  const requestKey = JSON.stringify([
    entry.id,
    entry.contentRevision,
    entry.sizeBytes,
    entry.mediaType,
    mode,
    maxBytes,
    version,
    attempt,
  ]);
  const current = result?.key === requestKey && result.reader === readContent ? result : undefined;
  const url = current?.url ?? '';
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
        const audioType = audioMediaType(rawType);
        const type = audioType ?? rawType;
        const image = type.startsWith('image/');
        if (!image && (mode !== 'preview' || (!audioType && !videoTypes.has(type))))
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
        const safeBlob = new Blob([blob], { type: safeType });
        ownedURL = URL.createObjectURL(safeBlob);
        setResult({
          key: requestKey,
          reader: readContent,
          url: ownedURL,
          failure: '',
          ...(ImageTools && editableImageType(safeType) ? { editable: safeBlob } : {}),
        });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            key: requestKey,
            reader: readContent,
            url: '',
            failure: error instanceof FilesError ? error.code : 'unavailable',
          });
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
    requestKey,
    ImageTools,
  ]);
  if (current?.failure) {
    const failure =
      current.failure === 'large'
        ? (labels?.tooLarge ?? t('files.mediaTooLarge'))
        : current.failure === 'unsupported'
          ? (labels?.unsupported ?? t('files.mediaUnsupported'))
          : t('files.errors.' + current.failure);
    if (mode === 'inline') return <span title={failure}>{alt || entry.name}</span>;
    return (
      <div className="space-y-2 text-xs text-ink-muted">
        <p role="status">{failure}</p>
        <Action
          size="sm"
          variant="quiet"
          onPress={() => {
            setAttempt((value) => value + 1);
          }}
        >
          {labels?.retry ?? t('files.retry')}
        </Action>
      </div>
    );
  }
  if (!url) {
    if (mode === 'inline') return <span role="status">{alt || entry.name}</span>;
    return (
      <p role="status" className="text-xs text-ink-muted">
        {labels?.loading ?? t('files.mediaLoading')}
      </p>
    );
  }
  if (entry.mediaType.startsWith('image/'))
    return (
      <>
        {ImageTools &&
        imageCopyParentId !== undefined &&
        current?.editable &&
        naturalSize?.url === url ? (
          <ImageTools
            entry={entry}
            parentId={imageCopyParentId}
            source={current.editable}
            size={naturalSize.size}
            maxBytes={maxBytes}
          />
        ) : null}
        <img
          src={url}
          alt={alt ?? entry.name}
          style={
            mode === 'inline'
              ? { maxWidth: '100%', maxHeight: 'min(28rem, 60vh)', objectFit: 'contain' }
              : undefined
          }
          className={
            mode === 'thumbnail'
              ? 'h-40 w-full rounded-control object-contain'
              : mode === 'preview'
                ? 'max-h-screen w-full object-contain'
                : undefined
          }
          onLoad={
            current?.editable
              ? ({ currentTarget }) =>
                  setNaturalSize({
                    url,
                    size: {
                      width: currentTarget.naturalWidth,
                      height: currentTarget.naturalHeight,
                    },
                  })
              : undefined
          }
          onError={() =>
            setResult({ key: requestKey, reader: readContent, url: '', failure: 'unsupported' })
          }
        />
      </>
    );
  if (entry.mediaType.startsWith('video/'))
    return (
      <>
        {VideoTools ? <VideoTools entry={entry} media={media} /> : null}
        {/* 本人视频按需通过 TextTrack 接入字幕，其他原始媒体沿用原生控制。 */}
        {/* eslint-disable-next-line jsx-a11y-x/media-has-caption */}
        <video
          ref={attachMedia}
          controls
          preload="metadata"
          src={url}
          aria-label={entry.name}
          className="max-h-screen w-full object-contain"
          style={VideoTools ? { minHeight: 0, backgroundColor: 'black' } : undefined}
          onError={() =>
            setResult({ key: requestKey, reader: readContent, url: '', failure: 'unsupported' })
          }
        />
      </>
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
      onError={() =>
        setResult({ key: requestKey, reader: readContent, url: '', failure: 'unsupported' })
      }
    />
  );
}
