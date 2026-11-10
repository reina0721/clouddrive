'use client';

import Hls from 'hls.js';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { FilesError, type FilesErrorCode } from '@clouddrive/surface/files';
import type { FileMediaProps } from '@clouddrive/surface/files/runtime';
import { privateHlsLoader } from './hls-loader';
import type { createPrivateHlsSource } from './hls-source';
import type { VideoToolsProps } from './media-view';

const zh = {
  quality: '清晰度',
  automatic: '自动',
  live: '直播',
  returnToLive: '回到直播',
  format: '无法播放此 HLS。请检查播放列表、分片和视频编码。',
  restricted: '无法读取播放列表引用的文件。请检查私有文件路径和读取权限。',
  unsupported: '当前浏览器无法播放 HLS 视频。',
};
const en: typeof zh = {
  quality: 'Quality',
  automatic: 'Auto',
  live: 'Live',
  returnToLive: 'Go live',
  format: 'This HLS video could not be played. Check the playlist, segments, and codec.',
  restricted: 'A referenced file could not be read. Check the private path and permissions.',
  unsupported: 'This browser cannot play HLS video.',
};
const auto = -1;
type Level = Readonly<{ width: number; height: number; bitrate: number }>;
type Playback = Readonly<{
  attempt: number;
  levels: readonly Level[];
  active: number;
  live: boolean;
  failure?: FilesErrorCode | 'browser';
}>;

const initialPlayback = (attempt: number): Playback => ({
  attempt,
  levels: [],
  active: auto,
  live: false,
});

function qualityName(level: Level | undefined) {
  if (!level) return '';
  const rate = Math.round(level.bitrate / 1000);
  return level.height > 0 ? `${level.height}p` : `${rate} kb/s`;
}

