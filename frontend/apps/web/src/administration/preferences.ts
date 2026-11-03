import type { AccountPreferences } from '@clouddrive/surface/administration';
import { useShellStore } from '../state/use-shell-store';

/** 服务端账户偏好只覆盖双方共有字段，其它界面偏好继续使用原组件体系。 */
export function applyAccountPreferences(value: AccountPreferences) {
  const current = useShellStore.getState().preferences;
  const accent =
    value.themePreset === 'violet'
      ? 'purple'
      : value.themePreset === 'cyan'
        ? current.appearance.accent
        : value.themePreset;
  useShellStore.getState().applyPersistedPreferences({
    ...current,
    appearance: {
      ...current.appearance,
      themeMode: value.themeMode,
      accent,
      density: value.density,
      motion: value.reduceMotion ? 'reduced' : 'system',
    },
    localeRegion: {
      ...current.localeRegion,
      language: value.language === 'en-US' ? 'en' : 'zh-CN',
      timeZone: value.timeZone || 'auto',
    },
    notifications: { ...current.notifications, inAppNotifications: value.notifications.inApp },
  });
}
