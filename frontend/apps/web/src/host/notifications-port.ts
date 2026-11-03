/**
 * Host —— Notifications Port 实现（composition root 装配）。
 *
 * 把 `@clouddrive/plugin-framework/notifications` 契约接到 Host notifications
 * store（use-notifications-store.ts）。Plugin 经 Port 发布/订阅真实前端事件；
 * 已读/未读与持久化由 store 管理（可序列化，无函数）。
 */
import type { NotificationsPort } from '@clouddrive/plugin-framework/notifications';
import { useNotificationsStore } from '../state/use-notifications-store';

/** 创建 Notifications Port（Host composition root 单次调用）。 */
export function createHostNotificationsPort(): NotificationsPort {
  return {
    publish: (input) => {
      const id = useNotificationsStore.getState().publish(input);
      return id;
    },
    list: () => useNotificationsStore.getState().items,
    unreadCount: () => useNotificationsStore.getState().items.filter((item) => !item.read).length,
    subscribe: (listener) => useNotificationsStore.subscribe(listener),
    markRead: (id) => {
      useNotificationsStore.getState().markRead(id);
    },
    markAllRead: () => {
      useNotificationsStore.getState().markAllRead();
    },
  };
}
