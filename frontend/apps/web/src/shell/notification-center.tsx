'use client';

import { Bell } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { Badge } from '@clouddrive/ui-adapter/feedback';
import { useProductInbox } from '@clouddrive/surface/identity/runtime';
import { useShellStore } from '../state/use-shell-store';

const NotificationDrawer = lazy(() =>
  import('./notification-drawer').then((module) => ({ default: module.NotificationDrawer })),
);

/**
 * Shell 通知中心（SET-006-005 呈现层）：顶部铃铛 + 未读角标 → 受控 Drawer 收纳
 * 真实前端事件通知（数据层/发布方已 e2e 验证）。
 *
 * 偏好门控：通知偏好 inAppNotifications 关时不显示铃铛入口（产品强制的高风险/错误
 * 通知仍由发布方收纳进 store，本入口隐藏不代表丢失）；showBadge 关时不显示未读角标。
 */
export function NotificationCenter({
  triggerLabel: customTriggerLabel,
}: Readonly<{ triggerLabel?: string }> = {}) {
  const { t } = useFrontendTranslation();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const inbox = useProductInbox();
  const { unread } = inbox;
  const inAppNotifications = useShellStore(
    (state) => state.preferences.notifications.inAppNotifications,
  );
  const showBadge = useShellStore((state) => state.preferences.notifications.showBadge);
  if (!inAppNotifications) return null;

  const openCenter = () => {
    setLoaded(true);
    setOpen(true);
  };

  const triggerLabel =
    showBadge && unread > 0
      ? t('shell.notifications') + '，' + t('shell.unreadCount', { count: unread })
      : t('shell.notifications');

  return (
    <>
      {customTriggerLabel ? (
        <Action variant="secondary" size="sm" onPress={openCenter}>
          {customTriggerLabel}
        </Action>
      ) : (
        <button
          aria-controls="notification-center"
          aria-expanded={open}
          aria-label={triggerLabel}
          className="relative shrink-0 rounded-control border border-border bg-surface text-ink-muted outline-none transition-colors hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand grid size-control min-w-control place-items-center"
          onClick={openCenter}
          type="button"
        >
          <Bell className="size-4.5" aria-hidden="true" />
          {showBadge && unread > 0 ? (
            <span className="pointer-events-none absolute -right-1 -top-1">
              <Badge appearance="solid" size="sm" tone="info">
                {unread > 9 ? '9+' : unread}
              </Badge>
            </span>
          ) : null}
        </button>
      )}
      {loaded ? (
        <Suspense
          fallback={
            <span role="status" className="sr-only">
              {t('identityProduct.loading')}
            </span>
          }
        >
          <NotificationDrawer open={open} setOpen={setOpen} inbox={inbox} />
        </Suspense>
      ) : null}
    </>
  );
}
