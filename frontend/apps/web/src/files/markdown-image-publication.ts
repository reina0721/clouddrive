import { FilesError, type FilesErrorCode, type TransfersPort } from '@clouddrive/surface/files';

function publicationFailure(failure: string | undefined): FilesErrorCode {
  switch (failure) {
    case 'destination':
    case 'conflict':
      return 'conflict';
    case 'large':
    case 'quota':
    case 'filename-restricted':
    case 'forbidden':
    case 'missing':
    case 'busy':
    case 'expired':
    case 'checksum':
      return failure;
    default:
      return 'unavailable';
  }
}

/** waitForMarkdownImagePublication 只观察一次本地候选，传输仍由原有队列拥有。 */
export function waitForMarkdownImagePublication(
  transfers: Pick<TransfersPort, 'subscribe' | 'getSnapshot'>,
  candidateId: string,
  signal: AbortSignal,
) {
  return new Promise<string>((resolve, reject) => {
    const stop = transfers.subscribe(check);
    signal.addEventListener('abort', check, { once: true });
    check();

    function cleanup() {
      stop();
      signal.removeEventListener('abort', check);
    }

    function check() {
      if (signal.aborted) {
        cleanup();
        reject(new FilesError('canceled', { cause: signal.reason }));
        return;
      }
      const item = transfers.getSnapshot().items.find((entry) => entry.id === candidateId);
      if (item?.phase === 'completed' && item.entryId) {
        cleanup();
        resolve(item.entryId);
      } else if (
        !item ||
        ['attention', 'canceled', 'expired', 'failed', 'needs-source', 'paused'].includes(
          item.phase,
        )
      ) {
        cleanup();
        reject(new FilesError(publicationFailure(item?.failure)));
      }
    }
  });
}
