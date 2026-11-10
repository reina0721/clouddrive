import { useCallback, useEffect, useRef, useState } from 'react';
import {
  defaultEpubReadingState,
  type EpubEntry,
  type EpubReadingPort,
  type EpubReadingPosition,
  type EpubReadingState,
} from '../../../src/files/epub-contract';

const saveIntervalMs = 300;
const ratioResolution = 10_000;

export function useEpubReadingState(entry: EpubEntry, port: EpubReadingPort | undefined) {
  const [settings, setSettings] = useState(defaultEpubReadingState);
  const [storageFailed, setStorageFailed] = useState(false);
  const current = useRef(defaultEpubReadingState);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef(false);

  const flush = useCallback(
    (reportFailure = true) => {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      if (!pending.current) return;
      try {
        port?.save(entry, current.current);
        pending.current = false;
        if (reportFailure) setStorageFailed(false);
      } catch {
        if (reportFailure) setStorageFailed(true);
      }
    },
    [entry, port],
  );

  useEffect(() => {
    const pagehide = () => flush(false);
    window.addEventListener('pagehide', pagehide);
    return () => {
      window.removeEventListener('pagehide', pagehide);
      flush(false);
    };
  }, [flush]);

  function restore(chapterCount: number) {
    let restored = defaultEpubReadingState;
    try {
      restored = port?.load(entry) ?? restored;
    } catch {
      setStorageFailed(true);
    }
    current.current = {
      ...restored,
      position:
        restored.position.chapter < chapterCount
          ? restored.position
          : defaultEpubReadingState.position,
      bookmarks: restored.bookmarks.filter((position) => position.chapter < chapterCount),
    };
    setSettings(current.current);
    return current.current.position;
  }

  function update(position: EpubReadingPosition) {
    const ratio = Math.round(position.ratio * ratioResolution) / ratioResolution;
    const previous = current.current.position;
    if (previous.chapter === position.chapter && previous.ratio === ratio) return;
    current.current = { ...current.current, position: { chapter: position.chapter, ratio } };
    pending.current = true;
    timer.current ??= window.setTimeout(flush, saveIntervalMs);
  }

  function configure(change: Partial<Omit<EpubReadingState, 'position'>>) {
    current.current = { ...current.current, ...change };
    setSettings(current.current);
    pending.current = true;
    flush();
  }

  return { settings, storageFailed, current, restore, update, configure, flush };
}
