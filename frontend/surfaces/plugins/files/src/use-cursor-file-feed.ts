import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilesError,
  type FileListing,
  type FileQuery,
  type FilesPort,
} from '../../../src/files/model';

type FeedPhase = 'ready' | 'loading' | 'retry' | 'expired';
type Feed = {
  first: FileListing;
  listing: FileListing;
  consumed: ReadonlySet<string>;
  phase: FeedPhase;
};

export function useCursorFileFeed(
  first: FileListing | undefined,
  query: FileQuery,
  list: FilesPort['list'],
) {
  const [stored, setStored] = useState<Feed>();
  const request = useRef<AbortController | undefined>(undefined);
  if (stored && stored.first !== first) setStored(undefined);
  const current = stored?.first === first ? stored : undefined;
  const listing = current?.listing ?? first;
  const phase = current?.phase ?? 'ready';

  useEffect(
    () => () => {
      request.current?.abort();
      request.current = undefined;
    },
    [first, query, list],
  );

  const load = useCallback(() => {
    const cursor = listing?.cursorPage?.next;
    if (!first || !listing || !cursor || request.current || phase === 'expired') return;
    const controller = new AbortController();
    request.current = controller;
    const consumed = current?.consumed ?? new Set<string>();
    const previous = { first, listing, consumed };
    setStored({ ...previous, phase: 'loading' });
    void list({ ...query, page: 1, cursor }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.cursorPage) {
          setStored({ ...previous, phase: 'retry' });
          return;
        }
        const next = result.cursorPage.next;
        if (next && (next === cursor || consumed.has(next))) {
          setStored({ ...previous, phase: 'expired' });
          return;
        }
        const displayed = new Set(listing.items.map((entry) => entry.id));
        const addedIds = new Set<string>();
        const additions = result.items.filter((entry) => {
          if (displayed.has(entry.id) || addedIds.has(entry.id)) return false;
          addedIds.add(entry.id);
          return true;
        });
        const backward = first.cursorPage?.previous;
        setStored({
          first,
          listing: {
            ...result,
            items: [...listing.items, ...additions],
            annotationSummaries: [
              ...listing.annotationSummaries,
              ...result.annotationSummaries.filter((summary) => addedIds.has(summary.entryId)),
            ],
            cursorPage: { ...(backward ? { previous: backward } : {}), ...(next ? { next } : {}) },
          },
          consumed: new Set([...consumed, cursor]),
          phase: 'ready',
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const expired =
          error instanceof FilesError && (error.code === 'conflict' || error.code === 'invalid');
        setStored({ ...previous, phase: expired ? 'expired' : 'retry' });
      })
      .finally(() => {
        if (request.current === controller) request.current = undefined;
      });
  }, [first, query, list, listing, current, phase]);

  return { listing, phase, load };
}
