'use client';
import { useEffect, useRef } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useShellStore } from '../state/use-shell-store';
import { useNotificationsStore } from '../state/use-notifications-store';
/** 请求桌面通知权限；返回最终状态（granted / denied / unsupported）。 */
export async function requestDesktopNotificationPermission(): Promise<
  'granted' | 'denied' | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** RuntimeProviders 装配：desktopNotifications 开启时请求权限；拒绝/不支持 → 回退偏好。 */
export function useDesktopNotificationGate(): void {
  const { t } = useFrontendTranslation();
  const desktopNotifications = useShellStore(
    (state) => state.preferences.notifications.desktopNotifications,
  );
  const handledRef = useRef(false);
  useEffect(() => {
    if (!desktopNotifications || handledRef.current) return;
    handledRef.current = true;
    void requestDesktopNotificationPermission().then((status) => {
      if (status === 'granted') return;
      // 拒绝或不支持：回退偏好（避免"无效开关"——无法交付时不让开关保留假象），
      // 并经真实通知管线（应用内通知中心）呈现原因——不静默。
      useShellStore.getState().updateCategory('notifications', { desktopNotifications: false });
      useNotificationsStore.getState().publish({
        category: 'warning',
        severity: 'notice',
        title: t('shell.desktopNotificationDeniedTitle'),
        description:
          status === 'unsupported'
            ? t('shell.desktopNotificationUnsupported')
            : t('shell.desktopNotificationDenied'),
      });
    });
  }, [desktopNotifications, t]);
}
