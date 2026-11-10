'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import {
  FilesError,
  type FileEntry,
  type FilesErrorCode,
  type FilesPort,
} from '@clouddrive/surface/files';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { PopoverCard } from '@clouddrive/ui-adapter/overlays';
import { RangeSlider } from '@clouddrive/ui-adapter/range-slider';
import {
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useLockStore } from '../state/use-lock-store';
import { audioMediaType } from './audio-format';
import { rasterType } from './media-signatures';
import { readMusicTags, type MusicTags } from './music-tags';

export type MusicRequest = Readonly<{
  entry: FileEntry;
  maxBytes: number;
  consumeAutoplay: () => boolean;
}>;

type MusicPlayerProps = Readonly<{
  request: MusicRequest;
  listFiles: FilesPort['list'];
  readEntry: FilesPort['detail'];
  readMedia: (id: string, expectedSizeBytes: number, signal: AbortSignal) => Promise<Blob>;
  onStop: () => void;
}>;

type RepeatMode = 'off' | 'track' | 'queue';
type TrackSelection = Readonly<{ entry: FileEntry; sequence: number; first: boolean }>;
type MediaState = Readonly<{
  sequence: number;
  failure?: FilesErrorCode;
  url?: string;
  tags?: MusicTags;
  cover?: string;
}>;
type MediaClock = Readonly<{
  sequence: number;
  elapsed: number;
  duration: number;
  paused: boolean;
}>;
const maxQueueCandidates = 100;
const secondsPerMinute = 60;
const volumePercent = 100;
const repeatModes: readonly RepeatMode[] = ['off', 'track', 'queue'];
const zh = {
  player: '音乐播放器',
  playing: '播放中',
  play: '播放',
  pause: '暂停',
  stop: '停止播放器',
  previous: '上一首',
  next: '下一首',
  progress: '播放进度',
  volume: '音量',
  mute: '静音',
  unmute: '恢复音量',
  showQueue: '显示播放队列',
  hideQueue: '隐藏播放队列',
  queue: '播放队列',
  queueLoading: '正在读取同目录曲目…',
  queueFailure: '无法读取同目录曲目。',
  queueLimited: '队列仅包含同目录前 100 个音频候选和当前曲目。',
  blocked: '浏览器未开始播放。请点击播放按钮。',
  fallbackCover: '曲目封面',
  elapsed: '已播放',
  remaining: '剩余',
  repeat: { off: '顺序播放', track: '单曲循环', queue: '列表循环' },
};
const en: typeof zh = {
  player: 'Music player',
  playing: 'Now playing',
  play: 'Play',
  pause: 'Pause',
  stop: 'Stop player',
  previous: 'Previous track',
  next: 'Next track',
  progress: 'Playback position',
  volume: 'Volume',
  mute: 'Mute',
  unmute: 'Unmute',
  showQueue: 'Show queue',
  hideQueue: 'Hide queue',
  queue: 'Playback queue',
  queueLoading: 'Loading tracks from this folder…',
  queueFailure: 'Could not load tracks from this folder.',
  queueLimited:
    'The queue includes the first 100 audio candidates in this folder and the current track.',
  blocked: 'The browser did not start playback. Select Play to continue.',
  fallbackCover: 'Track artwork',
  elapsed: 'Elapsed',
  remaining: 'Remaining',
  repeat: { off: 'Play in order', track: 'Repeat track', queue: 'Repeat queue' },
};

function clockText(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return (
    Math.floor(whole / secondsPerMinute) + ':' + String(whole % secondsPerMinute).padStart(2, '0')
  );
}

function canPlayAudio(entry: FileEntry, probe: HTMLAudioElement, maxBytes: number) {
  const type = audioMediaType(entry.mediaType);
  return Boolean(type && entry.sizeBytes <= maxBytes && probe.canPlayType(type));
}