export function HlsPlayer({
  entry,
  maxBytes,
  open,
  onDownload,
  videoTools: VideoTools,
}: Pick<FileMediaProps, 'entry' | 'maxBytes'> & {
  open: ReturnType<typeof createPrivateHlsSource>;
  onDownload: () => void;
  videoTools?: ComponentType<VideoToolsProps>;
}) {
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const video = useRef<HTMLVideoElement>(null);
  const engine = useRef<Hls>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(auto);
  const [playback, setPlayback] = useState(initialPlayback(0));
  const current = playback.attempt === attempt ? playback : initialPlayback(attempt);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    const lifetime = new AbortController();
    let owned: Hls | undefined;
    let resourceError: FilesError | undefined;
    let failed = false;
    const update = (change: Partial<Playback>) => {
      if (!lifetime.signal.aborted)
        setPlayback((previous) => ({
          ...(previous.attempt === attempt ? previous : initialPlayback(attempt)),
          ...change,
        }));
    };
    const fail = (failure: NonNullable<Playback['failure']>) => {
      if (failed) return;
      failed = true;
      update({ failure });
      owned?.stopLoad();
      player.pause();
    };
    void (async () => {
      try {
        if (!Hls.isSupported()) {
          fail('browser');
          return;
        }
        const source = await open(entry, maxBytes, lifetime.signal);
        if (lifetime.signal.aborted) return;
        const hls = new Hls({
          loader: privateHlsLoader(source, (error) => {
            resourceError = error;
            if (
              error.code === 'forbidden' ||
              error.code === 'unauthenticated' ||
              error.code === 'large' ||
              error.code === 'invalid'
            ) {
              fail(error.code);
            }
          }),
          debug: false,
          emeEnabled: false,
          enableInterstitialPlayback: false,
          lowLatencyMode: false,
        });
        owned = hls;
        engine.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_event, manifest) => {
          update({
            levels: manifest.levels.map(({ width, height, bitrate }) => ({
              width,
              height,
              bitrate,
            })),
          });
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, level) => update({ active: level.level }));
        hls.on(Hls.Events.LEVEL_LOADED, (_event, level) => update({ live: level.details.live }));
        hls.on(Hls.Events.ERROR, (_event, error) => {
          if (!error.fatal) return;
          const malformed =
            error.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR ||
            error.details === Hls.ErrorDetails.LEVEL_PARSING_ERROR ||
            error.details === Hls.ErrorDetails.LEVEL_EMPTY_ERROR;
          fail(
            malformed || error.type !== Hls.ErrorTypes.NETWORK_ERROR
              ? 'invalid'
              : (resourceError?.code ?? 'unavailable'),
          );
        });
        hls.attachMedia(player);
        hls.loadSource(source.url);
      } catch (cause) {
        if (!lifetime.signal.aborted)
          fail(cause instanceof FilesError ? cause.code : 'unavailable');
      }
    })();
    return () => {
      lifetime.abort();
      owned?.destroy();
      engine.current = null;
      player.pause();
      player.removeAttribute('src');
      player.load();
    };
  }, [attempt, entry, maxBytes, open]);

  function changeQuality(value: string) {
    const level = Number(value);
    const hls = engine.current;
    if (!hls || !Number.isInteger(level) || level < auto || level >= current.levels.length) return;
    hls.currentLevel = level;
    setSelected(level);
  }

  function goLive() {
    const player = video.current;
    const position = engine.current?.liveSyncPosition;
    if (player && typeof position === 'number' && Number.isFinite(position))
      player.currentTime = position;
  }

  const failure =
    current.failure === 'browser'
      ? labels.unsupported
      : current.failure === 'invalid' || current.failure === 'unsupported'
        ? labels.format
        : current.failure === 'forbidden'
          ? labels.restricted
          : current.failure
            ? t('files.errors.' + current.failure)
            : undefined;
  const currentQuality = qualityName(current.levels[current.active]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {VideoTools ? <VideoTools entry={entry} media={video} presentation="toolbar" /> : null}
      {/* 同目录字幕沿用原生 TextTrack。 */}
      {/* eslint-disable-next-line jsx-a11y-x/media-has-caption */}
      <video
        ref={video}
        aria-label={entry.name}
        controls
        playsInline
        preload="metadata"
        className="min-h-0 w-full flex-1 rounded-control object-contain"
        style={{ backgroundColor: 'black' }}
      />
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div style={{ marginInlineEnd: 'auto' }}>
          <Action size="sm" variant="secondary" onPress={onDownload}>
            {t('files.download')}
          </Action>
        </div>
        {failure ? (
          <>
            <p role="alert" className="text-sm text-danger">
              {failure}
            </p>
            <Action
              size="sm"
              variant="secondary"
              onPress={() => {
                setSelected(auto);
                setAttempt(attempt + 1);
              }}
            >
              {t('files.retry')}
            </Action>
          </>
        ) : (
          <>
            {!current.levels.length ? (
              <p role="status" className="text-sm text-ink-muted">
                {t('files.mediaLoading')}
              </p>
            ) : null}
            {current.live ? (
              <>
                <span className="text-sm font-semibold">{labels.live}</span>
                <Action size="sm" variant="secondary" onPress={goLive}>
                  {labels.returnToLive}
                </Action>
              </>
            ) : null}
            {current.levels.length > 1 ? (
              <SelectField
                label={labels.quality}
                presentation="toolbar"
                popoverPlacement="top"
                value={String(selected)}
                onValueChange={changeQuality}
                options={[
                  {
                    value: String(auto),
                    label: currentQuality
                      ? `${labels.automatic} · ${currentQuality}`
                      : labels.automatic,
                  },
                  ...current.levels.map((level, index) => ({
                    value: String(index),
                    label: current.levels.some(
                      (other, otherIndex) =>
                        otherIndex !== index && qualityName(other) === qualityName(level),
                    )
                      ? `${qualityName(level)} · ${Math.round(level.bitrate / 1000)} kb/s`
                      : qualityName(level),
                  })),
                ]}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
