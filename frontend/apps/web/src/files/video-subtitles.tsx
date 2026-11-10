'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { FilesError, type FilesErrorCode } from '@clouddrive/surface/files';
import type { FileMediaProps } from '@clouddrive/surface/files/runtime';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { subtitleFormat } from './subtitle-contract';
import { parseSubtitle } from './subtitle-parser';
import type { VideoSubtitleSource } from './video-subtitle-source';

const off = 'off';
const msPerSecond = 1000;

function fileError(error: unknown): FilesErrorCode {
  return error instanceof FilesError ? error.code : 'unavailable';
}

function plainCueText(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function VideoSubtitles({
  source,
  entry,
  media,
  presentation = 'field',
}: {
  source: VideoSubtitleSource;
  entry: FileMediaProps['entry'];
  media: RefObject<HTMLMediaElement | null>;
  presentation?: 'field' | 'toolbar';
}) {
  const { t } = useFrontendTranslation();
  const [catalog, setCatalog] = useState<Awaited<ReturnType<VideoSubtitleSource['list']>>>();
  const [catalogFailure, setCatalogFailure] = useState<FilesErrorCode>();
  const [choice, setChoice] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{
    entry: NonNullable<typeof catalog>['entries'][number];
    error: FilesErrorCode | '';
  }>();
  const track = useRef<TextTrack>(null);
  const label = t('files.subtitles.label');
  const selectedId = choice ?? catalog?.automaticId ?? off;
  const selected = catalog?.entries.find((file) => file.id === selectedId);
  const selectedStatus = status?.entry === selected ? status : undefined;

  useEffect(() => {
    const controller = new AbortController();
    void source.list(entry, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setCatalog(value);
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setCatalogFailure(fileError(error));
      },
    );
    return () => controller.abort();
  }, [source, entry, attempt]);

  useEffect(() => {
    if (!selected) return;
    const player = media.current;
    const format = subtitleFormat(selected.name);
    if (!player || !format) return;
    const controller = new AbortController();
    let applied: TextTrack | undefined;
    void (async () => {
      try {
        const bytes = await source.read(selected, controller.signal);
        const cues = await parseSubtitle({ bytes, format }, controller.signal);
        if (controller.signal.aborted) return;
        const nativeTrack = track.current ?? player.addTextTrack('subtitles', label);
        track.current = nativeTrack;
        applied = nativeTrack;
        nativeTrack.mode = 'hidden';
        for (const cue of cues)
          nativeTrack.addCue(
            new VTTCue(cue.startMs / msPerSecond, cue.endMs / msPerSecond, plainCueText(cue.text)),
          );
        nativeTrack.mode = 'showing';
        setStatus({ entry: selected, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setStatus({ entry: selected, error: fileError(error) });
      }
    })();
    return () => {
      controller.abort();
      if (!applied) return;
      for (const cue of Array.from(applied.cues ?? [])) applied.removeCue(cue);
      applied.mode = 'disabled';
    };
  }, [selected, source, media, label]);

  const failure = catalogFailure ?? selectedStatus?.error;
  return (
    <div className="shrink-0 space-y-2">
      {catalog?.entries.length ? (
        <div className={presentation === 'field' ? 'w-full sm:w-52' : undefined}>
          <SelectField
            label={label}
            presentation={presentation}
            value={selected?.id ?? off}
            options={[
              { value: off, label: t('files.subtitles.off') },
              ...catalog.entries.map((file) => ({ value: file.id, label: file.name })),
            ]}
            onValueChange={(next) => {
              if (next === selectedId) return;
              setStatus(undefined);
              setChoice(next);
            }}
          />
        </div>
      ) : null}
      {failure ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm text-danger">
            {t(failure === 'unsupported' ? 'files.subtitles.invalid' : 'files.errors.' + failure)}
          </p>
          <Action
            size="sm"
            variant="quiet"
            onPress={() => {
              setCatalog(undefined);
              setCatalogFailure(undefined);
              setStatus(undefined);
              setAttempt((value) => value + 1);
            }}
          >
            {t('files.retry')}
          </Action>
        </div>
      ) : !catalog || (selected && !selectedStatus) ? (
        <p role="status" className="text-xs text-ink-muted">
          {t('files.subtitles.loading')}
        </p>
      ) : !catalog.entries.length ? (
        <p className="text-xs text-ink-muted">{t('files.subtitles.empty')}</p>
      ) : null}
    </div>
  );
}
