import {
  historyPreferencesSchema,
  FilesError,
  type HistoryPreferences,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';

/** createHistoryPreferences 仅通过服务器保存账号策略，不维护本机回退副本。 */
export function createHistoryPreferences(
  call: ReturnType<typeof createJsonClient>,
  assertCurrent: () => void,
) {
  return {
    async loadHistoryPreferences(signal?: AbortSignal): Promise<HistoryPreferences> {
      assertCurrent();
      const value = historyPreferencesSchema.parse(
        await call('/preferences/history', signal ? { signal } : {}),
      );
      assertCurrent();
      if (signal?.aborted) throw new FilesError('canceled');
      return value;
    },
    async saveHistoryPreferences(
      input: HistoryPreferences,
      signal?: AbortSignal,
    ): Promise<HistoryPreferences> {
      assertCurrent();
      const value = historyPreferencesSchema.parse(
        await call('/preferences/history', {
          method: 'PUT',
          body: historyPreferencesSchema.parse(input),
          ...(signal ? { signal } : {}),
        }),
      );
      assertCurrent();
      if (signal?.aborted) throw new FilesError('canceled');
      return value;
    },
  };
}
