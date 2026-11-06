import {
  defaultFilePreferences,
  filePreferenceSnapshotSchema,
  filePreferencesSchema,
  fileViewPreferencesSchema,
  FilesError,
  type FilePreferenceSnapshot,
} from '@clouddrive/surface/files';
import type { createJsonClient } from '../api/json-client';

const preferenceKey = 'clouddrive.files.view.v2';
const previousPreferenceKey = 'clouddrive.files.view.v1';

/** createFilePreferences 保持本机模式不依赖网络；同步失败明确上抛，账号失效后不落盘。 */
export function createFilePreferences(
  call: ReturnType<typeof createJsonClient>,
  account: string | null,
  assertCurrent: () => void,
) {
  const key = preferenceKey + '.' + account;
  function readLocal(): FilePreferenceSnapshot {
    assertCurrent();
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) return filePreferenceSnapshotSchema.parse(JSON.parse(saved));
      const legacy = localStorage.getItem(previousPreferenceKey + '.' + account);
      const document = defaultFilePreferences();
      if (legacy !== null) document.defaults = fileViewPreferencesSchema.parse(JSON.parse(legacy));
      const snapshot = { sync: false, configuration: document };
      // 先成功写入新文档，再移除旧键，避免存储失败造成偏好丢失。
      localStorage.setItem(key, JSON.stringify(snapshot));
      if (legacy !== null) localStorage.removeItem(previousPreferenceKey + '.' + account);
      return snapshot;
    } catch (error) {
      throw new FilesError('invalid', { cause: error });
    }
  }
  function writeLocal(value: FilePreferenceSnapshot) {
    assertCurrent();
    localStorage.setItem(key, JSON.stringify(value));
  }
  return {
    loadPreferences: async (
      signal?: AbortSignal,
      source: 'current' | 'server' = 'current',
    ): Promise<FilePreferenceSnapshot> => {
      const snapshot = readLocal();
      if (!snapshot.sync && source !== 'server') return snapshot;
      const document = filePreferencesSchema.parse(
        await call('/preferences', signal ? { signal } : {}),
      );
      assertCurrent();
      if (signal?.aborted) throw new FilesError('canceled');
      const current = { sync: true, configuration: document };
      writeLocal(current);
      return current;
    },
    savePreferences: async (input: FilePreferenceSnapshot): Promise<FilePreferenceSnapshot> => {
      assertCurrent();
      const value = filePreferenceSnapshotSchema.parse(input);
      const current = readLocal();
      if (!value.sync) {
        writeLocal(value);
        return value;
      }
      let document = value.configuration;
      if (!current.sync) {
        const remote = filePreferencesSchema.parse(await call('/preferences'));
        assertCurrent();
        document = { ...document, revision: remote.revision };
      }
      const saved = filePreferencesSchema.parse(
        await call('/preferences', { method: 'PUT', body: document }),
      );
      assertCurrent();
      const result = { sync: true, configuration: saved };
      writeLocal(result);
      return result;
    },
  };
}