export function MusicPlayer({
  request,
  listFiles,
  readEntry,
  readMedia,
  onStop,
}: MusicPlayerProps) {
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const audio = useRef<HTMLAudioElement>(null);
  const queueId = useId();
  const locked = useLockStore((state) => state.locked);
  const [track, setTrack] = useState<TrackSelection>({
    entry: request.entry,
    sequence: 0,
    first: true,
  });
  const [media, setMedia] = useState<MediaState>();
  const [clock, setClock] = useState<MediaClock>();
  const [queue, setQueue] = useState<Readonly<{
    items: readonly FileEntry[];
    limited: boolean;
  }> | null>();
  const [queueAttempt, setQueueAttempt] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [volume, setVolume] = useState(volumePercent);
  const [muted, setMuted] = useState(false);
  const [blockedSequence, setBlockedSequence] = useState<number>();
  const current = media?.sequence === track.sequence ? media : undefined;
  const timing = clock?.sequence === track.sequence ? clock : undefined;
  const duration = timing?.duration ?? 0;
  const elapsed = timing?.elapsed ?? 0;
  const paused = timing?.paused ?? true;
  const entries = queue?.items ?? [request.entry];
  const index = entries.findIndex((entry) => entry.id === track.entry.id);
  const wraps = repeat === 'queue';
  const previous = entries[index - 1] ?? (wraps ? entries.at(-1) : undefined);
  const next = entries[index + 1] ?? (wraps ? entries[0] : undefined);

  useLayoutEffect(() => {
    if (locked) audio.current?.pause();
  }, [locked]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const listing = await listFiles(
          {
            parent: request.entry.parentId,
            category: 'audio',
            search: '',
            trash: false,
            sort: 'name',
            desc: false,
            filters: { scope: 'folder' },
            page: 1,
            pageSize: maxQueueCandidates,
            pagination: 'numbered',
          },
          signal,
        );
        if (signal.aborted) return;
        const probe = document.createElement('audio');
        const items = listing.items.flatMap((entry) => {
          if (entry.id === request.entry.id) return [request.entry];
          return entry.parentId === request.entry.parentId &&
            entry.kind === 'file' &&
            entry.trashedAt === null &&
            canPlayAudio(entry, probe, request.maxBytes)
            ? [entry]
            : [];
        });
        if (!items.some((entry) => entry.id === request.entry.id)) items.unshift(request.entry);
        setQueue({ items, limited: listing.total > listing.items.length });
      } catch {
        if (!signal.aborted) setQueue(null);
      }
    })();
    return () => controller.abort();
  }, [listFiles, request, queueAttempt]);

  useEffect(() => {
    const node = audio.current;
    if (!node) return;
    const controller = new AbortController();
    const { signal } = controller;
    const { entry, sequence, first } = track;
    let sourceURL = '';
    let coverURL = '';
    async function verifyTrack() {
      const { entry: currentEntry } = await readEntry(entry.id, signal);
      if (
        currentEntry.kind !== 'file' ||
        currentEntry.trashedAt !== null ||
        currentEntry.parentId !== entry.parentId ||
        currentEntry.contentRevision !== entry.contentRevision ||
        currentEntry.sizeBytes !== entry.sizeBytes ||
        currentEntry.mediaType !== entry.mediaType
      ) {
        throw new FilesError('conflict');
      }
    }
    void (async () => {
      try {
        if (entry.sizeBytes > request.maxBytes) throw new FilesError('large');
        const type = audioMediaType(entry.mediaType);
        if (!type || !node.canPlayType(type)) throw new FilesError('unsupported');
        await verifyTrack();
        const response = await readMedia(entry.id, entry.sizeBytes, signal);
        if (response.size > request.maxBytes) throw new FilesError('large');
        await verifyTrack();
        if (signal.aborted) return;
        const source = new Blob([response], { type });
        sourceURL = URL.createObjectURL(source);
        node.src = sourceURL;
        setMedia({ sequence, url: sourceURL });
        const autoplay = first ? request.consumeAutoplay() : true;
        if (autoplay && !useLockStore.getState().locked) {
          void node.play().catch((error: unknown) => {
            if (
              !signal.aborted &&
              !(error instanceof DOMException && error.name === 'AbortError')
            ) {
              setBlockedSequence(sequence);
            }
          });
        }
        const tags = await readMusicTags(source, signal);
        if (!tags || signal.aborted) return;
        const coverType = tags.cover ? await rasterType(tags.cover) : undefined;
        if (signal.aborted) return;
        if (coverType && tags.cover) {
          coverURL = URL.createObjectURL(new Blob([tags.cover], { type: coverType }));
        }
        setMedia((state) =>
          state?.sequence === sequence && !state.failure
            ? { ...state, tags, ...(coverURL ? { cover: coverURL } : {}) }
            : state,
        );
      } catch (error) {
        if (!signal.aborted) {
          setMedia((state) =>
            sourceURL
              ? state
              : {
                  sequence,
                  failure: error instanceof FilesError ? error.code : 'unavailable',
                },
          );
        }
      }
    })();
    return () => {
      controller.abort();
      node.pause();
      node.removeAttribute('src');
      node.load();
      if (sourceURL) URL.revokeObjectURL(sourceURL);
      if (coverURL) URL.revokeObjectURL(coverURL);
    };
  }, [readEntry, readMedia, request, track]);

  function syncClock(node: HTMLAudioElement) {
    setClock({
      sequence: track.sequence,
      elapsed: Number.isFinite(node.currentTime) ? node.currentTime : 0,
      duration: Number.isFinite(node.duration) ? node.duration : 0,
      paused: node.paused || node.ended,
    });
  }

  function play() {
    const node = audio.current;
    if (!node || !current?.url || current.failure || useLockStore.getState().locked) return;
    const url = current.url;
    void node.play().catch((error: unknown) => {
      if (node.src === url && !(error instanceof DOMException && error.name === 'AbortError')) {
        setBlockedSequence(track.sequence);
      }
    });
  }

  function choose(entry: FileEntry) {
    if (entry.id === track.entry.id && current?.url && !current.failure && audio.current) {
      audio.current.currentTime = 0;
      play();
      return;
    }
    setTrack((current) => ({ entry, sequence: current.sequence + 1, first: false }));
  }

  function retryTrack() {
    setTrack((current) => ({ ...current, sequence: current.sequence + 1, first: false }));
  }

  const failure = current?.failure;
  const failedMessage = !failure
    ? ''
    : failure === 'large'
      ? t('files.mediaTooLarge')
      : failure === 'unsupported'
        ? t('files.mediaUnsupported')
        : t('files.errors.' + failure);
  return (
    <>
      {/* 该节点只服务受控播放器，原生历史和访客入口继续使用自己的媒体元素。 */}
      {/* eslint-disable-next-line jsx-a11y-x/media-has-caption */}
      <audio
        ref={audio}
        hidden
        preload="metadata"
        loop={repeat === 'track'}
        onLoadedMetadata={(event) => syncClock(event.currentTarget)}
        onDurationChange={(event) => syncClock(event.currentTarget)}
        onTimeUpdate={(event) => syncClock(event.currentTarget)}
        onPlay={(event) => {
          setBlockedSequence(undefined);
          syncClock(event.currentTarget);
        }}
        onPause={(event) => syncClock(event.currentTarget)}
        onEnded={(event) => {
          syncClock(event.currentTarget);
          if (next && current?.url === event.currentTarget.src) choose(next);
        }}
        onError={(event) => {
          const url = event.currentTarget.src;
          if (!url) return;
          setMedia((state) => (state?.url === url ? { ...state, failure: 'unsupported' } : state));
        }}
      />
      <PopoverCard triggerLabel={labels.player} title={labels.player} defaultOpen>
        <div className="space-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-control bg-surface-muted text-ink-muted">
              {current?.cover ? (
                <img
                  src={current.cover}
                  alt={labels.fallbackCover}
                  className="h-full w-full object-cover"
                  onError={() =>
                    setMedia((state) =>
                      state?.sequence === track.sequence ? { ...state, cover: '' } : state,
                    )
                  }
                />
              ) : (
                <Music2 aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              {current?.tags?.artist ? (
                <p className="break-words text-xs text-ink-muted">{current.tags.artist}</p>
              ) : null}
              <p className="break-words font-bold text-ink">
                {current?.tags?.title ?? track.entry.name}
              </p>
              {current?.tags?.album ? (
                <p className="break-words text-xs text-ink-muted">{current.tags.album}</p>
              ) : null}
            </div>
          </div>
          <div>
            <RangeSlider
              label={labels.progress}
              max={duration || 1}
              step={0.1}
              value={Math.min(elapsed, duration)}
              disabled={!duration || Boolean(failure)}
              onValueChange={(seconds) => {
                const node = audio.current;
                if (node) {
                  node.currentTime = seconds;
                  syncClock(node);
                }
              }}
            />
            <div className="flex justify-between gap-2 text-xs text-ink-muted">
              <span>
                <span className="sr-only">{labels.elapsed} </span>
                {clockText(elapsed)}
              </span>
              <span>
                <span className="sr-only">{labels.remaining} </span>−{clockText(duration - elapsed)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <IconAction
              size="sm"
              label={labels.repeat[repeat]}
              active={repeat !== 'off'}
              tooltip
              onPress={() =>
                setRepeat(
                  repeatModes[(repeatModes.indexOf(repeat) + 1) % repeatModes.length] ?? 'off',
                )
              }
            >
              {repeat === 'track' ? <Repeat1 aria-hidden="true" /> : <Repeat aria-hidden="true" />}
            </IconAction>
            <IconAction
              size="sm"
              label={labels.previous}
              tooltip
              disabled={!previous}
              onPress={() => {
                if (previous) choose(previous);
              }}
            >
              <SkipBack aria-hidden="true" />
            </IconAction>
            <Action
              size="sm"
              leadingIcon={paused ? <Play /> : <Pause />}
              disabled={!current?.url || Boolean(failure)}
              onPress={() => {
                if (paused) play();
                else audio.current?.pause();
              }}
            >
              <span className="sr-only">{paused ? labels.play : labels.pause}</span>
            </Action>
            <IconAction
              size="sm"
              label={labels.next}
              tooltip
              disabled={!next}
              onPress={() => {
                if (next) choose(next);
              }}
            >
              <SkipForward aria-hidden="true" />
            </IconAction>
            <IconAction
              size="sm"
              label={queueOpen ? labels.hideQueue : labels.showQueue}
              expanded={queueOpen}
              active={queueOpen}
              tooltip
              {...(queueOpen ? { controls: queueId } : {})}
              onPress={() => setQueueOpen((open) => !open)}
            >
              <ListMusic aria-hidden="true" />
            </IconAction>
          </div>
          <div className="flex items-center gap-2">
            <Action
              size="sm"
              variant="quiet"
              leadingIcon={muted ? <VolumeX /> : <Volume2 />}
              onPress={() => {
                const node = audio.current;
                if (!node) return;
                node.muted = !node.muted;
                setMuted(node.muted);
              }}
            >
              <span className="sr-only">{muted ? labels.unmute : labels.mute}</span>
            </Action>
            <RangeSlider
              label={labels.volume}
              max={volumePercent}
              value={volume}
              onValueChange={(percent) => {
                const node = audio.current;
                if (!node) return;
                node.volume = percent / volumePercent;
                setVolume(Math.round(node.volume * volumePercent));
              }}
            />
            <Action size="sm" variant="quiet" leadingIcon={<Square />} onPress={onStop}>
              <span className="sr-only">{labels.stop}</span>
            </Action>
          </div>
          {!current ? (
            <p role="status" className="text-xs">
              {t('files.mediaLoading')}
            </p>
          ) : null}
          {failure ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert" className="text-xs text-danger">
                {failedMessage}
              </p>
              <Action size="sm" variant="secondary" onPress={retryTrack}>
                {t('files.retry')}
              </Action>
            </div>
          ) : blockedSequence === track.sequence ? (
            <p role="status" className="text-xs">
              {labels.blocked}
            </p>
          ) : null}
          {queueOpen ? (
            <div id={queueId} className="space-y-2 border-t border-border pt-3">
              <p className="font-semibold text-ink">{labels.queue}</p>
              {queue === undefined ? (
                <p role="status" className="text-xs">
                  {labels.queueLoading}
                </p>
              ) : null}
              {queue === null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p role="alert" className="text-xs text-danger">
                    {labels.queueFailure}
                  </p>
                  <Action
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setQueue(undefined);
                      setQueueAttempt((attempt) => attempt + 1);
                    }}
                  >
                    {t('files.retry')}
                  </Action>
                </div>
              ) : null}
              {queue?.limited ? <p className="text-xs">{labels.queueLimited}</p> : null}
              <ul aria-label={labels.queue} className="max-h-48 overflow-auto">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    aria-current={entry.id === track.entry.id ? 'true' : undefined}
                  >
                    <Action size="sm" variant="quiet" onPress={() => choose(entry)}>
                      <span
                        className={
                          entry.id === track.entry.id ? 'break-all text-brand' : 'break-all'
                        }
                      >
                        {entry.name}
                      </span>
                      {entry.id === track.entry.id ? (
                        <span className="sr-only"> · {labels.playing}</span>
                      ) : null}
                    </Action>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </PopoverCard>
    </>
  );
}
