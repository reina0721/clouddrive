import {
  defaultFileSidebarPreferences,
  fileSidebarPreferencesSchema,
  FilesError,
  type FileSidebarPreferences,
} from '@clouddrive/surface/files';

const sidebarKey = 'clouddrive.files.sidebar.v2';
const previousSidebarKey = 'clouddrive.files.sidebar.v1';

/** createFileSidebarPreferences 拥有设备侧栏偏好，旧键只在新文档成功落盘后移除。 */
export function createFileSidebarPreferences(account: string | null, assertCurrent: () => void) {
  const key = sidebarKey + '.' + account;
  return {
    loadSidebarPreferences(): FileSidebarPreferences {
      assertCurrent();
      try {
        const saved = localStorage.getItem(key);
        if (saved !== null) return fileSidebarPreferencesSchema.parse(JSON.parse(saved));
        const previous = localStorage.getItem(previousSidebarKey + '.' + account);
        const collapsed: unknown = previous === null ? false : JSON.parse(previous);
        if (typeof collapsed !== 'boolean') throw new FilesError('invalid');
        const preferences = { ...defaultFileSidebarPreferences, collapsed };
        localStorage.setItem(key, JSON.stringify(preferences));
        if (previous !== null) localStorage.removeItem(previousSidebarKey + '.' + account);
        return preferences;
      } catch (error) {
        throw new FilesError('invalid', { cause: error });
      }
    },
    saveSidebarPreferences(input: FileSidebarPreferences) {
      assertCurrent();
      try {
        localStorage.setItem(key, JSON.stringify(fileSidebarPreferencesSchema.parse(input)));
      } catch (error) {
        throw new FilesError('unavailable', { cause: error });
      }
    },
  };
}
