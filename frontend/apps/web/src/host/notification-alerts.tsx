'use client';

/**
 * Host —— 通知声音 / 桌面通知消费者（SET-006 通知偏好 sound / desktopNotifications
 * 的真实运行时消费；默认均关）。
 *
 * - 订阅 Host notifications store：真实新发布项到达时按偏好发声 / 弹桌面通知；
 * - sound：WebAudio 短提示音（无资源文件；播放失败不抛错——静默降级可观测）；
 * - desktopNotifications：仅当 Notification.permission === 'granted' 时真正弹出；
 *   开启偏好时由 RuntimeProviders 触发权限请求，拒绝/不支持则回退偏好并呈现原因
 *   （见 useDesktopNotificationGate）；关键（error/critical）通知不受关闭影响——
 *   桌面通知默认关时关键项仍走应用内通知中心（既有能力），此处不重复。
 */
import { useEffect, useRef } from 'react';

import { useShellStore } from '../state/use-shell-store';
import { useNotificationsStore } from '../state/use-notifications-store';

/** WebAudio 短提示音：两个快速上升音；AudioContext 不可用/受限时静默（可观测）。 */
function playChime(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
    for (const [freq, start] of [
      [880, 0],
      [1174.66, 0.12],
    ] as const) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(context.currentTime + start);
      osc.stop(context.currentTime + start + 0.2);
    }
    window.setTimeout(() => void context.close().catch(() => undefined), 800);
  } catch {
    // 声音播放失败：明确静默（不打断用户；偏好仍保留）。
  }
}

/** 真实新通知到达 → 按偏好发声 / 桌面通知。 */
export function NotificationAlerts(): null {
  const sound = useShellStore((state) => state.preferences.notifications.sound);
  const desktopNotifications = useShellStore(
    (state) => state.preferences.notifications.desktopNotifications,
  );
  const seenRef = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    // 订阅 store：items 变化时核对新 id（markRead 也改 items，但 id 集去重）。
    const unsubscribe = useNotificationsStore.subscribe((state, prev) => {
      if (state.items === prev.items) return;
      const seen = seenRef.current;
      for (const item of state.items) {
        if (seen.has(item.id)) continue;
        seenRef.current = new Set([...seenRef.current, item.id]);
        if (sound) playChime();
        if (
          desktopNotifications &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          try {
            new Notification(item.title, {
              ...(item.description ? { body: item.description } : {}),
            });
          } catch {
            // 构造失败静默（应用内通知中心仍可达）。
          }
        }
      }
    });
    // 初始同步：已存在项全部计入 seen，避免挂载时对历史项发声。
    const initial = useNotificationsStore.getState().items;
    seenRef.current = new Set(initial.map((item) => item.id));
    return unsubscribe;
  }, [desktopNotifications, sound]);

  return null;
}
